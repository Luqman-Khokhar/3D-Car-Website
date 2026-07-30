import { useEffect, useRef } from 'react'
import { useSceneStore } from '@/store/useSceneStore'

/**
 * Vertical progress bar. Writes the transform imperatively from a transient
 * store subscription so scrolling never re-renders this component.
 */
export function ProgressRail() {
  const fill = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const apply = (progress: number) => {
      if (fill.current) fill.current.style.transform = `scaleY(${progress})`
    }
    apply(useSceneStore.getState().scrollProgress)
    return useSceneStore.subscribe((state) => apply(state.scrollProgress))
  }, [])

  return (
    <div className="pointer-events-none fixed top-1/2 right-6 z-20 hidden h-40 w-px -translate-y-1/2 bg-stone-400 md:block">
      <div ref={fill} className="h-full w-full origin-top bg-stone-800" />
    </div>
  )
}
