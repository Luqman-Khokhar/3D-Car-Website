/**
 * Live atmosphere state for the two lighting scenes, mirroring the `cameraState`
 * and `paintState` pattern.
 *
 * Plain scalars tweened by the master timeline and read inside useFrame, so
 * scrubbing the garage from lit to blacked-out never triggers a React render —
 * the same reason the camera and the paint pass are built this way.
 *
 * Kept as three independent channels rather than one "scene" enum because the
 * scenes overlap under scrub: the room is already on its way down while the tail
 * lamps are still coming up, and the tail lamps stay part-lit through the
 * headlight scene the way a real car's do.
 */
export interface LightingState {
  /**
   * 0 = full garage lighting, 1 = lights out.
   *
   * This is a fraction of the room's *existing* exposure rather than an absolute
   * level, so it scales the hemisphere/ambient/spot/area lights, the background
   * and fog colour, and the car's envMapIntensity together. Dimming the lights
   * alone leaves the car lit by IBL and it floats, brightly, in a black room.
   */
  dim: number
  /** Extra drive on the tail cluster above its always-on baseline, 0..1. */
  rearGlow: number
  /** Same for the headlights. Also gates the two forward beam spotlights. */
  frontGlow: number
}

export const lightingState: LightingState = {
  dim: 0,
  rearGlow: 0,
  frontGlow: 0,
}

/**
 * Darkness the room actually renders with, as opposed to `dim`'s scroll-scrubbed
 * value alone. Mirrors `dim` unless a wall switch is thrown, in which case the
 * switch wins outright — same override rule GarageLights already applies to the
 * ceiling strips. Written once per frame by GarageLights, the only place that
 * knows both the scroll value and the switch state; read by NightPass so the
 * background/fog colour never disagrees with a room the switches put dark.
 */
export const roomDim = { value: 0 }

export function resetLightingState() {
  lightingState.dim = 0
  lightingState.rearGlow = 0
  lightingState.frontGlow = 0
}
