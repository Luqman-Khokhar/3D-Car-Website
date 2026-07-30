import type { SectionId } from '@/store/useSceneStore'

export type Vec3 = [number, number, number]

/**
 * Declarative primitive descriptors. Kept as plain data (not JSX) so the
 * geometry cache can dedupe identical shapes — the four wheels share one
 * CylinderGeometry instead of allocating four.
 */
interface PrimitiveBase {
  position?: Vec3
  rotation?: Vec3
  /**
   * Overrides the parent part's material for this primitive only. Lets a rim sit
   * inside the wheel and a lamp inside a body panel without inventing new part
   * ids — the GLB contract stays at 16 names.
   */
  material?: MaterialKey
}

export type Primitive =
  | (PrimitiveBase & { kind: 'box'; args: [number, number, number] })
  | (PrimitiveBase & {
      kind: 'cylinder'
      /** [radiusTop, radiusBottom, height, radialSegments] */
      args: [number, number, number, number]
      /** Drops the end caps. Needed for the tyre tread, which must be a ring so
       *  the rim inside it is visible. */
      openEnded?: boolean
    })
  | (PrimitiveBase & {
      kind: 'torus'
      /** [radius, tube, radialSegments, tubularSegments] */
      args: [number, number, number, number]
    })

export type MaterialKey =
  | 'bodyPaint'
  | 'rawMetal'
  | 'rubber'
  | 'glass'
  | 'interior'
  | 'engine'
  | 'trim'
  | 'rim'
  | 'lampWhite'
  | 'lampRed'
  | 'exhaust'

export interface CarPart {
  id: string
  /** Scene that installs this part; its timeline owns the fly-in. */
  stage: SectionId
  material: MaterialKey
  /** Assembled transform. Origin is car centre, ground plane at y = 0, +Z is front. */
  position: Vec3
  rotation?: Vec3
  /** Added to `position` at the start of the part's stage, i.e. the offscreen pose. */
  explodedOffset: Vec3
  /** Absolute euler at the exploded pose; falls back to `rotation`. */
  explodedRotation?: Vec3
  primitives: Primitive[]
}

/**
 * Silhouette key dimensions, all metres. Panels are laid out against these
 * rather than hardcoded per part, because the parts must not interpenetrate —
 * two coplanar solids in the same material z-fight into visible stripes.
 *
 *   ground .......... 0.00
 *   axle centre ..... 0.33   (= WHEEL_RADIUS, so the car sits on its tyres)
 *   sill bottom ..... 0.27
 *   sill top ........ 0.57   doors start here
 *   beltline ........ 0.90   doors end, hood plane
 *   cowl top ........ 0.98   windscreen base
 *   roof ............ 1.25
 *
 * 4.25 m long x 1.94 m over arches x 1.29 m tall — a real sports-car footprint.
 */
const WHEEL_RADIUS = 0.33
const HALF_TRACK = 0.82
const AXLE_F = 1.32
const AXLE_R = -1.32
const SILL_TOP = 0.57
const BELTLINE = 0.9
const ROOF_Y = 1.25

/** Cylinder's local axis is +Y; roll it onto X so it reads as a wheel. */
const WHEEL_ROTATION: Vec3 = [0, 0, Math.PI / 2]

const TYRE_WIDTH = 0.245
const RIM_RADIUS = 0.205
const SPOKE_COUNT = 5

/**
 * Spokes radiating in the wheel's YZ plane (the axle runs along X once
 * WHEEL_ROTATION is applied). Each spoke is rotated about X to its clock angle
 * and pushed out to the midpoint between hub and rim.
 *
 * @param outboard +1 or -1, the direction of the wheel's visible face. Spokes sit
 *   near that face so they show through the open rim barrel; centred spokes are
 *   swallowed by the tyre from every viewing angle.
 */
