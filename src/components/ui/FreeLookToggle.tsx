import { useSceneStore } from '@/store/useSceneStore'

/**
 * Top-right switch into free look, plus the control legend that replaces the
 * scroll cue while the mode is on.
 *
 * Gated on modelReady so it cannot be armed over the loading screen, where there
 * is nothing to orbit and the timeline has not been built yet.
 */
export function FreeLookToggle() {
  const freeLook = useSceneStore((s) => s.freeLook)
  const modelReady = useSceneStore((s) => s.modelReady)
  const toggleFreeLook = useSceneStore((s) => s.toggleFreeLook)

  if (!modelReady) return null

  return (
    <>
      <div className="fixed top-5 right-5 z-30 md:top-6 md:right-6">
        <button
          type="button"
          onClick={toggleFreeLook}
          aria-pressed={freeLook}
          title={freeLook ? 'Return to the scroll story (Esc)' : 'Look around the garage'}
          className={`flex items-center gap-2.5 rounded-full border px-4 py-2 font-mono text-[0.65rem] tracking-[0.18em] uppercase backdrop-blur-sm transition-colors focus-visible:ring-2 focus-visible:ring-stone-200 focus-visible:outline-none md:text-xs ${
            freeLook
              ? 'border-stone-100 bg-stone-100 text-stone-900'
              : 'border-stone-300/60 bg-black/30 text-stone-200 hover:border-stone-100 hover:text-stone-50'
          }`}
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${
              freeLook ? 'bg-stone-900' : 'bg-stone-400'
            }`}
          />
          {freeLook ? 'Exit 360°' : '360° View'}
        </button>
      </div>

      {/* Legend. Sits bottom-centre so it clears both the copy column and the
          progress rail, and never eats a drag. */}
      <div
        aria-hidden={!freeLook}
        className={`pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-6 transition-opacity duration-300 ${
          freeLook ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <p className="rounded-full border border-stone-300/25 bg-black/40 px-4 py-2 text-center font-mono text-[0.6rem] tracking-[0.15em] text-stone-300 uppercase backdrop-blur-sm md:text-[0.65rem]">
          Drag to look · Scroll to zoom · Arrows to drive · Click door &amp; switches · Esc to exit
        </p>
      </div>
    </>
  )
}
