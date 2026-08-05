import { Color } from 'three'
import { BODY } from '@/scenes/palette'

/**
 * Live paint state, mirroring the `cameraState` pattern in cameraPath.ts.
 *
 * A single scalar rather than a tweened colour: GSAP interpolates colour strings
 * only through CSSPlugin, which does not apply to plain objects or three
 * materials. Tweening 0..1 and lerping the colour ourselves in the frame loop is
 * both scrub-deterministic and cheaper — one Color.lerpColors per frame instead
 * of a string parse.
 *
 * Read by usePaintPass inside useFrame, so scrubbing the paint scene never
 * triggers a React render.
 */
export interface PaintState {
  /** 0 = bare primer, 1 = final base coat under full clearcoat. */
  progress: number
  /** Lerp target for `progress === 1`. Mutated in place by setPaintTarget so the
   *  Color instance stays stable — usePaintPass lerps into it every frame. */
  targetColor: Color
  /** Bumped by setPaintTarget. progress alone does not change when the user
   *  picks a new colour after the scrub has already settled at 1, so
   *  usePaintPass needs a second signal to know it must repaint. */
  colorGeneration: number
}

export const paintState: PaintState = {
  progress: 0,
  targetColor: new Color(BODY),
  colorGeneration: 0,
}

export function resetPaintState() {
  paintState.progress = 0
}

/** Selecting a swatch. Does not touch progress — a pick before scene 05 simply
 *  changes what the car paints toward, a pick after it repaints in place. */
export function setPaintTarget(hex: string) {
  paintState.targetColor.set(hex)
  paintState.colorGeneration++
}
