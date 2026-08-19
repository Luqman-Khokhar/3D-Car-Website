import { create } from 'zustand'
import { setPaintTarget } from '@/animations/paintState'
import { BODY } from '@/scenes/palette'

/** Ordered narrative sections. Index is the scroll order. */
export const SECTIONS = [
  'hero',
  'raw-materials',
  'chassis',
  'engine',
  'body-panels',
  'tail-lamps',
  'head-lamps',
  'paint',
  'interior',
  'wheels',
  'reveal',
] as const

export type SectionId = (typeof SECTIONS)[number]

/**
 * Scroll pacing presets. The value is Lenis' wheelMultiplier: lower means a
 * wheel notch covers less page, which stretches the scrubbed assembly timeline
 * over more input without touching the timeline itself.
 */
export const SCROLL_SPEEDS = [
  { id: 'very-slow', label: 'Very slow', multiplier: 0.35 },
  { id: 'slow', label: 'Slow', multiplier: 0.55 },
  { id: 'normal', label: 'Normal', multiplier: 1 },
  { id: 'fast', label: 'Fast', multiplier: 1.5 },
] as const

export type ScrollSpeedId = (typeof SCROLL_SPEEDS)[number]['id']

const SCROLL_SPEED_KEY = 'car-assembly:scroll-speed'
const DEFAULT_SCROLL_SPEED: ScrollSpeedId = 'normal'

/** Preference survives reloads; a bad/absent value falls back to the default. */
function readStoredScrollSpeed(): ScrollSpeedId {
  try {
    const stored = localStorage.getItem(SCROLL_SPEED_KEY)
    if (SCROLL_SPEEDS.some((s) => s.id === stored)) return stored as ScrollSpeedId
  } catch {
    // Private mode / blocked storage. Not worth failing the app over.
  }
  return DEFAULT_SCROLL_SPEED
}

/**
 * Manual garage light switches, one per fixture circuit.
 *
 * `auto` (the default) leaves that circuit on the scroll-scrubbed atmosphere —
 * the tail-lamp/head-lamp scenes still black the room out on their own. It is a
 * resting state only, never one of the two clickable faces: the first click
 * forces `on`, and after that the switch just toggles on/off, the same way a
 * real breaker does not reset itself because the story moved to a different
 * scene. `on`/`off` wins over the scroll timeline and free look both.
 */
export type LightSwitchState = 'auto' | 'on' | 'off'

/** Ceiling tubes are three independent rows (back/mid/front, matching the
 *  physical rows in ceilingLights() in src/scenes/garage.ts) rather than one
 *  circuit, so each row's pair of tubes can be switched on its own. The
 *  overhead work spot and the car's headlamps stay scroll-driven only — no
 *  manual switch for either. */
export const LIGHT_SWITCH_GROUPS = ['tubeBack', 'tubeMid', 'tubeFront'] as const
export type LightSwitchGroup = (typeof LIGHT_SWITCH_GROUPS)[number]

const LIGHT_SWITCH_KEY = 'car-assembly:light-switches'
const DEFAULT_LIGHT_SWITCHES: Record<LightSwitchGroup, LightSwitchState> = {
  tubeBack: 'auto',
  tubeMid: 'auto',
  tubeFront: 'auto',
}

/** Click order: two faces only. `auto` is the hidden resting state before the
 *  switch is ever touched — first click forces it on, and from then on the
 *  switch just toggles on/off like a real one, never returning to auto. */
const LIGHT_SWITCH_CYCLE: Record<LightSwitchState, LightSwitchState> = {
  auto: 'on',
  on: 'off',
  off: 'on',
}

function readStoredLightSwitches(): Record<LightSwitchGroup, LightSwitchState> {
  const result = { ...DEFAULT_LIGHT_SWITCHES }
  try {
    const stored = localStorage.getItem(LIGHT_SWITCH_KEY)
    if (!stored) return result
    const parsed = JSON.parse(stored) as Partial<Record<LightSwitchGroup, string>>
    for (const group of LIGHT_SWITCH_GROUPS) {
      const value = parsed[group]
      if (value === 'auto' || value === 'on' || value === 'off') result[group] = value
    }
  } catch {
    // Private mode / blocked storage / corrupt JSON. Defaults are fine.
  }
  return result
}

export function scrollSpeedMultiplier(id: ScrollSpeedId): number {
  return (SCROLL_SPEEDS.find((s) => s.id === id) ?? SCROLL_SPEEDS[2]).multiplier
}

