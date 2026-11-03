import { useSceneStore } from '@/store/useSceneStore'
import { BODY_SWATCHES } from '@/scenes/palette'
import { HUD_PANEL } from './hud'

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
  const selectedName = BODY_SWATCHES.find((swatch) => swatch.hex === selectedBodyColor)?.name

  if (!visible) return null

  return (
    <div
      role="group"
      aria-label="Paint colour"
      className={`${HUD_PANEL} fixed bottom-5 left-5 z-30 flex items-center gap-2 py-1.5 pr-4 pl-2 md:bottom-6 md:left-6`}
    >
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
            className={`h-7 w-7 shrink-0 rounded-full border border-white/15 transition-transform duration-200 ease-out focus-visible:ring-2 focus-visible:ring-stone-200 focus-visible:outline-none active:scale-95 ${
              selected
                ? 'scale-105 ring-2 ring-stone-100 ring-offset-2 ring-offset-black/30'
                : 'hover:scale-110'
            }`}
            style={{ backgroundColor: swatch.hex }}
          />
        )
      })}
      {/* The name, not just the chip: "Nero" and "Blu" are two near-blacks on a
          dark tray, and colour alone must not carry the selection. */}
      <span aria-live="polite" className="ml-1 min-w-[3.5rem] font-mono text-[0.65rem] tracking-[0.18em] text-stone-200 uppercase">
        {selectedName}
      </span>
    </div>
  )
}