function spokes(outboard: number): Primitive[] {
  const inner = 0.075
  const reach = (RIM_RADIUS - inner) * 0.95
  const mid = inner + reach / 2
  const faceX = outboard * 0.055

  return Array.from({ length: SPOKE_COUNT }, (_, i) => {
    const angle = (i / SPOKE_COUNT) * Math.PI * 2
    return {
      kind: 'box' as const,
      args: [0.05, reach, 0.032] as [number, number, number],
      // Local +Y is the spoke's length, so orbit it around X by the clock angle.
      position: [faceX, Math.cos(angle) * mid, Math.sin(angle) * mid] as Vec3,
      rotation: [-angle, 0, 0] as Vec3,
      material: 'rim' as const,
    }
  })
}

/**
 * @param x     final track position
 * @param z     final axle position
 * @param zFrom travel along the car's length, signed: front wheels roll in from
 *              the nose, rear wheels from the tail.
 *
 * The axle roll is baked into the primitives rather than the group, leaving the
 * group's rotation free for the timeline to spin about X — which is the actual
 * axle axis, so the wheel rolls instead of sliding.
 *
 * The lateral component holds the wheel outboard (|x| ~ 1.42) during the roll so
 * it travels clear of the bodywork, then tucks into the arch at the end. Without
 * it the wheel drives straight through the bumper that is already installed.
 */
const wheel = (id: string, x: number, z: number, zFrom: number): CarPart => ({
  id,
  stage: 'wheels',
  material: 'rubber',
  position: [x, WHEEL_RADIUS, z],
  explodedOffset: [Math.sign(x) * 0.6, 0, zFrom],
  // Rolling without slipping: a wheel travelling +Z spins +X, and the arc length
  // is travel / radius. Starting angle is therefore zFrom / R, unwinding to 0.
  explodedRotation: [zFrom / WHEEL_RADIUS, 0, 0],
  primitives: [
    // Tread band. openEnded is essential: a capped cylinder is solid and hides
    // the rim and spokes completely. 48 segments because at 24 the silhouette was
    // visibly faceted, and a wheel is the one round thing the eye checks.
    {
      kind: 'cylinder',
      args: [WHEEL_RADIUS, WHEEL_RADIUS, TYRE_WIDTH, 48],
      rotation: WHEEL_ROTATION,
      openEnded: true,
    },
    // Sidewalls. Each torus spans exactly tread radius down to rim radius, so the
    // open tread is closed off without a see-through gap.
    {
      kind: 'torus',
      args: [(WHEEL_RADIUS + RIM_RADIUS) / 2, (WHEEL_RADIUS - RIM_RADIUS) / 2, 10, 40],
      position: [-(TYRE_WIDTH / 2 - (WHEEL_RADIUS - RIM_RADIUS) / 2), 0, 0],
      rotation: [0, Math.PI / 2, 0],
    },
    {
      kind: 'torus',
      args: [(WHEEL_RADIUS + RIM_RADIUS) / 2, (WHEEL_RADIUS - RIM_RADIUS) / 2, 10, 40],
      position: [TYRE_WIDTH / 2 - (WHEEL_RADIUS - RIM_RADIUS) / 2, 0, 0],
      rotation: [0, Math.PI / 2, 0],
    },
    // Rim barrel, filling the hole the tread leaves. Also openEnded, or its end
    // cap hides the spokes exactly the way the solid tread hid the rim.
    {
      kind: 'cylinder',
      args: [RIM_RADIUS, RIM_RADIUS, TYRE_WIDTH - 0.02, 32],
      rotation: WHEEL_ROTATION,
      material: 'rim',
      openEnded: true,
    },
    // Brake disc, set inboard. Backs the open spokes so the eye does not see
    // straight through the wheel into the arch.
    {
      kind: 'cylinder',
      args: [0.15, 0.15, 0.022, 24],
      position: [-Math.sign(x) * 0.045, 0, 0],
      rotation: WHEEL_ROTATION,
      material: 'trim',
    },
    // Hub / centre cap, proud of the spoke face.
    {
      kind: 'cylinder',
      args: [0.072, 0.072, TYRE_WIDTH * 0.7, 20],
      position: [Math.sign(x) * 0.03, 0, 0],
      rotation: WHEEL_ROTATION,
      material: 'rim',
    },
    ...spokes(Math.sign(x)),
  ],
})

