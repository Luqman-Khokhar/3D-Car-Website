import { useSceneStore } from '@/store/useSceneStore'
import { FreeLookToggle } from './FreeLookToggle'
import { TransformToggle } from './TransformToggle'
import { ScrollSpeedPicker } from './ScrollSpeedPicker'
import { FeatureHint } from './FeatureHint'

/**
 * Top-right control stack: 360° view, Transform, scroll pace.
 *
 * One container instead of three independently fixed elements at hand-tuned
 * `top-[7.5rem]`-style offsets, which drifted out of line whenever a label or a
 * breakpoint changed. A one-column grid sizes every pill to the widest, so the
 * stack reads as one panel. The coachmark hangs off the same container, beside
 * the button it names.
 *
 * Mounted only once the rig is ready — nothing here means anything over the
 * loading screen.
 */
export function HudControls() {
  const modelReady = useSceneStore((s) => s.modelReady)
  const freeLook = useSceneStore((s) => s.freeLook)
  const prefersReducedMotion = useSceneStore((s) => s.prefersReducedMotion)

  if (!modelReady) return null

  return (
    <nav
      aria-label="Scene controls"
      className="fixed top-5 right-5 z-30 grid w-max gap-2 md:top-6 md:right-6"
    >
      <FeatureHint />
      <FreeLookToggle />
      <TransformToggle />
      {/* Pace is meaningless while scroll is locked (free look) or when the
          browser owns scrolling outright (reduced motion). Faded rather than
          unmounted in free look so the stack does not jump. */}
      {!prefersReducedMotion && (
        <div
          aria-hidden={freeLook}
          className={`transition-opacity duration-300 ${freeLook ? 'invisible opacity-0' : 'opacity-100'}`}
        >
          <ScrollSpeedPicker />
        </div>
      )}
    </nav>
  )
}
