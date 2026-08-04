import { SECTION_COPY, SCROLL_ROOT_ID } from '@/scenes/sections'
import { useSceneStore } from '@/store/useSceneStore'

/**
 * Pure scroll length. Nine 100vh spacers give the master ScrollTrigger something
 * to measure; all visible copy lives in SceneCopy, which is fixed and crossfades.
 *
 * The copy is deliberately not scrolled-and-pinned per section. With a fixed
 * canvas, a fixed crossfading overlay produces the same read as nine pinned
 * panels without nine pin-spacers fighting Lenis for layout.
 */
export function ScrollSections() {
  const freeLook = useSceneStore((s) => s.freeLook)

  return (
    // These spacers sit above the canvas, so they swallow every pointer event
    // that would otherwise reach it. Free look has to hand them back or the
    // orbit drag never starts. The element stays in flow — removing it would
    // collapse the page height and reset ScrollTrigger's measurements.
    <div
      id={SCROLL_ROOT_ID}
      className={`relative z-10 ${freeLook ? 'pointer-events-none' : ''}`}
    >
      {SECTION_COPY.map((section) => (
        <section key={section.id} data-section={section.id} className="h-screen" />
      ))}
    </div>
  )
}
