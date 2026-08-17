import { useSceneStore } from '@/store/useSceneStore'
import { BODY_SWATCHES } from '@/scenes/palette'

/**
 * Bottom-left swatch row for the paint scene. Visible for the whole scroll
 * story so the pick is available from the start, not just once scrolled
 * down to the paint scene.
 *
 * Hidden entirely in free look: there is no scroll position to gate on there,
 * and the legend in FreeLookToggle already owns that bottom-of-screen slot.
 */
export function PaintPicker() {
  const modelReady = useSceneStore((s) => s.modelReady)
  const freeLook = useSceneStore((s) => s.freeLook)
  const selectedBodyColor = useSceneStore((s) => s.selectedBodyColor)
  const setBodyColor = useSceneStore((s) => s.setBodyColor)

  const visible = modelReady && !freeLook

  if (!visible) return null

  return (
    <div className="fixed bottom-6 left-6 z-30 flex items-center gap-2.5 rounded-full border border-stone-300/60 bg-black/30 px-3 py-2 backdrop-blur-sm">
      {BODY_SWATCHES.map((swatch) => {
        const selected = swatch.hex === selectedBodyColor
        return (
          <button
            key={swatch.hex}
            type="button"
            onClick={() => setBodyColor(swatch.hex)}
            aria-pressed={selected}
            aria-label={`Paint the car ${swatch.name}`}
            title={swatch.name}
            className={`h-6 w-6 shrink-0 rounded-full transition-transform focus-visible:ring-2 focus-visible:ring-stone-200 focus-visible:outline-none ${
              selected
                ? 'scale-110 ring-2 ring-stone-100 ring-offset-2 ring-offset-black/30'
                : 'hover:scale-105'
            }`}
            style={{ backgroundColor: swatch.hex }}
          />
        )
      })}
    </div>
  )
}