/**
 * Longitudinal V8, 60-degree included angle, built in the engine part's local
 * space (origin at the block centre, +Z toward the nose of the car).
 *
 * Bay clearances this has to respect, all world-space:
 *   chassis floor top ... 0.265   nothing may drop below
 *   hood underside ...... 0.825   nothing may poke above
 *   firewall front face . 0.66    bellhousing must stay ahead of it
 * With the part sitting at y 0.55, local Y is therefore limited to -0.28..+0.25 —
 * only 0.53 m for sump, block, banks, covers and intake. Real bays are this tight.
 *
 * The crankshaft runs along Z, so every pulley and the bellhousing are cylinders
 * rotated PI/2 about X to put their axis on Z.
 */
function buildEngine(): Primitive[] {
  const props: Primitive[] = []

  // Cylinder-bank half-angle: 60 deg total V, so 30 deg from vertical.
  const BANK = Math.PI / 6
  const AXIS_Z: Vec3 = [Math.PI / 2, 0, 0]

  // --- Bottom end -------------------------------------------------------
  // Oil pan, and the drain plug that makes it read as a sump rather than a box.
  props.push({ kind: 'box', args: [0.46, 0.1, 0.54], position: [0, -0.235, -0.02] })
  props.push({
    kind: 'cylinder',
    args: [0.022, 0.022, 0.03, 8],
    position: [0.1, -0.29, -0.02],
    material: 'trim',
  })

  // --- Block ------------------------------------------------------------
  props.push({ kind: 'box', args: [0.5, 0.2, 0.62], position: [0, -0.09, 0] })
  // Bellhousing and clutch cover at the back, stopping short of the firewall.
  props.push({
    kind: 'cylinder',
    args: [0.17, 0.15, 0.14, 20],
    position: [0, -0.07, -0.33],
    rotation: AXIS_Z,
  })
  props.push({
    kind: 'cylinder',
    args: [0.1, 0.1, 0.06, 16],
    position: [0, -0.07, -0.42],
    rotation: AXIS_Z,
    material: 'rawMetal',
  })

  // --- Cylinder banks and valve covers ---------------------------------
  for (const side of [-1, 1]) {
    const tilt = side * BANK
    // Bank centre sits 0.10 out along the bank axis from the V apex at y = 0.
    const bx = -side * Math.sin(BANK) * 0.11
    const by = Math.cos(BANK) * 0.11

    props.push({
      kind: 'box',
      args: [0.16, 0.18, 0.6],
      position: [bx, by, 0],
      rotation: [0, 0, tilt],
    })
    // Valve cover, polished, sitting on the bank's outer face.
    const cx = -side * Math.sin(BANK) * 0.225
    const cy = Math.cos(BANK) * 0.225
    props.push({
      kind: 'box',
      args: [0.14, 0.055, 0.56],
      position: [cx, cy, 0],
      rotation: [0, 0, tilt],
      material: 'rim',
    })
    // Cover bolts.
    for (let i = 0; i < 4; i++) {
      const z = -0.21 + i * 0.14
      props.push({
        kind: 'cylinder',
        args: [0.011, 0.011, 0.016, 6],
        position: [
          -side * Math.sin(BANK) * 0.258,
          Math.cos(BANK) * 0.258,
          z,
        ],
        rotation: [0, 0, tilt],
        material: 'trim',
      })
    }

    // --- Exhaust headers: four primaries per bank sweeping down and out,
    // gathering into a collector under the bank. This is the single detail that
    // most reads as "engine" rather than "box".
    for (let i = 0; i < 4; i++) {
      const z = -0.22 + i * 0.148
      props.push({
        kind: 'cylinder',
        args: [0.024, 0.024, 0.26, 10],
        position: [side * 0.26, -0.01, z],
        // 2.5 rad from +Y sends the tube down and outboard; mirrored per side.
        rotation: [0, 0, -side * 2.5],
        material: 'exhaust',
      })
    }
    props.push({
      kind: 'cylinder',
      args: [0.036, 0.036, 0.58, 12],
      position: [side * 0.335, -0.125, -0.04],
      rotation: AXIS_Z,
      material: 'exhaust',
    })

    // Engine mount.
    props.push({
      kind: 'box',
      args: [0.06, 0.07, 0.1],
      position: [side * 0.26, -0.185, 0.06],
      material: 'trim',
    })
  }

  // --- Induction --------------------------------------------------------
  // Plenum spans the V and rests on the heads; slight interpenetration with the
  // banks is correct here and does not z-fight because the volumes are solid.
  props.push({ kind: 'box', args: [0.33, 0.1, 0.48], position: [0, 0.155, 0] })
  // Runners down into each head.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      props.push({
        kind: 'box',
        args: [0.09, 0.07, 0.12],
        position: [side * 0.16, 0.11, -0.13 + i * 0.26],
        rotation: [0, 0, side * 0.5],
      })
    }
  }
  props.push({
    kind: 'cylinder',
    args: [0.05, 0.05, 0.09, 14],
    position: [0, 0.16, 0.25],
    rotation: AXIS_Z,
    material: 'rim',
  })
  props.push({
    kind: 'cylinder',
    args: [0.034, 0.034, 0.15, 12],
    position: [0, 0.16, 0.36],
    rotation: AXIS_Z,
    material: 'rubber',
  })
  // Air box up front.
  props.push({ kind: 'box', args: [0.17, 0.09, 0.12], position: [0, 0.15, 0.49], material: 'trim' })

  // --- Front accessory drive -------------------------------------------
  props.push({ kind: 'box', args: [0.46, 0.26, 0.05], position: [0, -0.08, 0.33] })
  // Crank, water pump and alternator pulleys.
  props.push({
    kind: 'cylinder',
    args: [0.078, 0.078, 0.05, 20],
    position: [0, -0.13, 0.35],
    rotation: AXIS_Z,
    material: 'rawMetal',
  })
  props.push({
    kind: 'cylinder',
    args: [0.058, 0.058, 0.042, 18],
    position: [0, 0.01, 0.35],
    rotation: AXIS_Z,
    material: 'rawMetal',
  })
  props.push({
    kind: 'cylinder',
    args: [0.055, 0.055, 0.13, 16],
    position: [0.21, -0.03, 0.27],
    rotation: AXIS_Z,
  })
  props.push({
    kind: 'cylinder',
    args: [0.04, 0.04, 0.03, 14],
    position: [0.21, -0.03, 0.35],
    rotation: AXIS_Z,
    material: 'rawMetal',
  })
  // Serpentine belt, as two straight runs between the pulleys.
  props.push({
    kind: 'box',
    args: [0.014, 0.15, 0.026],
    position: [-0.068, -0.06, 0.36],
    material: 'rubber',
  })
  props.push({
    kind: 'box',
    args: [0.014, 0.25, 0.026],
    position: [0.11, -0.08, 0.36],
    rotation: [0, 0, -0.72],
    material: 'rubber',
  })

  // --- Ancillaries ------------------------------------------------------
  // Oil filter, canted the way they always are for clearance.
  props.push({
    kind: 'cylinder',
    args: [0.046, 0.046, 0.12, 14],
    position: [0.235, -0.15, 0.15],
    rotation: [0, 0, 1.35],
    material: 'trim',
  })
  // Coolant hoses off the front of the heads.
  props.push({
    kind: 'cylinder',
    args: [0.028, 0.028, 0.2, 10],
    position: [0.1, 0.09, 0.34],
    rotation: [1.15, 0, 0.2],
    material: 'rubber',
  })
  props.push({
    kind: 'cylinder',
    args: [0.024, 0.024, 0.18, 10],
    position: [-0.11, 0.06, 0.33],
    rotation: [1.25, 0, -0.25],
    material: 'rubber',
  })
  // Dipstick tube.
  props.push({
    kind: 'cylinder',
    args: [0.009, 0.009, 0.22, 6],
    position: [-0.225, -0.06, -0.1],
    rotation: [0, 0, 0.3],
    material: 'rawMetal',
  })

  return props
}

