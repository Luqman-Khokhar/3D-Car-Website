import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { HalfFloatType, WebGLRenderTarget } from 'three'
import { QUALITY, cachedDpr, lowerTier, rememberTier } from '@/lib/quality'
import type { QualitySettings, QualityTier } from '@/lib/quality'
import { carMotion, requestFrame } from '@/lib/frame'
import { getAssemblyHandle } from '@/animations/assemblyHandle'
import { useSceneStore } from '@/store/useSceneStore'

/** Frames thrown away after a (re)build: texture uploads and the last shader
 *  links land here, and they say nothing about the steady-state frame rate. */
const WARMUP_FRAMES = 8
const WARMUP_MS = 250
/** Frames per calibration sample. */
const SAMPLE_FRAMES = 24
/**
 * Mean frame interval the finished car has to hold, ms — roughly 42 fps on a
 * 60 Hz display, where intervals land on 16.7 / 33.3 and this is the mix of the
 * two at which the motion still reads as smooth.
 */
const BUDGET_MS = 24
/** Hard ceiling on how long calibration may hold the loading screen. */
const CALIBRATION_LIMIT_MS = 4500
/** Single intervals longer than this are a stall (compile, GC), not a rate. */
const STALL_MS = 250
/** Give up waiting on the parallel precompile after this and render anyway;
 *  anything still compiling then simply finishes on first use. */
const COMPILE_TIMEOUT_MS = 4000

/** Runtime governor: frames per measurement window, and its thresholds. */
const WINDOW_FRAMES = 60
const SLOW_MS = 25
const FAST_MS = 17.5
const SEVERE_MS = 40
/** Intervals longer than this end a window: the loop was idle, not slow. */
const ACTIVE_GAP_MS = 100

function startDpr(settings: QualitySettings, cached = 0) {
  const ceiling = Math.min(window.devicePixelRatio || 1, settings.maxDpr)
  return Math.max(settings.minDpr, cached > 0 ? Math.min(cached, ceiling) : ceiling)
}

/** Trimmed mean: drops the slowest and fastest tenth so one hitch or one
 *  doubled-up vsync does not decide the tier. */
function steadyMean(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b)
  const cut = Math.floor(sorted.length * 0.1)
  const kept = sorted.slice(cut, sorted.length - cut)
  return kept.reduce((sum, v) => sum + v, 0) / kept.length
}

type Phase = 'waiting' | 'compiling' | 'warmup' | 'sample' | 'done'

/**
 * Fits the render tier and resolution to the machine, using measured frames
 * rather than a guess.
 *
 * Calibration runs once, behind the loading screen:
 *
 *   1. Every material in the scene is compiled up front — hidden parts, the
 *      robot's bones, the circuit outside — against the render target the tier
 *      actually draws into. Previously each part's shaders compiled the first
 *      time it flew into view, which was a 50–100 ms hitch in the middle of the
 *      scroll story on an integrated GPU, several times over.
 *   2. The assembly is parked at its end — the finished car, lit, with both
 *      shadow passes re-rendering every frame the way they do while scrolling.
 *      Measuring the empty bay would flatter the machine by a fifth.
 *   3. Warm up, then time a short sample. Over budget by a little and the
 *      resolution comes down; over by a lot, or already at the tier's floor, and
 *      the tier steps down (high -> medium -> low) and the whole thing repeats.
 *
 * The result is remembered per GPU, so later visits skip straight to it.
 *
 * After the reveal a lighter governor keeps watching, but only frames drawn back
 * to back: the loop is demand-driven, so a parked camera produces no frames at
 * all and must not read as a slow machine. Sustained slowness lowers the device
 * pixel ratio within the tier's range; sustained headroom raises it again, a few
 * times at most so it cannot oscillate. Only a machine still below ~25 fps at
 * the tier's lowest resolution has the tier itself dropped mid-session.
 */
