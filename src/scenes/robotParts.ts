import type { MaterialKey, Primitive, Vec3 } from '@/scenes/carParts'

/**
 * The robot's internal structure — everything the car does not already carry.
 *
 * Eighteen rigid car parts cannot make a robot on their own: a car has no limbs,
 * no neck and no head, and none of the eighteen can be split because each is one
 * merged mesh per material. So the panels become armour (see
 * src/animations/robotPose.ts for where each one lands) and these bones supply
 * the skeleton underneath them — legs, arms, pelvis, torso spar, neck, head.
 *
 * Kept out of CAR_PARTS on purpose. That list is the GLB contract in
 * public/models/README.md, and the assembly timeline walks it: adding limbs there
 * would need a scroll scene to install them and would break a real model drop-in.
 *
 * Geometry is authored centred on each bone's own origin, so a bone's `pos` is
 * literally its group position — no centroid correction, unlike the car panels
 * whose origins sit at the car's centre.
 *
 * Coordinates are "robot space": feet on y = 0, facing +Z (the car's nose
 * direction), origin under the pelvis. ROBOT_SCALE in robotPose.ts shrinks the
 * whole figure to fit under the garage's 4.2 m ceiling.
 */
export interface RobotBone {
  id: string
  material: MaterialKey
  /** Group position in robot space. */
  pos: Vec3
  rot?: Vec3
  primitives: Primitive[]
}

/** Cylinder's local axis is +Y; roll it onto X so it reads as a hinge pin. */
const PIN: Vec3 = [0, 0, Math.PI / 2]

/** Half the stance, matching the pelvis yoke below. */
const LEG_X = 0.44
/** Shoulder-to-shoulder half span. Arms hang here and the front wheels mount
 *  outboard of them — see ROBOT_PART_POSES. */
const ARM_X = 0.8

/**
 * Painted plates on the outside of the limbs.
 *
 * They use the shared `bodyPaint` material, so the swatch picked in the paint
 * scene carries onto the robot: a chrome-and-steel figure standing next to a
 * bright red car reads as a different model, not as the same vehicle stood up.
 */
const armourPlate = (args: [number, number, number], position: Vec3): Primitive => ({
  kind: 'box',
  args,
  position,
  material: 'bodyPaint',
})

const foot = (side: number): RobotBone => ({
  id: side < 0 ? 'foot_L' : 'foot_R',
  material: 'trim',
  pos: [side * LEG_X, 0.11, 0.02],
  primitives: [
    { kind: 'box', args: [0.44, 0.22, 0.8], position: [0, 0, 0.07] },
    // Toe and heel in bare metal: a single slab reads as a brick, and the two
    // things that make a foot read as a foot are a toe that steps forward and a
    // heel that sticks out behind.
    { kind: 'box', args: [0.46, 0.11, 0.18], position: [0, -0.055, 0.48], material: 'rawMetal' },
    { kind: 'box', args: [0.2, 0.17, 0.2], position: [0, 0.06, -0.32], material: 'rawMetal' },
  ],
})

const shin = (side: number): RobotBone => ({
  id: side < 0 ? 'shin_L' : 'shin_R',
  material: 'rawMetal',
  pos: [side * LEG_X, 0.72, -0.02],
  primitives: [
    { kind: 'box', args: [0.32, 0.86, 0.42] },
    { kind: 'box', args: [0.36, 0.1, 0.44], position: [0, 0.4, 0] },
    // Ankle pin, exposed under the shin.
    {
      kind: 'cylinder',
      args: [0.1, 0.1, 0.26, 16],
      position: [0, -0.44, 0],
      rotation: PIN,
      material: 'chrome',
    },
    armourPlate([0.26, 0.6, 0.07], [0, 0.02, 0.22]),
  ],
})

const knee = (side: number): RobotBone => ({
  id: side < 0 ? 'knee_L' : 'knee_R',
  material: 'chrome',
  pos: [side * LEG_X, 1.2, 0],
  primitives: [
    { kind: 'cylinder', args: [0.17, 0.17, 0.34, 20], rotation: PIN },
    // Kneecap, proud of the joint so the leg has a front rather than a barrel.
    armourPlate([0.28, 0.22, 0.09], [0, 0.02, 0.18]),
  ],
})

