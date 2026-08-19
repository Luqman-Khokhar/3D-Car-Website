import { Box3, Euler, Vector3 } from 'three'
import type { Mesh, Object3D } from 'three'
import type { Vec3 } from '@/scenes/carParts'
import type { RobotBone } from '@/scenes/robotParts'

/**
 * Uniform shrink applied to the whole figure.
 *
 * The pose below is authored at "true" robot size, which stands 4.24 m to the tip
 * of the head crest. The garage is ROOM_HEIGHT = 4.2 m with ceiling tubes hanging
 * off that, so at 1.0 the head is inside the light fittings. Scaling about the
 * origin is safe because the feet sit on y = 0 — they stay on the floor. 0.84 puts
 * the figure at 3.56 m, which clears the tubes from every orbit angle.
 */
export const ROBOT_SCALE = 0.84

/**
 * Where one car panel ends up on the robot.
 *
 * `centre` is the world position of the panel's *geometry centre*, not of its
 * group origin. Car parts are authored with their origin at the car's centre
 * (chassis and body_shell literally are, and the rest are offset from it), so
 * rotating a group by 90 degrees swings its mass metres away from where a naive
 * position value would put it. Working in centres and solving for the group
 * position — see `partRobotTransform` — is what keeps these numbers readable and
 * lets them be checked against the anatomy comment below.
 *
 * `scale` is a fold cheat, and a deliberate one. A car is 4.4 m long and a robot
 * is 1.9 m across the shoulders; real Transformers geometry collapses along its
 * length, which is a thing rigid primitives cannot do. Compressing the long
 * panels along their length while they rotate reads as exactly that collapse, and
 * the alternative is a robot with a 4 m plank for a back.
 */
export interface PartPose {
  /** Absolute euler in the car group's frame. */
  rot: Vec3
  /** Per-axis fold, applied before `rot`. Defaults to no fold. */
  scale?: Vec3
  centre: Vec3
}

/**
 * Anatomy, robot space, before ROBOT_SCALE. Feet on y = 0, facing +Z.
 *
 *   foot ............ 0.00 .. 0.22
 *   shin ............ 0.29 .. 1.15   rear wheels on the outside of it
 *   knee ............ 1.20
 *   thigh ........... 1.20 .. 2.00
 *   pelvis .......... 1.94 .. 2.30
 *   belt ............ 2.03 .. 2.32   front bumper
 *   torso ........... 2.40 .. 3.32
 *   chest ........... 2.31 .. 3.25   hood, with the windscreen inset in it
 *   collar .......... 3.16 .. 3.44   the chest plate stops under it on purpose
 *   shoulders ....... 3.24            front wheels outboard at x 1.08
 *   neck ............ 3.24 .. 3.60   overlaps collar and head at both ends
 *   head ............ 3.50 .. 3.98   helmet crown and crest to 4.24
 *
 * Every panel keeps the job it had on the car wherever that was possible: the
 * hood is still the front of the thing, the windscreen is still glass you look
 * through, the headlamps are still the face, and the wheels are still on the
 * outside of the limbs that move.
 */
