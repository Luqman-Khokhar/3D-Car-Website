import { ROBOT_BONES } from '@/scenes/robotParts'
import { getPart } from './partRegistry'
import { getBone } from './boneRegistry'
import { driveState } from './driveState'
import { lightingState } from './lightingState'
import {
  ROBOT_PART_POSES,
  ROBOT_SCALE,
  boneRobotPosition,
  partRobotTransform,
} from './robotPose'

/**
 * Panels are heavy and hinge on real pivots, so they move on an in-out curve.
 * Bones are hydraulics — they overshoot and settle, which is the whole reason the
 * limbs read as *deploying* rather than as growing.
 */
const PANEL_EASE = 'power2.inOut'
const BONE_EASE = 'back.out(1.25)'

/**
 * Beat sheet, in seconds. Order is the point: the figure has to stand up from the
 * ground before anything above the waist moves, or the panels are seen assembling
 * around a torso with nothing under it. Legs, then hips, then torso, then arms,
 * then head — the same order a person gets out of a chair.
 */
const BEATS = {
  settle: 0,
  calfWheels: 0.05,
  legs: 0.1,
  hips: 0.22,
  hipArmour: 0.28,
  torsoCore: 0.34,
  back: 0.38,
  chest: 0.46,
  arms: 0.52,
  shoulderWheels: 0.58,
  wings: 0.64,
  neck: 0.72,
  face: 0.86,
  glow: 1.05,
} as const

const BONE_GROUPS: Record<string, string[]> = {
  legs: [
    'foot_L',
    'foot_R',
    'shin_L',
    'shin_R',
    'knee_L',
    'knee_R',
    'thigh_L',
    'thigh_R',
  ],
  hips: ['pelvis', 'waist'],
  torsoCore: ['torso_core'],
  arms: [
    'collar',
    'shoulder_L',
    'shoulder_R',
    'upperarm_L',
    'upperarm_R',
    'elbow_L',
    'elbow_R',
    'forearm_L',
    'forearm_R',
    'hand_L',
    'hand_R',
  ],
  neck: ['neck', 'head_core'],
}

/** Per-item delay inside a beat, so a limb unfolds joint by joint. */
const STAGGER = 0.045

function posePart(tl: gsap.core.Timeline, id: string, at: number, duration: number) {
  const object = getPart(id)
  const pose = ROBOT_PART_POSES[id]
  if (!object || !pose) return

  const { position, rotation, scale } = partRobotTransform(object, pose)

  tl.to(
    object.position,
    { x: position.x, y: position.y, z: position.z, duration, ease: PANEL_EASE },
    at,
  )
  tl.to(
    object.rotation,
    { x: rotation[0], y: rotation[1], z: rotation[2], duration, ease: PANEL_EASE },
    at,
  )
  // Only the folded panels need it, and skipping the rest keeps ~40 tweens off the
  // timeline for no visual difference.
  if (scale.x !== 1 || scale.y !== 1 || scale.z !== 1) {
    tl.to(object.scale, { x: scale.x, y: scale.y, z: scale.z, duration, ease: PANEL_EASE }, at)
  }
}

function poseBones(
  tl: gsap.core.Timeline,
  group: keyof typeof BONE_GROUPS,
  at: number,
  duration: number,
) {
  BONE_GROUPS[group].forEach((id, index) => {
    const object = getBone(id)
    if (!object) return
    const bone = ROBOT_BONES.find((b) => b.id === id)
    if (!bone) return

    const start = at + index * STAGGER
    const target = boneRobotPosition(bone)

    // Absolute 0 rather than `at`, so the bones are already showing before the
    // assembly catch-up (which occupies the time before `at`) — at BONE_STOW_SCALE
    // there is nothing to see anyway, and putting it here means the matching
    // `visible: false` restore lands at the very start of the reverse. A
    // zero-duration set reverses cleanly, the same property the assembly timeline
    // leans on to un-install parts on the way back up the page.
    tl.set(object, { visible: true }, 0)
    tl.to(
      object.position,
      { x: target.x, y: target.y, z: target.z, duration, ease: BONE_EASE },
      start,
    )
    tl.to(
      object.scale,
      { x: ROBOT_SCALE, y: ROBOT_SCALE, z: ROBOT_SCALE, duration, ease: BONE_EASE },
      start,
    )
  })
}

