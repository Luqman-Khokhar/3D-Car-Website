import { useSceneStore } from '@/store/useSceneStore'
import { HUD_PILL, HUD_PRESS } from './hud'

/**
 * The one button that folds the car into the robot and folds it back.
 *
 * Sits directly under the 360 toggle because pressing it turns free look on: the
 * robot is orbited, never driven, and free look is the mode that locks page
 * scroll — which the fold needs, since it writes the same part transforms the
 * scrubbed assembly timeline owns.
 *
 * Disabled while `transforming`. Reversing a half-played fold is fine and is
 * exactly what the change-back does, but starting a second fold on top of one in
 * flight would record a mid-air pose as its start values and the panels would
 * never find their way back to the car.
 */
export function TransformToggle() {
  const robotMode = useSceneStore((s) => s.robotMode)
  const transforming = useSceneStore((s) => s.transforming)
  const toggleRobotMode = useSceneStore((s) => s.toggleRobotMode)

  return (
    <button
      type="button"
      onClick={toggleRobotMode}
      aria-pressed={robotMode}
      aria-busy={transforming}
      disabled={transforming}
      title={
        robotMode
          ? 'Fold the robot back into the car'
          : 'Stand the car up as an Autobot — 360 view, no driving'
      }
      className={`${HUD_PILL} ${HUD_PRESS} w-full justify-center disabled:cursor-wait disabled:opacity-70 ${
        robotMode
          ? 'border-amber-200 bg-amber-200 text-stone-900'
          : 'border-stone-300/50 bg-black/35 text-stone-200 hover:border-amber-200 hover:text-amber-100'
      }`}
    >
      {/* Colour alone must not carry the state, so the dot is paired with the
          label changing and with aria-pressed. It pulses while the fold runs,
          so the disabled state reads as busy rather than broken. */}
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${robotMode ? 'bg-stone-900' : 'bg-amber-300'} ${
          transforming ? 'animate-pulse motion-reduce:animate-none' : ''
        }`}
      />
      {transforming ? 'Transforming' : robotMode ? 'Back to car' : 'Transform'}
    </button>
  )
}
