import { SECTION_COPY } from '@/scenes/sections'
import { useSceneStore } from '@/store/useSceneStore'
import { scrollToTop } from '@/hooks/useSmoothScroll'

/**
 * Fixed copy layer. Only `activeSection` is subscribed, and that changes eleven
 * times across the whole page, so scrolling does not re-render this per frame.
 *
 * All eleven blocks stay mounted and crossfade via opacity — mounting/unmounting
 * text mid-scroll causes a layout flash.
 */
export function SceneCopy() {
  const activeSection = useSceneStore((s) => s.activeSection)
  const freeLook = useSceneStore((s) => s.freeLook)

  return (
    // Free look hides the whole copy layer: it is a full-height scrim over the
    // left of the frame, which is exactly where the user is trying to orbit.
    // `invisible` rather than opacity alone so the reveal button — the one
    // element that opts back into pointer events — stops being clickable too.
    <div
      className={`pointer-events-none fixed inset-0 z-20 flex items-center px-8 transition-opacity duration-300 md:px-20 ${
        freeLook ? 'invisible opacity-0' : 'opacity-100'
      }`}
    >
      {/* Scrim. The camera moves, so the floor/wall horizon crosses the copy at
          some scroll offsets, and the backdrop swings from light wall to dark
          floor. Instead of an opaque panel the copy rides on a translucent dark
          wash that fades out well before the car — the scene stays visible
          edge to edge, the type stays legible on either backdrop. */}
      <div
        className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-black/60 via-black/30 via-45% to-transparent md:w-[62%]"
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
              <p className="copy-shadow font-mono text-xs tracking-[0.25em] text-stone-300 uppercase">
                {section.label}
              </p>

              <h2
                className={`copy-shadow mt-4 font-semibold tracking-tight text-stone-50 ${
                  isHero ? 'text-6xl md:text-8xl' : 'text-4xl md:text-6xl'
                }`}
              >
                {section.title}
              </h2>

              {section.subtitle && (
                <p className="copy-shadow mt-3 text-lg text-stone-200 md:text-xl">
                  {section.subtitle}
                </p>
              )}

              <p className="copy-shadow mt-4 text-base leading-relaxed text-stone-300 md:text-lg">
                {section.body}
              </p>

              {isHero && (
                <div className="copy-shadow mt-9 flex items-center gap-3 text-stone-300">
                  {/* Scroll cue. motion-reduce disables the bob rather than the
                      cue itself — the affordance still has to be visible. */}
                  <span
                    aria-hidden="true"
                    className="block h-8 w-px animate-pulse bg-stone-300 motion-reduce:animate-none"
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
                  className="pointer-events-auto mt-8 rounded-full border border-stone-300/70 px-6 py-2.5 font-mono text-xs tracking-[0.2em] text-stone-100 uppercase backdrop-blur-sm transition-colors hover:border-stone-100 hover:bg-stone-100 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-stone-200 focus-visible:outline-none"
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
