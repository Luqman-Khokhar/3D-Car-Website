/**
 * Frame scheduling for the on-demand render loop.
 *
 * The canvas runs `frameloop="demand"`: nothing is drawn unless something asks
 * for a frame. Reading the copy with the scroll at rest therefore costs zero GPU,
 * where it used to redraw the whole garage — shadows, post chain and all — sixty
 * times a second for a picture that was not changing.
 *
 * Kept free of three and R3F imports on purpose so the store and the DOM layer
 * (which ship in the entry chunk, ahead of the WebGL bundle) can request frames
 * too. RenderDriver binds the real `invalidate` once the canvas is up.
 */
let invalidate: (() => void) | null = null

export function bindInvalidate(fn: (() => void) | null) {
  invalidate = fn
}

/** Ask for one more frame. Safe to call before the canvas exists, and cheap to
 *  call many times per frame — R3F coalesces them. */
export function requestFrame() {
  invalidate?.()
}

/**
 * Bumped by RenderDriver whenever anything that casts a shadow has moved: the
 * scrubbed assembly, the robot fold, or the car being driven. The spotlight's
 * shadow map and the contact shadow both re-render only when this changes, so
 * orbiting a parked car, fading a light or opening the door no longer re-renders
 * either of them every frame.
 */
export const carMotion = { version: 0 }