const thigh = (side: number): RobotBone => ({
  id: side < 0 ? 'thigh_L' : 'thigh_R',
  material: 'rawMetal',
  pos: [side * LEG_X, 1.6, -0.01],
  primitives: [
    { kind: 'box', args: [0.36, 0.8, 0.46] },
    {
      kind: 'cylinder',
      args: [0.18, 0.18, 0.36, 20],
      position: [0, 0.4, 0],
      rotation: PIN,
      material: 'chrome',
    },
    armourPlate([0.28, 0.56, 0.07], [0, 0, 0.25]),
  ],
})

const shoulder = (side: number): RobotBone => ({
  id: side < 0 ? 'shoulder_L' : 'shoulder_R',
  material: 'chrome',
  pos: [side * 0.88, 3.24, -0.02],
  primitives: [{ kind: 'cylinder', args: [0.21, 0.21, 0.36, 22], rotation: PIN }],
})

const upperArm = (side: number): RobotBone => ({
  id: side < 0 ? 'upperarm_L' : 'upperarm_R',
  material: 'rawMetal',
  pos: [side * ARM_X, 2.84, -0.02],
  primitives: [
    { kind: 'box', args: [0.32, 0.74, 0.36] },
    armourPlate([0.09, 0.58, 0.28], [side * 0.17, 0, 0]),
    // Front plate as well as the outboard one. With only the outboard plate the
    // arms are edge-on from the front and the whole limb reads as a stack of bare
    // grey blocks — which is exactly how the first pass looked.
    armourPlate([0.24, 0.56, 0.08], [0, 0, 0.2]),
  ],
})

const elbow = (side: number): RobotBone => ({
  id: side < 0 ? 'elbow_L' : 'elbow_R',
  material: 'chrome',
  pos: [side * ARM_X, 2.4, -0.02],
  primitives: [{ kind: 'cylinder', args: [0.15, 0.15, 0.32, 18], rotation: PIN }],
})

const forearm = (side: number): RobotBone => ({
  id: side < 0 ? 'forearm_L' : 'forearm_R',
  material: 'rawMetal',
  pos: [side * ARM_X, 2.02, -0.02],
  primitives: [
    { kind: 'box', args: [0.34, 0.7, 0.38] },
    // Wrist block, so the hand hangs off a joint rather than off a stump.
    { kind: 'box', args: [0.38, 0.16, 0.42], position: [0, -0.31, 0], material: 'trim' },
    armourPlate([0.09, 0.52, 0.3], [side * 0.17, 0.02, 0]),
    armourPlate([0.26, 0.5, 0.08], [0, 0.02, 0.21]),
  ],
})

const hand = (side: number): RobotBone => ({
  id: side < 0 ? 'hand_L' : 'hand_R',
  material: 'trim',
  pos: [side * ARM_X, 1.48, -0.02],
  primitives: [
    { kind: 'box', args: [0.34, 0.32, 0.4] },
    // Knuckles. Three ridges is the cheapest thing that turns a block into a
    // closed fist, and a fist is what reads at orbit distance.
    ...Array.from({ length: 3 }, (_, i): Primitive => ({
      kind: 'box',
      args: [0.32, 0.07, 0.07],
      position: [0, 0.1 - i * 0.1, 0.21],
      material: 'rawMetal',
    })),
    // Thumb, on the inboard face.
    { kind: 'box', args: [0.09, 0.11, 0.22], position: [-side * 0.18, 0.02, 0.07], material: 'rawMetal' },
  ],
})

/**
 * Ordered so the timeline can stagger by index within a limb — extend the foot
 * before the shin, the shin before the knee — which is what makes the legs read
 * as unfolding rather than as inflating.
 */
