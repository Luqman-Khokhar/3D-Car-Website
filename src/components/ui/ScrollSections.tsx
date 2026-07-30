import { SECTION_COPY, SCROLL_ROOT_ID } from '@/scenes/sections'

/**
 * Pure scroll length. Nine 100vh spacers give the master ScrollTrigger something
 * to measure; all visible copy lives in SceneCopy, which is fixed and crossfades.
 *
 * The copy is deliberately not scrolled-and-pinned per section. With a fixed
 * canvas, a fixed crossfading overlay produces the same read as nine pinned
 * panels without nine pin-spacers fighting Lenis for layout.
 */
export function ScrollSections() {
  return (
    <div id={SCROLL_ROOT_ID} className="relative z-10">
      {SECTION_COPY.map((section) => (
        <section key={section.id} data-section={section.id} className="h-screen" />
      ))}
    </div>
  )
}