export function AdaptiveQuality() {
  const setDpr = useThree((s) => s.setDpr)
  const get = useThree((s) => s.get)
  const quality = useSceneStore((s) => s.quality)
  const modelReady = useSceneStore((s) => s.modelReady)
  const settled = useSceneStore((s) => s.sceneSettled)
  const settings = QUALITY[quality]

  const dpr = useRef(startDpr(settings, cachedDpr))
  const phase = useRef<Phase>('waiting')
  const frames = useRef(0)
  const phaseStart = useRef(0)
  const calibrationStart = useRef(0)
  const samples = useRef<number[]>([])
  const last = useRef(0)
  const slow = useRef(0)
  const fast = useRef(0)
  const severe = useRef(0)
  const raises = useRef(0)
  /** Scroll progress to hand back once calibration lets go of the timeline. */
  const parked = useRef<number | null>(null)

  const applyDpr = (value: number) => {
    const clamped = Math.min(settings.maxDpr, Math.max(settings.minDpr, value))
    if (Math.abs(clamped - dpr.current) < 0.01) return
    dpr.current = clamped
    setDpr(clamped)
  }

  // Every tier starts from its own resolution ceiling (or the cached result),
  // and a new tier re-runs compile and warm-up so its rebuild is not measured.
  useEffect(() => {
    dpr.current = startDpr(QUALITY[quality], cachedDpr)
    setDpr(dpr.current)
    samples.current = []
    frames.current = 0
    if (phase.current !== 'done') phase.current = 'waiting'
  }, [quality, setDpr])

  useEffect(() => {
    if (!modelReady || settled || phase.current !== 'waiting') return
    let cancelled = false

    const trusted = useSceneStore.getState().qualityTrusted
    if (calibrationStart.current === 0) calibrationStart.current = performance.now()
    phase.current = 'compiling'

    // Compile against what the tier really draws into: the composer's half-float
    // buffer, or the screen. Tone mapping and output colour space are part of a
    // program's key, so compiling for the wrong target compiles nothing useful.
    const { gl, scene, camera } = get()
    const target = QUALITY[quality].post ? new WebGLRenderTarget(1, 1, { type: HalfFloatType }) : null
    const previous = gl.getRenderTarget()
    gl.setRenderTarget(target)
    const compiled = gl.compileAsync(scene, camera)
    gl.setRenderTarget(previous)
    const timeout = new Promise((resolve) => window.setTimeout(resolve, COMPILE_TIMEOUT_MS))

    void Promise.race([compiled, timeout])
      .catch(() => undefined)
      .then(() => {
        target?.dispose()
        if (cancelled) return
        // First frame of the session. Switched on the root directly so the
        // requestFrame below lands in 'demand' rather than waiting for the store
        // round trip to re-render the Canvas prop; the store follows so that
        // prop agrees from then on.
        if (get().frameloop !== 'demand') get().setFrameloop('demand')
        useSceneStore.getState().setRenderEnabled(true)
        requestFrame()
        // A forced tier or an earlier calibration: the precompile was still worth
        // it, but there is nothing to learn by measuring.
        if (trusted) {
          phase.current = 'done'
          useSceneStore.getState().setSceneSettled(true)
          return
        }
        phase.current = 'warmup'
        frames.current = 0
        phaseStart.current = performance.now()
        requestFrame()
      })

    return () => {
      cancelled = true
    }
  }, [modelReady, settled, quality, get])

  /** Park the scrubbed assembly at its end for the measurement. */
  const park = () => {
    if (parked.current !== null) return
    const { timeline } = getAssemblyHandle()
    if (!timeline) return
    parked.current = timeline.progress()
    timeline.progress(1)
  }

  /** Hand the timeline back where the scroll position says it should be. */
  const unpark = () => {
    if (parked.current === null) return
    const { timeline, trigger } = getAssemblyHandle()
    if (timeline) timeline.progress(trigger ? trigger.progress : parked.current)
    parked.current = null
  }

  const settle = (remember: boolean) => {
    unpark()
    phase.current = 'done'
    samples.current = []
    if (remember) rememberTier(quality, dpr.current)
    useSceneStore.getState().setSceneSettled(true)
  }

  const stepDown = (next: QualityTier) => {
    phase.current = 'waiting'
    useSceneStore.getState().setQuality(next)
  }

  useFrame(() => {
    const now = performance.now()
    const gap = now - last.current
    last.current = now

    if (phase.current === 'waiting' || phase.current === 'compiling') return

    if (phase.current !== 'done') {
      // Back-to-back frames for the measurement (the demand loop would draw one
      // and stop), with the car parked built and both shadow passes redrawing.
      requestFrame()
      park()
      carMotion.version++

      if (phase.current === 'warmup') {
        frames.current++
        if (frames.current >= WARMUP_FRAMES && now - phaseStart.current >= WARMUP_MS) {
          phase.current = 'sample'
          samples.current = []
        }
        return
      }

      if (gap > STALL_MS) return
      samples.current.push(gap)
      if (samples.current.length < SAMPLE_FRAMES) return

      const mean = steadyMean(samples.current)
      const outOfTime = now - calibrationStart.current > CALIBRATION_LIMIT_MS
      if (mean <= BUDGET_MS || outOfTime) {
        settle(true)
        return
      }

      // Way over: resolution alone will not close a 2x gap without going soft,
      // so drop the expensive passes instead.
      if (mean > BUDGET_MS * 2 && quality !== 'low') {
        stepDown(lowerTier(quality))
        return
      }

      // Fill-bound, so cost scales with pixel count: dpr^2.
      const target = dpr.current * Math.max(0.7, Math.sqrt(BUDGET_MS / mean))
      if (target >= settings.minDpr || quality === 'low') {
        applyDpr(target)
        if (quality === 'low' && target < settings.minDpr) {
          settle(true)
          return
        }
        phase.current = 'warmup'
        frames.current = 0
        phaseStart.current = now
        return
      }
      stepDown(lowerTier(quality))
      return
    }

    // --- Runtime governor ---------------------------------------------------
    if (gap > ACTIVE_GAP_MS) {
      samples.current = []
      return
    }
    samples.current.push(gap)
    if (samples.current.length < WINDOW_FRAMES) return
    const mean = steadyMean(samples.current)
    samples.current = []

    if (mean > SLOW_MS) {
      slow.current++
      fast.current = 0
    } else if (mean < FAST_MS) {
      fast.current++
      slow.current = 0
    } else {
      slow.current = 0
      fast.current = 0
    }

    if (slow.current >= 2) {
      slow.current = 0
      if (dpr.current > settings.minDpr + 0.01) {
        applyDpr(dpr.current * 0.85)
        rememberTier(quality, dpr.current)
      } else if (mean > SEVERE_MS && quality !== 'low' && ++severe.current >= 2) {
        severe.current = 0
        const next = lowerTier(quality)
        rememberTier(next, 0)
        useSceneStore.getState().setQuality(next)
      }
    }

    if (fast.current >= 4 && raises.current < 3 && dpr.current < settings.maxDpr - 0.01) {
      fast.current = 0
      raises.current++
      applyDpr(dpr.current * 1.1)
    }
  })

  return null
}
