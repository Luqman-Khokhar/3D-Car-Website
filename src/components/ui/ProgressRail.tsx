import { useEffect, useRef } from 'react'
import { useSceneStore } from '@/store/useSceneStore'

/**
 * Vertical progress bar. Writes the transform imperatively from a transient
 * store subscription so scrolling never re-renders this component.
 */
export function ProgressRail() {
  const fill = useRef<HTMLDivElement>(null)
  const freeLook = useSceneStore((s) => s.freeLook)

  useEffect(() => {
    const apply = (progress: number) => {
      if (fill.current) fill.current.style.transform = `scaleY(${progress})`
    }
    apply(useSceneStore.getState().scrollProgress)
    return useSceneStore.subscribe((state) => apply(state.scrollProgress))
  }, [])

  return (
    // Kept mounted while hidden — the effect above writes through a ref, and
    // scroll progress is meaningless while free look has scrolling frozen.
    <div
      className={`pointer-events-none fixed top-1/2 right-6 z-20 hidden h-40 w-px -translate-y-1/2 bg-stone-500/50 transition-opacity duration-300 md:block ${
        freeLook ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div ref={fill} className="h-full w-full origin-top bg-stone-100" />
    </div>
  )
}
