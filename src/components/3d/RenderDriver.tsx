import { useEffect, useRef } from 'react'
import { addEffect, useFrame, useThree } from '@react-three/fiber'
import { gsap } from '@/lib/gsap'
import { bindInvalidate, carMotion, requestFrame } from '@/lib/frame'
import { getAssemblyHandle } from '@/animations/assemblyHandle'
import { useSceneStore } from '@/store/useSceneStore'

/** A gap between frames longer than this means the loop was idle, not slow. */
const IDLE_GAP_MS = 100
const NOMINAL_FRAME_MS = 1000 / 60

/**
 * Feeds the demand-driven render loop (`frameloop="demand"` on the Canvas).
 *
 * Everything that moves the scene from outside React asks for frames here:
 *
 *   - The scroll story. ScrollTrigger scrubs the assembly timeline from GSAP's
 *     ticker, and keeps easing it for a while after the wheel stops; any tick on
 *     which the timeline's time moved needs a frame. Comparing the time rather
 *     than listening to scroll events also covers the scrub's tail, the reveal
 *     button's scroll-to-top and the robot catch-up seek.
 *   - The robot fold, for as long as `transforming` is up.
 *   - Any store change — modes, swatches, switches, tier — since most of them
 *     change what a frame callback draws without changing a single prop.
 *
 * Components that ease on their own (camera return, door, fades, driving) keep
 * themselves alive by calling requestFrame() from their frame callback until
 * they land; see each of them.
 *
 * Also normalises the first frame after an idle stretch. R3F hands useFrame the
 * wall time since the previous frame, so after ten seconds of reading the copy
 * the first frame of a door opening would see delta = 10 s and every
 * exponential ease in the scene would jump straight to its end. Rewinding the
 * clock to one nominal frame ago makes that first step a normal one.
 */
export function RenderDriver() {
  const invalidate = useThree((s) => s.invalidate)
  const get = useThree((s) => s.get)

  useEffect(() => {
    bindInvalidate(() => invalidate())
    // One frame for whatever mounted with us.
    invalidate()
    return () => bindInvalidate(null)
  }, [invalidate])

  useEffect(() => {
    let lastTime = Number.NaN
    const tick = () => {
      const { timeline } = getAssemblyHandle()
      const time = timeline ? timeline.time() : Number.NaN
      const moved = time !== lastTime && !(Number.isNaN(time) && Number.isNaN(lastTime))
      lastTime = time
      if (moved || useSceneStore.getState().transforming) {
        carMotion.version++
        requestFrame()
      }
    }
    gsap.ticker.add(tick)

    const unsubscribe = useSceneStore.subscribe(() => {
      carMotion.version++
      requestFrame()
    })

    return () => {
      gsap.ticker.remove(tick)
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    let last = -Infinity
    return addEffect((timestamp) => {
      if (timestamp - last > IDLE_GAP_MS) get().clock.oldTime = performance.now() - NOMINAL_FRAME_MS
      last = timestamp
    })
  }, [get])

  return null
}

/**
 * Re-renders the spotlight's shadow map only on frames where the car moved.
 * Must be mounted after the car in the tree so its frame callback runs after
 * ProceduralCar has applied this frame's drive transform and bumped `carMotion`.
 */
export function ShadowMapGate() {
  const gl = useThree((s) => s.gl)
  const seen = useRef(-1)

  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    seen.current = -1
    return () => {
      gl.shadowMap.autoUpdate = true
    }
  }, [gl])

  useFrame(() => {
    if (seen.current === carMotion.version) return
    seen.current = carMotion.version
    gl.shadowMap.needsUpdate = true
  })

  return null
}
