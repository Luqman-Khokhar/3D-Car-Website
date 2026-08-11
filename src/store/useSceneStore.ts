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
  /** Hex of the swatch the user has picked in the paint scene. Mirrors
   *  paintState.targetColor for the UI's sake — the render loop reads the
   *  three.Color directly and never subscribes to this. */
  selectedBodyColor: string
  /** User-chosen scroll pacing. useSmoothScroll pushes it into Lenis. */
  scrollSpeed: ScrollSpeedId

  setActiveSection: (id: SectionId) => void
  setScrollProgress: (p: number) => void
  setModelReady: (ready: boolean) => void
  setLoadProgress: (p: number) => void
  setLowPower: (low: boolean) => void
  setPrefersReducedMotion: (reduced: boolean) => void
  setFreeLook: (on: boolean) => void
  toggleFreeLook: () => void
  setBodyColor: (hex: string) => void
  setScrollSpeed: (id: ScrollSpeedId) => void
}

export const useSceneStore = create<SceneState>((set) => ({
  activeSection: 'hero',
  scrollProgress: 0,
  modelReady: false,
  loadProgress: 0,
  lowPower: false,
  prefersReducedMotion: false,
  freeLook: false,
  selectedBodyColor: BODY,
  scrollSpeed: readStoredScrollSpeed(),

  setActiveSection: (activeSection) => set({ activeSection }),
  setScrollProgress: (scrollProgress) => set({ scrollProgress }),
  setModelReady: (modelReady) => set({ modelReady }),
  setLoadProgress: (loadProgress) => set({ loadProgress }),
  setLowPower: (lowPower) => set({ lowPower }),
  setPrefersReducedMotion: (prefersReducedMotion) => set({ prefersReducedMotion }),
  setFreeLook: (freeLook) => set({ freeLook }),
  toggleFreeLook: () => set((s) => ({ freeLook: !s.freeLook })),
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
}))
