import { useSceneStore } from '@/store/useSceneStore'

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
  const modelReady = useSceneStore((s) => s.modelReady)
  const toggleRobotMode = useSceneStore((s) => s.toggleRobotMode)

  if (!modelReady) return null

  return (
    <div className="fixed top-[4.25rem] right-5 z-30 md:top-[4.75rem] md:right-6">
      <button
        type="button"
        onClick={toggleRobotMode}
        aria-pressed={robotMode}
        disabled={transforming}
        title={
          robotMode
            ? 'Fold the robot back into the car'
            : 'Stand the car up as an Autobot — 360 view, no driving'
        }
        className={`flex items-center gap-2.5 rounded-full border px-4 py-2 font-mono text-[0.65rem] tracking-[0.18em] uppercase backdrop-blur-sm transition-colors focus-visible:ring-2 focus-visible:ring-stone-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 md:text-xs ${
          robotMode
            ? 'border-amber-200 bg-amber-200 text-stone-900'
            : 'border-stone-300/60 bg-black/30 text-stone-200 hover:border-amber-200 hover:text-amber-100'
        }`}
      >
        {/* Colour alone must not carry the state, so the dot is paired with the
            label changing and with aria-pressed. */}
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${
            robotMode ? 'bg-stone-900' : 'bg-amber-300'
          }`}
        />
        {transforming ? 'Transforming' : robotMode ? 'Back to car' : 'Transform'}
      </button>
    </div>
  )
}