export const ROBOT_BONES: RobotBone[] = [
  ...[-1, 1].flatMap((side) => [foot(side), shin(side), knee(side), thigh(side)]),
  {
    id: 'pelvis',
    material: 'rawMetal',
    pos: [0, 2.12, -0.02],
    primitives: [
      { kind: 'box', args: [1.02, 0.36, 0.68] },
      // Hip yoke, wide enough to carry both thigh pins.
      { kind: 'box', args: [1.12, 0.13, 0.56], position: [0, -0.19, 0], material: 'trim' },
    ],
  },
  {
    id: 'waist',
    material: 'chrome',
    pos: [0, 2.36, -0.02],
    primitives: [
      { kind: 'cylinder', args: [0.26, 0.26, 0.28, 22] },
      { kind: 'torus', args: [0.28, 0.03, 8, 24], position: [0, 0.1, 0], rotation: [Math.PI / 2, 0, 0] },
    ],
  },
  {
    id: 'torso_core',
    material: 'rawMetal',
    pos: [0, 2.86, -0.02],
    primitives: [
      // 0.70 deep, not the 0.56 of the first pass. A torso built only out of the
      // car's flat panels is 60 cm front to back on a 3.5 m figure, and from a
      // side-on orbit the whole robot reads as a stack of plates rather than a
      // body. This is the volume the panels are bolted to.
      { kind: 'box', args: [0.94, 0.92, 0.7] },
      { kind: 'box', args: [1.08, 0.2, 0.62], position: [0, 0.42, 0], material: 'trim' },
    ],
  },
  {
    id: 'collar',
    material: 'trim',
    pos: [0, 3.3, -0.04],
    primitives: [
      { kind: 'box', args: [1.38, 0.28, 0.52] },
      armourPlate([1.2, 0.1, 0.44], [0, 0.15, 0.02]),
    ],
  },
  ...[-1, 1].flatMap((side) => [
    shoulder(side),
    upperArm(side),
    elbow(side),
    forearm(side),
    hand(side),
  ]),
  {
    id: 'neck',
    material: 'chrome',
    pos: [0, 3.42, -0.04],
    primitives: [
      // Wide and short, overlapping the collar below and the head above at both
      // ends. The first pass used a 0.12 m pin across a 0.18 m gap and the head
      // read as hovering over the shoulders rather than mounted on them.
      { kind: 'cylinder', args: [0.17, 0.17, 0.36, 18] },
      { kind: 'box', args: [0.44, 0.14, 0.4], position: [0, -0.15, 0], material: 'trim' },
    ],
  },
  {
    id: 'head_core',
    material: 'rawMetal',
    pos: [0, 3.74, -0.02],
    primitives: [
      // Grown from 0.46 x 0.40. At the smaller size the 1.2 m chest plate made the
      // head look like an aerial, and a head that small on a 3.5 m figure is the
      // fastest way to lose the read entirely.
      { kind: 'box', args: [0.54, 0.48, 0.5] },
      // Jaw, under the face guard the rear bumper becomes.
      { kind: 'box', args: [0.38, 0.12, 0.34], position: [0, -0.26, 0.07], material: 'trim' },
      // --- Helmet. This was the car's roof panel for one pass and it did not
      // work: the roof's bounding box is dominated by its side glazing and
      // C-pillars, so centring it on the head left the crown floating above and
      // the glass hanging down either side, and the whole assembly read as a small
      // car cab balanced on a robot. The roof went to the upper back instead (see
      // ROBOT_PART_POSES) and the helmet is built here, in body colour so it still
      // tracks the paint scene.
      armourPlate([0.58, 0.16, 0.54], [0, 0.28, -0.02]),
      armourPlate([0.1, 0.16, 0.28], [0, 0.42, -0.06]),
      // Cheek guards, framing the face down both sides.
      ...[-1, 1].map((side): Primitive => armourPlate([0.07, 0.3, 0.32], [side * 0.28, -0.04, 0.02])),
      // Brow: it is what puts the eyes under something and stops the face reading
      // as two lamps stuck on a box.
      armourPlate([0.44, 0.1, 0.12], [0, 0.19, 0.19]),
      // Audio receptors. Two discs either side of a head is the single strongest
      // "this is an Autobot" cue available for two primitives.
      ...[-1, 1].map((side): Primitive => ({
        kind: 'cylinder',
        args: [0.085, 0.085, 0.12, 16],
        position: [side * 0.31, 0, -0.05],
        rotation: PIN,
        material: 'chrome',
      })),
    ],
  },
]
