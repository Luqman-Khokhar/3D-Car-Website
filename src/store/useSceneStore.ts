import { create } from 'zustand'

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

  setActiveSection: (id: SectionId) => void
  setScrollProgress: (p: number) => void
  setModelReady: (ready: boolean) => void
  setLoadProgress: (p: number) => void
  setLowPower: (low: boolean) => void
  setPrefersReducedMotion: (reduced: boolean) => void
}

export const useSceneStore = create<SceneState>((set) => ({
  activeSection: 'hero',
  scrollProgress: 0,
  modelReady: false,
  loadProgress: 0,
  lowPower: false,
  prefersReducedMotion: false,

  setActiveSection: (activeSection) => set({ activeSection }),
  setScrollProgress: (scrollProgress) => set({ scrollProgress }),
  setModelReady: (modelReady) => set({ modelReady }),
  setLoadProgress: (loadProgress) => set({ loadProgress }),
  setLowPower: (lowPower) => set({ lowPower }),
  setPrefersReducedMotion: (prefersReducedMotion) => set({ prefersReducedMotion }),
}))
