import { useEffect, useRef } from 'react'
import { SECTIONS, useSceneStore } from '@/store/useSceneStore'
import { SECTION_COPY } from '@/scenes/sections'
import { scrollToProgress } from '@/lib/scroll'

const LAST = SECTIONS.length - 1

/**
 * Chapter rail. A progress line plus one tick per scene; every tick is a button
 * that scrolls to its chapter, so the eleven scenes can be revisited without
 * scrubbing through everything between — and the car builds or unbuilds on the
 * way, because the scroll it rides is the same one.
 *
 * Ticks sit at i / (scenes - 1) down the track, the same offsets at which the
 * timeline fully reaches each scene, so the fill crosses a tick exactly when its
 * chapter lands.
 *
 * The fill is written imperatively from a transient store subscription, so
 * scrolling never re-renders this; only the active tick (eleven changes across
 * the whole page) does.
 *
 * Desktop only, same as before: on a phone the right edge is where the thumb
 * scrolls, and the copy already carries the chapter number.
 */
export function ProgressRail() {
  const fill = useRef<HTMLDivElement>(null)
  const freeLook = useSceneStore((s) => s.freeLook)
  const modelReady = useSceneStore((s) => s.modelReady)
  const activeSection = useSceneStore((s) => s.activeSection)
  const activeIndex = SECTIONS.indexOf(activeSection)

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
    <nav
      aria-label="Chapters"
      aria-hidden={freeLook || !modelReady}
      className={`pointer-events-none fixed top-1/2 right-4 z-20 hidden h-[min(18rem,46vh)] -translate-y-1/2 transition-opacity duration-300 md:block ${
        freeLook || !modelReady ? 'invisible opacity-0' : 'opacity-100'
      }`}
    >
      {/* Track and fill, centred under the tick column. */}
      <div className="absolute inset-y-0 right-[11.5px] w-px bg-stone-400/40">
        <div ref={fill} className="h-full w-full origin-top bg-stone-100" />
      </div>
      <ol className="relative flex h-full flex-col justify-between">
        {SECTION_COPY.map((section, i) => {
          const active = i === activeIndex
          const reached = i <= activeIndex
          return (
            <li key={section.id} className="-my-3">
              <button
                type="button"
                onClick={() => scrollToProgress(i / LAST)}
                aria-label={`${section.label}: ${section.title}`}
                aria-current={active ? 'step' : undefined}
                className="group pointer-events-auto relative grid h-6 w-6 place-items-center rounded-full focus-visible:ring-2 focus-visible:ring-stone-200 focus-visible:outline-none"
              >
                <span
                  aria-hidden="true"
                  className={`block h-px rounded-full transition-[width,background-color] duration-300 ease-out group-hover:w-3.5 group-hover:bg-stone-50 ${
                    active ? 'w-3.5 bg-stone-50' : reached ? 'w-2 bg-stone-200' : 'w-2 bg-stone-400/80'
                  }`}
                />
                {/* Label on hover/focus only: eleven always-on labels would be a
                    second copy column. */}
                <span
                  aria-hidden="true"
                  className="copy-shadow pointer-events-none absolute right-full mr-2 translate-x-1 font-mono text-[0.6rem] tracking-[0.18em] whitespace-nowrap text-stone-100 uppercase opacity-0 transition-[opacity,transform] duration-200 ease-out group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
                >
                  {section.label}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
