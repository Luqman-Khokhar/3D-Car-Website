import { SECTION_COPY } from '@/scenes/sections'
import { useSceneStore } from '@/store/useSceneStore'
import { scrollToTop } from '@/hooks/useSmoothScroll'

/**
 * Fixed copy layer. Only `activeSection` is subscribed, and that changes nine
 * times across the whole page, so scrolling does not re-render this per frame.
 *
 * All nine blocks stay mounted and crossfade via opacity — mounting/unmounting
 * text mid-scroll causes a layout flash.
 */
export function SceneCopy() {
  const activeSection = useSceneStore((s) => s.activeSection)

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex items-center px-8 md:px-20">
      {/* Scrim. The camera moves, so the floor/wall horizon crosses the copy at
          some scroll offsets, and dark type on the dark floor is unreadable.
          A single linear gradient cannot be both narrow enough to spare the car
          and opaque enough behind the text, so on desktop it is a solid panel
          sized to the copy column plus a short fade tail. Mobile keeps one
          gradient, where the copy sits over the scene by design. */}
      <div
        className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-[var(--garage-wall)] from-30% to-transparent md:hidden"
        aria-hidden="true"
      />
      <div
        className="absolute inset-y-0 left-0 hidden w-[30rem] bg-[var(--garage-wall)] md:block"
        aria-hidden="true"
      />
      <div
        className="absolute inset-y-0 left-[30rem] hidden w-40 bg-gradient-to-r from-[var(--garage-wall)] to-transparent md:block"
        aria-hidden="true"
      />
      {/* Fixed min-height so the stack of absolute blocks stays optically centred
          regardless of which copy is showing. */}
      <div className="relative min-h-72 w-full max-w-md">
        {SECTION_COPY.map((section) => {
          const active = section.id === activeSection
          const isHero = section.id === 'hero'
          const isReveal = section.id === 'reveal'

          return (
            <div
              key={section.id}
              aria-hidden={!active}
              className={`absolute inset-x-0 top-0 transition-all duration-500 ease-out ${
                active ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
              }`}
            >
              <p className="font-mono text-xs tracking-[0.25em] text-stone-600 uppercase">
                {section.label}
              </p>

              <h2
                className={`mt-4 font-semibold tracking-tight text-stone-900 ${
                  isHero ? 'text-6xl md:text-8xl' : 'text-4xl md:text-6xl'
                }`}
              >
                {section.title}
              </h2>

              {section.subtitle && (
                <p className="mt-3 text-lg text-stone-700 md:text-xl">{section.subtitle}</p>
              )}

              <p className="mt-4 text-base leading-relaxed text-stone-700 md:text-lg">
                {section.body}
              </p>

              {isHero && (
                <div className="mt-9 flex items-center gap-3 text-stone-600">
                  {/* Scroll cue. motion-reduce disables the bob rather than the
                      cue itself — the affordance still has to be visible. */}
                  <span
                    aria-hidden="true"
                    className="block h-8 w-px animate-pulse bg-stone-500 motion-reduce:animate-none"
                  />
                  <span className="font-mono text-xs tracking-[0.2em] uppercase">
                    Scroll to build
                  </span>
                </div>
              )}

              {isReveal && (
                <button
                  type="button"
                  onClick={scrollToTop}
                  // The overlay is pointer-events-none so it never eats scroll;
                  // the one interactive element opts back in.
                  className="pointer-events-auto mt-8 rounded-full border border-stone-500 px-6 py-2.5 font-mono text-xs tracking-[0.2em] text-stone-800 uppercase transition-colors hover:border-stone-800 hover:bg-stone-900 hover:text-stone-100 focus-visible:ring-2 focus-visible:ring-stone-700 focus-visible:outline-none"
                >
                  Build it again
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