interface SceneState {
  /** Section currently pinned in the viewport. */
  activeSection: SectionId
  /** 0..1 progress through the whole page, driven by Lenis. */
  scrollProgress: number
  /** True once the GLB (or placeholder rig) is mounted and first frame rendered. */
  modelReady: boolean
  /** drei useProgress mirror, 0..100. */
  loadProgress: number
  /** Set by useDeviceTier; downgrades particles/post-processing. */
  lowPower: boolean
  prefersReducedMotion: boolean
  /**
   * Free-look ("360") mode. While true the scripted camera is suspended, page
   * scroll is locked and the user orbits/pans the garage with the cursor.
   */
  freeLook: boolean
  /**
   * Autobot mode. The eighteen car panels fold onto a robot skeleton and stay
   * there until the same button is pressed again.
   *
   * Strictly a sub-mode of free look, not a peer of it. The fold is driven by a
   * GSAP timeline that writes the same part transforms the scrubbed assembly
   * timeline owns, so page scroll has to be locked for the whole time the robot is
   * up — and free look is already the mode that locks it. `setFreeLook`/
   * `toggleFreeLook` therefore clear this on the way out, and `setRobotMode(true)`
   * turns free look on rather than assuming it already is.
   */
  robotMode: boolean
  /** True while the fold (or the unfold) is mid-flight. The toggle disables itself
   *  for the duration: reversing a half-played transform timeline is fine, but
   *  starting a second one on top of it is not. */
  transforming: boolean
  /** Hex of the swatch the user has picked in the paint scene. Mirrors
   *  paintState.targetColor for the UI's sake — the render loop reads the
   *  three.Color directly and never subscribes to this. */
  selectedBodyColor: string
  /** User-chosen scroll pacing. useSmoothScroll pushes it into Lenis. */
  scrollSpeed: ScrollSpeedId
  /** Manual override per light circuit. GarageLights reads this every frame. */
  lightSwitches: Record<LightSwitchGroup, LightSwitchState>

  setActiveSection: (id: SectionId) => void
  setScrollProgress: (p: number) => void
  setModelReady: (ready: boolean) => void
  setLoadProgress: (p: number) => void
  setLowPower: (low: boolean) => void
  setPrefersReducedMotion: (reduced: boolean) => void
  setFreeLook: (on: boolean) => void
  toggleFreeLook: () => void
  setRobotMode: (on: boolean) => void
  toggleRobotMode: () => void
  setTransforming: (busy: boolean) => void
  setBodyColor: (hex: string) => void
  setScrollSpeed: (id: ScrollSpeedId) => void
  cycleLightSwitch: (group: LightSwitchGroup) => void
}

export const useSceneStore = create<SceneState>((set) => ({
  activeSection: 'hero',
  scrollProgress: 0,
  modelReady: false,
  loadProgress: 0,
  lowPower: false,
  prefersReducedMotion: false,
  freeLook: false,
  robotMode: false,
  transforming: false,
  selectedBodyColor: BODY,
  scrollSpeed: readStoredScrollSpeed(),
  lightSwitches: readStoredLightSwitches(),

  setActiveSection: (activeSection) => set({ activeSection }),
  setScrollProgress: (scrollProgress) => set({ scrollProgress }),
  setModelReady: (modelReady) => set({ modelReady }),
  setLoadProgress: (loadProgress) => set({ loadProgress }),
  setLowPower: (lowPower) => set({ lowPower }),
  setPrefersReducedMotion: (prefersReducedMotion) => set({ prefersReducedMotion }),
  // Leaving free look drops the robot with it — see the robotMode doc above.
  setFreeLook: (freeLook) => set(freeLook ? { freeLook } : { freeLook, robotMode: false }),
  toggleFreeLook: () =>
    set((s) => (s.freeLook ? { freeLook: false, robotMode: false } : { freeLook: true })),
  setRobotMode: (robotMode) =>
    set(robotMode ? { robotMode, freeLook: true } : { robotMode }),
  toggleRobotMode: () =>
    set((s) => (s.robotMode ? { robotMode: false } : { robotMode: true, freeLook: true })),
  setTransforming: (transforming) => set({ transforming }),
  setBodyColor: (hex) => {
    setPaintTarget(hex)
    set({ selectedBodyColor: hex })
  },
  setScrollSpeed: (scrollSpeed) => {
    try {
      localStorage.setItem(SCROLL_SPEED_KEY, scrollSpeed)
    } catch {
      // Same as the read side: storage being unavailable is not fatal.
    }
    set({ scrollSpeed })
  },
  cycleLightSwitch: (group) =>
    set((s) => {
      const next = { ...s.lightSwitches, [group]: LIGHT_SWITCH_CYCLE[s.lightSwitches[group]] }
      try {
        localStorage.setItem(LIGHT_SWITCH_KEY, JSON.stringify(next))
      } catch {
        // Storage unavailable; the switch still works for the rest of the session.
      }
      return { lightSwitches: next }
    }),
}))
