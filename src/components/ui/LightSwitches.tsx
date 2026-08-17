import { useSceneStore, LIGHT_SWITCH_GROUPS } from '@/store/useSceneStore'
import type { LightSwitchGroup } from '@/store/useSceneStore'

const LABELS: Record<LightSwitchGroup, string> = {
  ceiling: 'Ceiling',
  spot: 'Spot',
  headlamps: 'Lamps',
}

const TITLES: Record<LightSwitchGroup, string> = {
  ceiling: 'Ceiling fluorescents + room fill',
  spot: 'Overhead work spotlight',
  headlamps: "Car's own headlights and tail lamps",
}

/**
 * Three physical switches for the garage's light circuits, stacked under the
 * scroll speed picker.
 *
 * Each click cycles auto → on → off → auto. `auto` is the default and leaves the
 * circuit on the scroll-scrubbed atmosphere (see lightingState) exactly as
 * before this existed; `on`/`off` is a manual throw that GarageLights eases
 * toward and which then wins over the scroll position and free look both, so it
 * survives scrubbing back through a scene or orbiting in 360°. The choice is
 * mirrored to localStorage per switch, so it survives a reload too.
 *
 * Left unconditionally visible (including in free look) — unlike ScrollSpeedPicker,
 * these do not depend on scroll being live to mean something.
 */
export function LightSwitches() {
  const modelReady = useSceneStore((s) => s.modelReady)
  const lightSwitches = useSceneStore((s) => s.lightSwitches)
  const cycleLightSwitch = useSceneStore((s) => s.cycleLightSwitch)

  if (!modelReady) return null

  return (
    <div className="fixed top-[7.75rem] right-5 z-30 flex flex-col gap-1.5 md:top-[8.25rem] md:right-6">
      {LIGHT_SWITCH_GROUPS.map((group) => {
        const state = lightSwitches[group]
        return (
          <button
            key={group}
            type="button"
            onClick={() => cycleLightSwitch(group)}
            aria-pressed={state === 'on'}
            title={`${TITLES[group]} — ${state}`}
            className={`flex items-center gap-2.5 rounded-full border px-4 py-1.5 font-mono text-[0.65rem] tracking-[0.18em] uppercase backdrop-blur-sm transition-colors focus-visible:ring-2 focus-visible:ring-stone-200 focus-visible:outline-none md:text-xs ${
              state === 'on'
                ? 'border-stone-100 bg-stone-100 text-stone-900'
                : state === 'off'
                  ? 'border-stone-300/60 bg-black/50 text-stone-500'
                  : 'border-stone-300/60 bg-black/30 text-stone-200 hover:border-stone-100 hover:text-stone-50'
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${
                state === 'on' ? 'bg-stone-900' : state === 'off' ? 'bg-stone-600' : 'bg-stone-400'
              }`}
            />
            {LABELS[group]}
            <span className="text-[0.55rem] opacity-70 md:text-[0.6rem]">{state}</span>
          </button>
        )
      })}
    </div>
  )
}