/**
 * Appends the car-to-robot fold onto an existing timeline, starting at `at`.
 *
 * Written onto the caller's timeline rather than returned as a nested one on
 * purpose: a nested timeline carries its own paused state and its own playhead,
 * and getting those to agree with a parent that is going to be reversed is a
 * needless second thing to be wrong. Flat tweens have one playhead.
 *
 * Built with `to` tweens rather than `fromTo`, which is the opposite of the rule
 * buildAssemblyTimeline follows, and for the opposite reason: this is not
 * scrubbed. It is played forward once to transform and reversed once to change
 * back, so GSAP recording the live car pose as the start value is exactly what is
 * wanted — reversing then lands on the pose the scroll timeline actually left,
 * with no risk of a hardcoded "car" state disagreeing with it.
 *
 * Must be added while the car is assembled and while the assembly ScrollTrigger is
 * disabled; useRobotTransform owns both preconditions.
 */
export function addRobotFold(tl: gsap.core.Timeline, at: number) {
  const beat = (name: keyof typeof BEATS) => at + BEATS[name]

  // The robot cannot be driven, so it must not be standing wherever the car was
  // last steered to — the orbit clamps and the contact shadow are both written for
  // a subject at the garage origin. Rolled back rather than snapped, and
  // `returning` is cleared so ProceduralCar's own ease-home does not fight this.
  tl.set(driveState, { returning: false, speed: 0, steer: 0 }, at)
  tl.to(driveState, { x: 0, z: 0, yaw: 0, duration: 0.6, ease: 'power2.out' }, beat('settle'))

  posePart(tl, 'wheel_RL', beat('calfWheels'), 0.95)
  posePart(tl, 'wheel_RR', beat('calfWheels'), 0.95)

  poseBones(tl, 'legs', beat('legs'), 0.8)
  poseBones(tl, 'hips', beat('hips'), 0.7)

  posePart(tl, 'trunk', beat('hipArmour'), 0.9)
  posePart(tl, 'bumper_F', beat('hipArmour'), 0.9)
  posePart(tl, 'interior_seats', beat('hipArmour'), 0.9)

  poseBones(tl, 'torsoCore', beat('torsoCore'), 0.7)

  posePart(tl, 'chassis', beat('back'), 0.95)
  posePart(tl, 'body_shell', beat('back'), 0.95)

  posePart(tl, 'engine_block', beat('chest'), 0.9)
  posePart(tl, 'hood', beat('chest'), 0.9)
  posePart(tl, 'windshield', beat('chest'), 0.9)
  posePart(tl, 'lamps_rear', beat('chest'), 0.9)

  poseBones(tl, 'arms', beat('arms'), 0.85)

  posePart(tl, 'wheel_FL', beat('shoulderWheels'), 0.9)
  posePart(tl, 'wheel_FR', beat('shoulderWheels'), 0.9)

  posePart(tl, 'door_L', beat('wings'), 0.95)
  posePart(tl, 'door_R', beat('wings'), 0.95)

  poseBones(tl, 'neck', beat('neck'), 0.6)

  posePart(tl, 'roof', beat('face'), 0.7)
  posePart(tl, 'bumper_R', beat('face'), 0.7)
  posePart(tl, 'lamps_front', beat('face'), 0.7)

  // Eyes and chest bar come up last, once the head is on. `dim` is left alone:
  // the reveal scene has the garage fully lit, and useLampPass' emissive gain is
  // what makes a lamp read as switched on in a bright room — the beam spotlights
  // in GarageLights are multiplied by `dim`, so raising frontGlow here lights the
  // face without throwing headlight cones across the floor.
  tl.to(
    lightingState,
    { frontGlow: 1, rearGlow: 0.85, duration: 0.6, ease: 'power2.out' },
    beat('glow'),
  )
}
