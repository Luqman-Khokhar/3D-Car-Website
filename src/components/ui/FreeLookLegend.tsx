import { useSceneStore } from '@/store/useSceneStore'
import { useCoarsePointer } from '@/hooks/useCoarsePointer'
import { HUD_PANEL } from './hud'

/**
 * Control legend for free look. Bottom-centre so it clears both the copy column
 * and the chapter rail, and never eats a drag.
 *
 * Touch gets its own wording and sits higher, above the drive pad: there is no
 * keyboard, no Esc, and "click" is the wrong verb.
 */
export function FreeLookLegend() {
  const freeLook = useSceneStore((s) => s.freeLook)
  const robotMode = useSceneStore((s) => s.robotMode)
  const touch = useCoarsePointer()

  const text = touch
    ? robotMode
      ? 'Drag to look · Pinch to zoom · Tap 360° to exit'
      : 'Drag to look · Pinch to zoom · Pads to drive · Tap door & switches'
    : robotMode
      ? 'Drag to look · Scroll to zoom · The robot does not drive · Esc to exit'
      : 'Drag to look · Scroll to zoom · Arrows / WASD to drive · Click door & switches · Esc to exit'

  return (
    <div
      aria-hidden={!freeLook}
      className={`pointer-events-none fixed inset-x-0 z-30 flex justify-center px-6 transition-opacity duration-300 ${
        touch && !robotMode ? 'bottom-[calc(11rem+env(safe-area-inset-bottom))]' : 'bottom-6'
      } ${freeLook ? 'opacity-100' : 'opacity-0'}`}
    >
      <p
        className={`${HUD_PANEL} px-4 py-2 text-center font-mono text-[0.6rem] tracking-[0.15em] text-stone-300 uppercase md:text-[0.65rem]`}
      >
        {text}
      </p>
    </div>
  )
}