/**
 * Generic sports-car proxy. Part names match the GLB contract in
 * public/models/README.md, so swapping in a real model does not touch any
 * timeline code.
 */
export const CAR_PARTS: CarPart[] = [
  {
    id: 'chassis',
    stage: 'chassis',
    material: 'rawMetal',
    position: [0, 0, 0],
    explodedOffset: [0, -1.4, 0],
    primitives: [
      // Floor pan.
      { kind: 'box', args: [1.68, 0.09, 3.85], position: [0, 0.22, 0] },
      // Longitudinal rails.
      { kind: 'box', args: [0.14, 0.22, 3.85], position: [-0.72, 0.34, 0] },
      { kind: 'box', args: [0.14, 0.22, 3.85], position: [0.72, 0.34, 0] },
      // Cross members over each axle line.
      { kind: 'box', args: [1.6, 0.18, 0.14], position: [0, 0.34, 1.72] },
      { kind: 'box', args: [1.6, 0.18, 0.14], position: [0, 0.34, -1.72] },
      // Firewall, splitting engine bay from cabin.
      { kind: 'box', args: [1.6, 0.52, 0.08], position: [0, 0.55, 0.62] },
    ],
  },
  {
    id: 'engine_block',
    stage: 'engine',
    material: 'engine',
    // See buildEngine() for the bay clearances that pin these values. Measured
    // AABB at this mount point: y 0.265..0.817, z 0.67..1.67 — sump exactly on
    // the floor pan, 8 mm under the hood, clear of the firewall.
    position: [0, 0.57, 1.12],
    // Drops in vertically — matches how a real line lowers a block onto its mounts.
    explodedOffset: [0, 2.6, 0],
    primitives: buildEngine(),
  },
  {
    id: 'body_shell',
    stage: 'body-panels',
    material: 'bodyPaint',
    position: [0, 0, 0],
    explodedOffset: [0, 2.2, 0],
    // Deliberately open-topped side panels rather than solid blocks: a solid
    // front clip would hide the engine drop and a solid rear would hide the seats.
    primitives: [
      // Rocker panels, ending short of the arches so nothing z-fights.
      { kind: 'box', args: [0.06, 0.3, 1.58], position: [-0.9, 0.42, -0.075] },
      { kind: 'box', args: [0.06, 0.3, 1.58], position: [0.9, 0.42, -0.075] },
      // Front wings, split fore and aft of the wheel with a rail bridging over it.
      // A single full-height panel would bury the tyre — this is the box-geometry
      // stand-in for a wheel arch cutout. Front wheel spans z 0.99..1.65,
      // tyre crown at y 0.66.
      { kind: 'box', args: [0.1, 0.42, 0.35], position: [-0.92, 0.62, 1.825] },
      { kind: 'box', args: [0.1, 0.42, 0.35], position: [0.92, 0.62, 1.825] },
      { kind: 'box', args: [0.1, 0.42, 0.25], position: [-0.92, 0.62, 0.865] },
      { kind: 'box', args: [0.1, 0.42, 0.25], position: [0.92, 0.62, 0.865] },
      { kind: 'box', args: [0.1, 0.22, 0.66], position: [-0.92, 0.72, 1.32] },
      { kind: 'box', args: [0.1, 0.22, 0.66], position: [0.92, 0.72, 1.32] },
      // Rear quarters, same treatment. Rear wheel spans z -1.65..-0.99.
      { kind: 'box', args: [0.1, 0.4, 0.2], position: [-0.91, 0.74, -1.75] },
      { kind: 'box', args: [0.1, 0.4, 0.2], position: [0.91, 0.74, -1.75] },
      { kind: 'box', args: [0.1, 0.4, 0.14], position: [-0.91, 0.74, -0.92] },
      { kind: 'box', args: [0.1, 0.4, 0.14], position: [0.91, 0.74, -0.92] },
      { kind: 'box', args: [0.1, 0.28, 0.66], position: [-0.91, 0.8, -1.32] },
      { kind: 'box', args: [0.1, 0.28, 0.66], position: [0.91, 0.8, -1.32] },
      // Rear closing panel.
      { kind: 'box', args: [1.84, 0.4, 0.08], position: [0, 0.74, -1.86] },
      // Tail lamps, standing just proud of it.
      { kind: 'box', args: [0.4, 0.12, 0.05], position: [-0.6, 0.79, -1.91], material: 'lampRed' },
      { kind: 'box', args: [0.4, 0.12, 0.05], position: [0.6, 0.79, -1.91], material: 'lampRed' },
      // Front fascia, closing the nose between the wings. Sits below the hood
      // plane (0.825) and above the bumper (0.58) so it butts against neither.
      { kind: 'box', args: [1.74, 0.22, 0.08], position: [0, 0.7, 1.99] },
      // Headlights.
      { kind: 'box', args: [0.36, 0.13, 0.05], position: [-0.58, 0.72, 2.02], material: 'lampWhite' },
      { kind: 'box', args: [0.36, 0.13, 0.05], position: [0.58, 0.72, 2.02], material: 'lampWhite' },
      // B-pillar infill between door shut line and rear quarter.
      { kind: 'box', args: [0.1, 0.33, 0.31], position: [-0.9, 0.735, -0.695] },
      { kind: 'box', args: [0.1, 0.33, 0.31], position: [0.9, 0.735, -0.695] },
      // Cowl, carrying the windscreen base.
      { kind: 'box', args: [1.72, 0.16, 0.16], position: [0, BELTLINE, 0.64] },
    ],
  },
  {
    id: 'roof',
    stage: 'body-panels',
    material: 'bodyPaint',
    position: [0, ROOF_Y, -0.55],
    explodedOffset: [0, 1.8, 0],
    primitives: [
      { kind: 'box', args: [1.56, 0.07, 0.95] },
      // A-pillars: same 25 deg rake and length as the windscreen, set just
      // outboard of the glass so they frame it instead of intersecting it.
      { kind: 'box', args: [0.08, 0.05, 0.88], position: [-0.76, -0.185, 0.87], rotation: [0.44, 0, 0] },
      { kind: 'box', args: [0.08, 0.05, 0.88], position: [0.76, -0.185, 0.87], rotation: [0.44, 0, 0] },
      // C-pillars, leaning back onto the rear quarters.
      { kind: 'box', args: [0.1, 0.43, 0.1], position: [-0.72, -0.1825, -0.61], rotation: [0.7, 0, 0] },
      { kind: 'box', args: [0.1, 0.43, 0.1], position: [0.72, -0.1825, -0.61], rotation: [0.7, 0, 0] },
      // Side glass, filling beltline (0.90) to roof (1.21). Carried by the roof
      // rather than the windshield part because the roof frame is unrotated, so
      // these coordinates stay readable. Inboard of the pillars at x 0.76.
      { kind: 'box', args: [0.02, 0.3, 1.45], position: [-0.89, -0.195, 0.325], material: 'glass' },
      { kind: 'box', args: [0.02, 0.3, 1.45], position: [0.89, -0.195, 0.325], material: 'glass' },
    ],
  },
  {
    id: 'door_L',
    stage: 'body-panels',
    material: 'bodyPaint',
    // Spans sill top to beltline exactly, so it butts against both without overlap.
    position: [-0.9, (SILL_TOP + BELTLINE) / 2, 0.02],
    explodedOffset: [-2.6, 0.1, 0],
    // Swings in from a slightly open pose rather than sliding flat.
    explodedRotation: [0, -0.5, 0],
    primitives: [
      { kind: 'box', args: [0.07, 0.33, 1.12] },
      // Handle. Short on purpose: a full-length strip reads as a zip, not a car.
      { kind: 'box', args: [0.03, 0.05, 0.2], position: [-0.05, 0.05, -0.3] },
    ],
  },
  {
    id: 'door_R',
    stage: 'body-panels',
    material: 'bodyPaint',
    position: [0.9, (SILL_TOP + BELTLINE) / 2, 0.02],
    explodedOffset: [2.6, 0.1, 0],
    explodedRotation: [0, 0.5, 0],
    primitives: [
      { kind: 'box', args: [0.07, 0.33, 1.12] },
      { kind: 'box', args: [0.03, 0.05, 0.2], position: [0.05, 0.05, -0.3] },
    ],
  },
  {
    id: 'hood',
    stage: 'body-panels',
    material: 'bodyPaint',
    // Long and low, sitting on the wings and inset from the arches.
    position: [0, 0.86, 1.37],
    rotation: [-0.03, 0, 0],
    explodedOffset: [0, 1.5, 1.4],
    explodedRotation: [-0.9, 0, 0],
    primitives: [{ kind: 'box', args: [1.66, 0.07, 1.24] }],
  },
  {
    id: 'trunk',
    stage: 'body-panels',
    material: 'bodyPaint',
    position: [0, 0.97, -1.42],
    rotation: [0.04, 0, 0],
    explodedOffset: [0, 1.3, -1.5],
    explodedRotation: [0.9, 0, 0],
    primitives: [{ kind: 'box', args: [1.58, 0.07, 0.92] }],
  },
  {
    id: 'bumper_F',
    stage: 'body-panels',
    material: 'trim',
    position: [0, 0.44, 2.09],
    explodedOffset: [0, 0, 3.4],
    primitives: [
      { kind: 'box', args: [1.9, 0.28, 0.16] },
      { kind: 'box', args: [1.5, 0.14, 0.1], position: [0, -0.2, 0.02] },
    ],
  },
  {
    id: 'bumper_R',
    stage: 'body-panels',
    material: 'trim',
    position: [0, 0.46, -2.0],
    explodedOffset: [0, 0, -3.4],
    primitives: [
      { kind: 'box', args: [1.88, 0.3, 0.16] },
      { kind: 'box', args: [1.44, 0.14, 0.1], position: [0, -0.2, -0.02] },
    ],
  },
  {
    id: 'interior_seats',
    stage: 'interior',
    material: 'interior',
    position: [0, 0.5, -0.2],
    explodedOffset: [0, 1.2, -0.6],
    primitives: [
      // Squabs.
      { kind: 'box', args: [0.44, 0.1, 0.46], position: [-0.38, 0, 0] },
      { kind: 'box', args: [0.44, 0.1, 0.46], position: [0.38, 0, 0] },
      // Backrests.
      { kind: 'box', args: [0.44, 0.52, 0.1], position: [-0.38, 0.26, -0.26], rotation: [0.14, 0, 0] },
      { kind: 'box', args: [0.44, 0.52, 0.1], position: [0.38, 0.26, -0.26], rotation: [0.14, 0, 0] },
      // Dash, stopping short of the cowl.
      { kind: 'box', args: [1.44, 0.2, 0.26], position: [0, 0.28, 0.62] },
    ],
  },
  {
    id: 'windshield',
    stage: 'interior',
    material: 'glass',
    // Spans cowl top (z 0.72, y 0.98) to roof leading edge (z -0.08, y 1.25):
    // a 0.88 m pane raked 25 deg (atan(0.37 / 0.80)). Positive rotation.x drops
    // the +Z end, which is the low cowl end.
    position: [0, 1.07, 0.32],
    rotation: [0.44, 0, 0],
    explodedOffset: [0, 1.4, 0.8],
    primitives: [{ kind: 'box', args: [1.48, 0.02, 0.88] }],
  },
  wheel('wheel_FL', -HALF_TRACK, AXLE_F, 3.3),
  wheel('wheel_FR', HALF_TRACK, AXLE_F, 3.3),
  wheel('wheel_RL', -HALF_TRACK, AXLE_R, -3.3),
  wheel('wheel_RR', HALF_TRACK, AXLE_R, -3.3),
]

export type PartId = (typeof CAR_PARTS)[number]['id']

/** Parts installed during a given scene, in declaration order. */
export function partsForStage(stage: SectionId): CarPart[] {
  return CAR_PARTS.filter((p) => p.stage === stage)
}

export { WHEEL_RADIUS, ROOF_Y }
