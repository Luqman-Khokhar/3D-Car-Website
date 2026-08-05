import { useSceneStore, SCROLL_SPEEDS } from '@/store/useSceneStore'
import type { ScrollSpeedId } from '@/store/useSceneStore'

/**
 * Scroll pacing selector, stacked under the 360° toggle.
 *
 * The assembly timeline is scrubbed by scroll position, so the only honest way
 * to slow the animation down is to slow the input that drives it. This writes
 * the choice to the store; useSmoothScroll mirrors it into Lenis' wheelMultiplier.
 *
 * Hidden under reduced motion (Lenis never mounts, so there is nothing to pace)
 * and in free look (scrolling is locked there).
 */
export function ScrollSpeedPicker() {
  const modelReady = useSceneStore((s) => s.modelReady)
  const freeLook = useSceneStore((s) => s.freeLook)
  const prefersReducedMotion = useSceneStore((s) => s.prefersReducedMotion)
  const scrollSpeed = useSceneStore((s) => s.scrollSpeed)
  const setScrollSpeed = useSceneStore((s) => s.setScrollSpeed)

  if (!modelReady || prefersReducedMotion) return null

  return (
    <div
      className={`fixed top-[4.25rem] right-5 z-30 transition-opacity duration-300 md:top-[4.75rem] md:right-6 ${
        freeLook ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <label className="flex items-center gap-2 rounded-full border border-stone-300/60 bg-black/30 py-2 pr-2 pl-4 font-mono text-[0.65rem] tracking-[0.18em] text-stone-200 uppercase backdrop-blur-sm md:text-xs">
        <span>Scroll</span>
        <select
          value={scrollSpeed}
          onChange={(e) => setScrollSpeed(e.target.value as ScrollSpeedId)}
          aria-label="Scroll speed"
          title="How fast scrolling advances the assembly"
          // appearance-none keeps the native chevron off the dark chip; the
          // options themselves still render with the OS popup.
          className="cursor-pointer appearance-none rounded-full bg-transparent py-0.5 pr-2 pl-1 font-mono text-[0.65rem] tracking-[0.18em] text-stone-50 uppercase focus-visible:ring-2 focus-visible:ring-stone-200 focus-visible:outline-none md:text-xs"
        >
          {SCROLL_SPEEDS.map((speed) => (
            <option key={speed.id} value={speed.id} className="bg-stone-900 text-stone-100">
              {speed.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
