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
}

export const paintState: PaintState = { progress: 0 }

export function resetPaintState() {
  paintState.progress = 0
}
