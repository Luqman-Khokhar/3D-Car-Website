import { useSceneStore, SCROLL_SPEEDS } from '@/store/useSceneStore'
import type { ScrollSpeedId } from '@/store/useSceneStore'
import { HUD_PILL, HUD_PILL_IDLE } from './hud'

/**
 * Scroll pacing selector, third in HudControls' stack: 360° toggle, Transform,
 * then this.
 *
 * The assembly timeline is scrubbed by scroll position, so the only honest way
 * to slow the animation down is to slow the input that drives it. This writes
 * the choice to the store; useSmoothScroll mirrors it into Lenis' wheelMultiplier.
 *
 * HudControls hides it under reduced motion (Lenis never mounts, so there is
 * nothing to pace) and in free look (scrolling is locked there).
 */
export function ScrollSpeedPicker() {
  const scrollSpeed = useSceneStore((s) => s.scrollSpeed)
  const setScrollSpeed = useSceneStore((s) => s.setScrollSpeed)

  return (
    <label
      className={`${HUD_PILL} ${HUD_PILL_IDLE} w-full justify-center pr-3 focus-within:ring-2 focus-within:ring-stone-200`}
    >
      <span aria-hidden="true">Pace</span>
      <select
        value={scrollSpeed}
        onChange={(e) => setScrollSpeed(e.target.value as ScrollSpeedId)}
        aria-label="Scroll pace"
        title="How fast scrolling advances the assembly"
        // appearance-none keeps the native chevron off the dark chip; the
        // options themselves still render with the OS popup. The ring is on the
        // label (focus-within) so it wraps the whole pill, not just the word.
        className="cursor-pointer appearance-none bg-transparent font-mono text-[0.65rem] tracking-[0.18em] text-stone-50 uppercase focus:outline-none md:text-xs"
      >
        {SCROLL_SPEEDS.map((speed) => (
          <option key={speed.id} value={speed.id} className="bg-stone-900 text-stone-100">
            {speed.label}
          </option>
        ))}
      </select>
      <svg aria-hidden="true" viewBox="0 0 10 6" className="h-1.5 w-2.5 shrink-0 text-stone-400">
        <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    </label>
  )
}
