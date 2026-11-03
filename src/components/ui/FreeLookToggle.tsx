import { useSceneStore } from '@/store/useSceneStore'
import { HUD_PILL, HUD_PILL_IDLE, HUD_PRESS } from './hud'

/**
 * Switch into free look. Lives at the top of HudControls' stack; the control
 * legend that replaces the scroll cue while the mode is on is FreeLookLegend.
 *
 * HudControls only mounts once modelReady, so this cannot be armed over the
 * loading screen, where there is nothing to orbit and the timeline has not been
 * built yet.
 */
export function FreeLookToggle() {
  const freeLook = useSceneStore((s) => s.freeLook)
  const toggleFreeLook = useSceneStore((s) => s.toggleFreeLook)

  return (
    <button
      type="button"
      onClick={toggleFreeLook}
      aria-pressed={freeLook}
      aria-keyshortcuts={freeLook ? 'Escape' : undefined}
      title={freeLook ? 'Return to the scroll story (Esc)' : 'Look around the garage'}
      className={`${HUD_PILL} ${HUD_PRESS} w-full justify-center ${
        freeLook ? 'border-stone-100 bg-stone-100 text-stone-900' : HUD_PILL_IDLE
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${freeLook ? 'bg-stone-900' : 'bg-stone-400'}`}
      />
      {freeLook ? 'Exit 360°' : '360° View'}
    </button>
  )
}