export const ROBOT_PART_POSES: Record<string, PartPose> = {
  // --- Torso ---------------------------------------------------------------
  // Underbody becomes the spine. Rotated -90 about X so the floor pan faces
  // backwards and the nose end points up, which puts the radiator and fan at the
  // top of the backpack where a vent belongs.
  chassis: { rot: [-Math.PI / 2, 0, 0], scale: [0.72, 1, 0.34], centre: [0, 3.1, -0.62] },
  // Rockers, wings and quarters stand up as the torso cage. Folded hard along its
  // length (4 m of car flank) and pulled in across the beam so the arms clear it.
  body_shell: { rot: [-Math.PI / 2, 0, 0], scale: [0.66, 0.85, 0.26], centre: [0, 2.86, -0.04] },
  // Engine in the chest, upright and unrotated — the one part that needs no
  // reinterpretation at all.
  engine_block: { rot: [0, 0, 0], scale: [0.66, 0.85, 0.66], centre: [0, 2.7, -0.02] },
  // Hood swings up into the chest plate. +90 about X points its thin axis at +Z,
  // so the panel faces front and its 1.21 m length runs down the torso.
  // Folded to 78% of its length as well as pulled in across the beam: at full
  // length the chest plate ran from the waist to over the collar, which buried the
  // shoulder line and left the head looking stuck straight onto the chest.
  hood: { rot: [Math.PI / 2, 0, 0], scale: [0.68, 1, 0.78], centre: [0, 2.78, 0.4] },
  // Windscreen sits proud of the hood as the chest glass. Cut down to a pane
  // rather than left full size — a 1.5 m sheet of glass across the whole chest
  // reads as a windscreen someone has leant against a robot, and it let the hood's
  // extraction vents show through it as a second pair of eyes.
  windshield: { rot: [Math.PI / 2, 0, 0], scale: [0.6, 1, 0.55], centre: [0, 2.98, 0.52] },
  // Tail lamp bar becomes the chest light. The transform timeline drives
  // lightingState.rearGlow up, so it is actually lit rather than a red decal.
  lamps_rear: { rot: [0, 0, 0], scale: [0.42, 1.1, 1], centre: [0, 2.45, 0.5] },
  // --- Waist and hips ------------------------------------------------------
  // Front bumper reads as a belt: a full-width bar with a grille in the middle of
  // it, which is what a belt buckle looks like.
  bumper_F: { rot: [0, 0, 0], scale: [0.64, 1, 1], centre: [0, 2.18, 0.22] },
  // Seats, console and dash collapse into the hip internals. Mostly hidden by the
  // pelvis bone; what shows through the gaps is upholstery and mechanism, which is
  // the right thing to see inside a hip.
  interior_seats: { rot: [0, 0, 0], scale: [0.5, 0.55, 0.6], centre: [0, 2.1, -0.12] },
  // Boot lid stands up behind the hips as the rear skirt, ducktail lip and all.
  trunk: { rot: [Math.PI / 2, 0, 0], scale: [0.72, 1, 1], centre: [0, 2.02, -0.5] },
  // --- Back ----------------------------------------------------------------
  // Doors sweep up and out off the backplate as wings. Euler XYZ applies Y first,
  // so Y swings the door's long axis outboard and X then tips it up and back:
  // the resulting axis is roughly (0.44, 0.82, -0.38) per side.
  door_L: { rot: [-2.0, -0.45, 0], centre: [-0.72, 3.6, -0.78] },
  door_R: { rot: [-2.0, 0.45, 0], centre: [0.72, 3.6, -0.78] },
  // Roof folds down onto the upper back, behind the shoulders and under the door
  // wings — where a car's roof panel almost always ends up on a Transformer.
  //
  // It was the helmet for two passes and it never worked. The roof's bounding box
  // is dominated by the side glazing and the C-pillars rather than by the crown, so
  // centring it on the head put the crown above the skull and left glass hanging
  // down both sides: a small car cab balanced on a robot. The helmet is modelled on
  // head_core in robotParts.ts instead, and the roof does the job it can do.
  roof: { rot: [-0.35, 0, 0], scale: [0.6, 1, 0.34], centre: [0, 3.3, -1.02] },
  // Rear bumper's diffuser strakes make the mouthplate. Nothing else on the car
  // has a row of vertical slats that size.
  //
  // Folded to 22% of the car's 1.88 m beam, not the 32% of the first pass: at that
  // size the mouthplate was wider than the skull it was bolted to and stood a hand's
  // width proud of it, so the face read as a red brick with a visor above it rather
  // than as a face at all.
  bumper_R: { rot: [0, 0, 0], scale: [0.22, 0.7, 0.5], centre: [0, 3.62, 0.22] },
  // Headlamps stay the face, which is the only assignment on this list that was
  // never in question. Two projector bowls per side become one compound eye per
  // side, and useLampPass' emissive gain lights them.
  lamps_front: { rot: [0, 0, 0], scale: [0.34, 0.95, 0.95], centre: [0, 3.8, 0.24] },
  // --- Wheels --------------------------------------------------------------
  // Front pair onto the shoulders, rear pair onto the calves — outboard of the
  // limb in both cases, so the tread and the rim faces stay the visible side.
  // Camber is dropped: a robot standing still has no suspension geometry.
  wheel_FL: { rot: [0, 0, 0], centre: [-1.08, 3.2, -0.04] },
  wheel_FR: { rot: [0, 0, 0], centre: [1.08, 3.2, -0.04] },
  wheel_RL: { rot: [0, 0, 0], centre: [-0.74, 0.7, -0.02] },
  wheel_RR: { rot: [0, 0, 0], centre: [0.74, 0.7, -0.02] },
}

const NO_SCALE: Vec3 = [1, 1, 1]

const box = new Box3()

/**
 * Union of a part group's own mesh geometries, in the group's local frame.
 *
 * The meshes PartGroup renders carry no transform of their own — mergePart bakes
 * every primitive's offset into the vertices — so a geometry bounding box is
 * already in group space and no matrix walk is needed.
 */
function localCentre(object: Object3D): Vector3 {
  box.makeEmpty()
  for (const child of object.children) {
    const mesh = child as Mesh
    if (!mesh.isMesh) continue
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    if (mesh.geometry.boundingBox) box.union(mesh.geometry.boundingBox)
  }
  return box.isEmpty() ? new Vector3() : box.getCenter(new Vector3())
}

export interface Placement {
  position: Vector3
  rotation: Vec3
  scale: Vector3
}

/**
 * Solves a pose's `centre` back into the group position three.js needs.
 *
 * A group applies scale, then rotation, then translation, so the geometry centre
 * lands at `position + rot * (scale * localCentre)`. Rearranged, the position is
 * the wanted centre minus that offset.
 */
export function partRobotTransform(object: Object3D, pose: PartPose): Placement {
  const [sx, sy, sz] = pose.scale ?? NO_SCALE
  const scale = new Vector3(sx * ROBOT_SCALE, sy * ROBOT_SCALE, sz * ROBOT_SCALE)
  const offset = localCentre(object).multiply(scale).applyEuler(new Euler(...pose.rot))
  const position = new Vector3(...pose.centre).multiplyScalar(ROBOT_SCALE).sub(offset)
  return { position, rotation: pose.rot, scale }
}

/** Bones are authored centred on their own origin, so `pos` needs no correction. */
export function boneRobotPosition(bone: RobotBone): Vector3 {
  return new Vector3(...bone.pos).multiplyScalar(ROBOT_SCALE)
}

/**
 * Where a bone waits while the car is a car: collapsed to nothing, pulled in
 * toward the centre of the floor pan and low down.
 *
 * Not the origin, and not the bone's own position either. Extending from a point
 * that is inboard of and below the final one makes the limb read as telescoping
 * out of the body; extending in place just makes it swell.
 */
export function boneStowPosition(bone: RobotBone): Vector3 {
  return new Vector3(bone.pos[0] * 0.22, 0.62, bone.pos[2] * 0.25)
}

/** Scale a stowed bone renders at. Not zero: a zero scale has no orientation for
 *  the normals and three logs a degenerate-matrix warning on the shadow pass. */
export const BONE_STOW_SCALE = 0.001
