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
  'paint',
  'interior',
  'wheels',
  'reveal',
] as const

export type SectionId = (typeof SECTIONS)[number]

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

  setActiveSection: (id: SectionId) => void
  setScrollProgress: (p: number) => void
  setModelReady: (ready: boolean) => void
  setLoadProgress: (p: number) => void
  setLowPower: (low: boolean) => void
  setPrefersReducedMotion: (reduced: boolean) => void
  setFreeLook: (on: boolean) => void
  toggleFreeLook: () => void
  setBodyColor: (hex: string) => void
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
}))
