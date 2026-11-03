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

/**
 * Output of each ceiling-tube row (back, mid, front), 0..1, after the scroll
 * atmosphere and the wall switches have both had their say. Written by
 * GarageLights every frame; read by the area lights in CeilingStrips, which live
 * in their own chunk and so cannot share GarageLights' refs.
 */
export const stripRowLevel: [number, number, number] = [1, 1, 1]

/** Ceiling strip fixture grid, mirroring `ceilingLights()` in
 *  src/scenes/garage.ts and `LAMP_X`/`LAMP_Z` in GarageEnvironment.tsx — all
 *  three have to stay in step so every tube the viewer sees overhead is one
 *  that actually lights the floor beneath it. */
export const STRIP_X = [-3.4, 1.6]
export const STRIP_Z = [-4.6, 1.4, 6.2]
/** Area-light intensity of one strip at full output. */
export const STRIP_INTENSITY = 22

export function resetLightingState() {
  lightingState.dim = 0
  lightingState.rearGlow = 0
  lightingState.frontGlow = 0
}
