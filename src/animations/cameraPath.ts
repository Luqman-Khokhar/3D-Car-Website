import { SECTIONS } from '@/store/useSceneStore'
import type { SectionId } from '@/store/useSceneStore'

/**
 * Camera keyframes in polar coordinates around a look-at target.
 *
 * Cartesian keyframes would make the camera cut straight through the car when
 * two scenes sit on opposite sides of it — lerping [5,y,5] to [-5,y,5] passes
 * through the origin. Orbiting in `theta` keeps the camera on an arc instead,
 * and it makes the reveal orbit fall out for free: just tween theta past 2*PI.
 *
 * theta is measured from +Z (the car's nose) toward +X:
 *   x = tx + radius * sin(theta)
 *   z = tz + radius * cos(theta)
 */
export interface CameraKey {
  theta: number
  radius: number
  height: number
  /** Look-at point. */
  tx: number
  ty: number
  tz: number
}

export const CAMERA_KEYS: Record<SectionId, CameraKey> = {
  // Far and low: the car reads as a silhouette against the tool wall.
  // NOTE: radius and height are bounded by the garage shell — the camera lives
  // inside the room now, so anything past ROOM_HALF_X/Z or ROOM_HEIGHT punches
  // through a wall. See src/scenes/garage.ts.
  hero: { theta: 0.62, radius: 8.2, height: 1.5, tx: 0, ty: 0.7, tz: 0 },
  // Pull up and back for a wide establishing view of the whole bay.
  'raw-materials': { theta: 0.88, radius: 9.0, height: 3.1, tx: 0, ty: 0.4, tz: 0 },
  // Drop to axle height, close, raking along the bare frame.
  chassis: { theta: 0.72, radius: 5.2, height: 0.95, tx: 0, ty: 0.45, tz: 0 },
  // Swing toward the nose and climb, so the block drops toward the camera.
  engine: { theta: 0.95, radius: 3.8, height: 2.3, tx: 0, ty: 0.7, tz: 1.05 },
  // Back off to full-body framing while panels fly in.
  'body-panels': { theta: 1.15, radius: 6.4, height: 1.9, tx: 0, ty: 0.75, tz: 0 },
  // Dead astern, at lamp height. theta = PI puts the camera on -Z looking back up
  // the car, which is the only angle where both tail clusters are square-on and
  // the same size — off-axis, the near lens dominates and the far one foreshortens
  // into a smear. Target is pulled back to z -1.0 so the tail fills the frame
  // rather than sitting in the middle of a full side profile.
  'tail-lamps': { theta: Math.PI, radius: 4.3, height: 1.05, tx: 0, ty: 0.82, tz: -1.0 },
  // Dead ahead. 2*PI rather than 0 so the swing from the tail keeps turning the
  // same way instead of unwinding back past the flank it just came from — every
  // key after this carries the same extra turn, see the offsets below.
  //
  // Lower and closer than the rear: the headlights are the face, and a face reads
  // at eye level. Height 0.86 sits just above the lamp centreline at 0.75.
  'head-lamps': { theta: Math.PI * 2, radius: 4.0, height: 0.86, tx: 0, ty: 0.76, tz: 0.95 },
  // Near-broadside flank: maximum painted surface on screen. Radius has to clear
  // the 4.25 m length at fov 38 with the frame bias applied, or the car crops.
  paint: { theta: Math.PI * 2 + 1.5, radius: 6.5, height: 1.15, tx: 0, ty: 0.72, tz: 0 },
  // Over the cowl, looking down into the cabin.
  interior: { theta: Math.PI * 2 + 0.55, radius: 3.2, height: 2.1, tx: 0, ty: 0.9, tz: -0.15 },
  // Near ground level at the front arch to catch the wheels rolling in.
  wheels: { theta: Math.PI * 2 + 1.05, radius: 4.2, height: 0.55, tx: 0, ty: 0.38, tz: 0.5 },
  // Full 360 orbit: previous theta plus a complete turn.
  reveal: { theta: Math.PI * 4 + 1.05, radius: 7.0, height: 1.6, tx: 0, ty: 0.7, tz: 0 },
}

/**
 * Live camera state. The GSAP timeline tweens this object's numbers and
 * CameraRig reads it in useFrame, so scroll never triggers a React render.
 */
export const cameraState: CameraKey = { ...CAMERA_KEYS.hero }

export function resetCameraState() {
  Object.assign(cameraState, CAMERA_KEYS.hero)
}

/** Timeline position (in seconds, 1 per scene) at which a scene is fully reached. */
export function sceneTime(id: SectionId) {
  return SECTIONS.indexOf(id)
}
