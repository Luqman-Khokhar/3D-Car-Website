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
      /** Sweep in radians, default 2*PI. A half sweep is what makes a wheel arch
       *  lip rather than a full ring. */
      arc?: number
    })
  | (PrimitiveBase & {
      kind: 'prism'
      /**
       * Outline as [z, y] pairs in the primitive's own frame, wound
       * counter-clockwise, extruded along X. A box can only ever be a rectangle
       * in the flank plane, and the one panel on a car that is never a rectangle
       * is the side glass — its front and rear edges lean with the A- and
       * C-pillars.
       */
      points: Point2[]
      /** Inner outlines cut out of the face. The glass surrounds are rings, not
       *  plates: a solid plate behind a transparent pane tints the whole window. */
      holes?: Point2[][]
      /** Thickness along X, centred on the origin. */
      depth: number
    })

/** [z, y] in a primitive's own frame. */
export type Point2 = [number, number]

export type MaterialKey =
  | 'bodyPaint'
  | 'rawMetal'
  | 'rubber'
  | 'glass'
  | 'interior'
  | 'engine'
  | 'trim'
  | 'rim'
  | 'chrome'
  | 'lampWhite'
  | 'lampRed'
  | 'exhaust'
  | 'tyreTread'
  | 'tyreSidewall'
  | 'caliper'
  /** Near-black matte. Grille apertures, lamp housings, and the recessed plate
   *  behind every closure panel that reads as a shut line. */
  | 'shadow'
  | 'plate'

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
 * 4.42 m long over splitter and diffuser, 1.97 m over the arch flares (2.11 m
 * over the door mirrors) and 1.29 m tall — a real sports-car footprint.
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
 * Static negative camber, radians. Dead-vertical wheels are the clearest tell
 * that a car was modelled rather than photographed — every performance car sits
 * with its tops leaned in. 1.3 deg is subtle enough to read as setup, not damage.
 *
 * Applied as the part group's z rotation. Safe against the timeline: the wheel
 * tween only writes `rotation.x`, so this survives the whole scrub.
 */
const CAMBER = 0.023

/** Depth of the tread grooves. The ribs sit at full radius and the carcass below
 *  them, so the grooves are what is left over rather than a subtraction. */
const GROOVE_DEPTH = 0.012

/**
 * Rib-pattern tread: a carcass at reduced radius with four raised ribs on top,
 * leaving three circumferential grooves. Additive primitives cannot cut a groove,
 * so the tread is built from what is left standing.
 *
 * The outer pair taper down at their outboard end, which is the tyre's shoulder
 * radius — a square-edged tread band is the giveaway that reads as a hockey puck.
 */
function tread(): Primitive[] {
  const R = WHEEL_RADIUS
  const RIB_WIDTH = 0.052
  const SHOULDER = 0.014
  // Rib centres, inner pair then outer pair, mirrored about the wheel's midplane.
  const OUTER = 0.0955
  const INNER = 0.0318

  return [
    // Carcass / groove floor, spanning the full tread width.
    {
      kind: 'cylinder',
      args: [R - GROOVE_DEPTH, R - GROOVE_DEPTH, TYRE_WIDTH, 48],
      rotation: WHEEL_ROTATION,
      openEnded: true,
    },
    // Inner ribs, full radius both ends.
    ...[-INNER, INNER].map(
      (x): Primitive => ({
        kind: 'cylinder',
        args: [R, R, RIB_WIDTH, 48],
        position: [x, 0, 0],
        rotation: WHEEL_ROTATION,
        openEnded: true,
      }),
    ),
    // Outer ribs. WHEEL_ROTATION maps the cylinder's +Y end onto -X, so the
    // shoulder taper goes on `radiusTop` for the -X rib and `radiusBottom` for +X.
    {
      kind: 'cylinder',
      args: [R - SHOULDER, R, RIB_WIDTH, 48],
      position: [-OUTER, 0, 0],
      rotation: WHEEL_ROTATION,
      openEnded: true,
    },
    {
      kind: 'cylinder',
      args: [R, R - SHOULDER, RIB_WIDTH, 48],
      position: [OUTER, 0, 0],
      rotation: WHEEL_ROTATION,
      openEnded: true,
    },
  ]
}

/**
 * Wheel nuts on the hub face. Five of them, because the eye counts spokes and
 * nuts without being asked and a bare hub cap reads as a castor.
 */
function lugNuts(outboard: number): Primitive[] {
  return Array.from({ length: SPOKE_COUNT }, (_, i) => {
    // Offset half a pitch from the spokes so they do not disappear into them.
    const angle = ((i + 0.5) / SPOKE_COUNT) * Math.PI * 2
    return {
      kind: 'cylinder' as const,
      args: [0.012, 0.012, 0.022, 6] as [number, number, number, number],
      position: [outboard * 0.118, Math.cos(angle) * 0.048, Math.sin(angle) * 0.048] as Vec3,
      rotation: WHEEL_ROTATION,
      material: 'rawMetal' as const,
    }
  })
}

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
  material: 'tyreTread',
  position: [x, WHEEL_RADIUS, z],
  // Static camber. Positive z tilts the top toward -X, so the sign follows the
  // side the wheel is on and both tops lean inboard.
  rotation: [0, 0, Math.sign(x) * CAMBER],
  explodedOffset: [Math.sign(x) * 0.6, 0, zFrom],
  // Rolling without slipping: a wheel travelling +Z spins +X, and the arc length
  // is travel / radius. Starting angle is therefore zFrom / R, unwinding to 0.
  // Only .x is tweened, so the camber above is untouched by the timeline.
  explodedRotation: [zFrom / WHEEL_RADIUS, 0, Math.sign(x) * CAMBER],
  primitives: [
    // Tread band. openEnded throughout is essential: a capped cylinder is solid
    // and hides the rim and spokes completely. 48 segments because at 24 the
    // silhouette was visibly faceted, and a wheel is the one round thing the eye
    // checks.
    ...tread(),
    // Sidewalls. Each torus spans exactly tread radius down to rim radius, so the
    // open tread is closed off without a see-through gap. Satin rather than the
    // tread's matte: rubber that has never touched tarmac stays shinier, and the
    // split is what stops the whole tyre reading as one flat black lump.
    {
      kind: 'torus',
      args: [(WHEEL_RADIUS + RIM_RADIUS) / 2, (WHEEL_RADIUS - RIM_RADIUS) / 2, 10, 40],
      position: [-(TYRE_WIDTH / 2 - (WHEEL_RADIUS - RIM_RADIUS) / 2), 0, 0],
      rotation: [0, Math.PI / 2, 0],
      material: 'tyreSidewall',
    },
    {
      kind: 'torus',
      args: [(WHEEL_RADIUS + RIM_RADIUS) / 2, (WHEEL_RADIUS - RIM_RADIUS) / 2, 10, 40],
      position: [TYRE_WIDTH / 2 - (WHEEL_RADIUS - RIM_RADIUS) / 2, 0, 0],
      rotation: [0, Math.PI / 2, 0],
      material: 'tyreSidewall',
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
    // Caliper, straddling the disc at the rear of the wheel. Sits inside the rim
    // radius so it shows through the spokes. Painted, because a coloured caliper
    // behind an open wheel is the detail people photograph.
    {
      kind: 'box',
      args: [0.055, 0.115, 0.16],
      position: [-Math.sign(x) * 0.045, 0.15, -0.045],
      material: 'caliper',
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
    ...lugNuts(Math.sign(x)),
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

/** Sweep of an arch eyebrow, radians. Deliberately not PI. */
const ARCH_SWEEP = 2.1

/**
 * Wheel-arch eyebrow: a torus arc standing proud in the wheel's plane.
 *
 * Box geometry can fake an arch cutout by splitting a panel fore and aft of the
 * wheel, which is what the wings below do — but the missing piece is the curve
 * itself. TorusGeometry sweeps its arc from +X toward +Y in its own XY plane;
 * rotating PI/2 about Y drops that plane onto YZ, and Euler XYZ applies the Z
 * term first, so the third rotation spins the arc within that plane.
 *
 * The sweep is 120 degrees centred on top, not a full half. A half sweep runs
 * all the way down to axle height at both ends, where there is no bodywork to
 * terminate against, and the lip reads as a free-standing hoop bolted to the
 * side of the car — which is exactly what it looked like. At 120 degrees both
 * ends finish at y 0.54, buried inside the wing panels fore and aft of the
 * wheel, so the curve appears to emerge from the body and go back into it.
 *
 * @param radius arch radius from the axle centre. Must clear WHEEL_RADIUS.
 */
function archLip(x: number, z: number, radius: number): Primitive {
  return {
    kind: 'torus',
    args: [radius, 0.022, 8, 24],
    arc: ARCH_SWEEP,
    position: [x, WHEEL_RADIUS, z],
    // Half the sweep back from vertical, so the arc straddles the top.
    rotation: [0, Math.PI / 2, Math.PI / 2 - ARCH_SWEEP / 2],
    material: 'bodyPaint',
  }
}

/**
 * The dark plate that sits a few millimetres inside a closure panel and shows
 * around its edges as a shut line.
 *
 * Real cars read as assembled from a distance because of the 3-5 mm shadow gap
 * around every door, hood and lid. Butting two painted panels flush — which is
 * what these panels did — makes a whole flank read as one moulding.
 *
 * The plate belongs to the panel rather than to the shell so it flies in with it;
 * putting it on the body shell would drop a lid over the engine bay one stagger
 * step before the hood arrives.
 *
 * Sizing is the whole trick and it is easy to get wrong by an order of magnitude:
 * the plate must be about 8 mm larger than the skin in each direction, giving a
 * 4 mm reveal per edge. A first pass here used 60-70 mm and the result was not a
 * shut line but a black picture frame, with every panel reading as a separate
 * object dropped onto the car.
 *
 * @param axis  the panel's thickness axis
 * @param inset signed offset along that axis, putting the plate under the skin
 */
function shutLine(axis: 'x' | 'y', size: [number, number, number], inset: number): Primitive {
  const position: Vec3 = axis === 'x' ? [inset, 0, 0] : [0, inset, 0]
  return { kind: 'box', args: size, position, material: 'shadow' }
}

/**
 * Door skin, shut line, handle and door mirror.
 *
 * @param side -1 for the left door, +1 for the right. Local +X on the right door
 *   points outboard; on the left it points inboard, so every outboard offset is
 *   multiplied through by `side`.
 *
 * The skin is 15 mm shorter and 30 mm narrower than the aperture it fills, with
 * the dark plate behind showing through the difference. The mirror hangs off the
 * front top corner, outboard of the arch flare — mirrors are the widest point on
 * a real car, which is exactly why leaving them off flattens the front view.
 */
function door(side: number): Primitive[] {
  return [
    // 8 mm short of the 0.33 x 1.12 aperture, which the plate fills exactly.
    { kind: 'box', args: [0.07, 0.322, 1.112] },
    // Plate goes inboard of the skin, so it shows only through the gap.
    shutLine('x', [0.024, 0.33, 1.12], -side * 0.04),
    // Handle. Short on purpose: a full-length strip reads as a zip, not a car.
    { kind: 'box', args: [0.03, 0.05, 0.2], position: [side * 0.05, 0.05, -0.3] },
    // Mirror: stalk, painted housing, and the glass itself.
    { kind: 'box', args: [0.055, 0.042, 0.09], position: [side * 0.06, 0.19, 0.5] },
    {
      kind: 'box',
      args: [0.06, 0.1, 0.17],
      position: [side * 0.118, 0.235, 0.558],
      rotation: [0, 0, -side * 0.12],
    },
    {
      kind: 'box',
      args: [0.014, 0.076, 0.14],
      position: [side * 0.146, 0.238, 0.562],
      rotation: [0, 0, -side * 0.12],
      material: 'glass',
    },
  ]
}

/**
 * Pushes a closed counter-clockwise outline out along its own edge normals.
 *
 * Each glass surround is derived from the pane it frames, so the frit band has
 * to keep a constant width round a shape whose edges are not parallel. Scaling
 * the outline about its centroid — the obvious cheap trick — leaves the band
 * twice as wide along the long bottom edge as along the short top one, which
 * reads as a rubber seal that has slipped out of its channel.
 *
 * Straight offsetting with no self-intersection cleanup: the outlines here are
 * convex quadrilaterals, so adjacent offset edges always meet at one point.
 *
 * @param distance positive outwards, negative inwards
 */
function offsetOutline(points: Point2[], distance: number): Point2[] {
  const count = points.length
  const edges = points.map((p, i): [Point2, Point2] => {
    const q = points[(i + 1) % count]
    const dz = q[0] - p[0]
    const dy = q[1] - p[1]
    const length = Math.hypot(dz, dy)
    // Outward normal of a counter-clockwise edge.
    const nz = (dy / length) * distance
    const ny = (-dz / length) * distance
    return [
      [p[0] + nz, p[1] + ny],
      [q[0] + nz, q[1] + ny],
    ]
  })
  return points.map(([pz, py], i): Point2 => {
    const [a, b] = edges[(i - 1 + count) % count]
    const [c, d] = edges[i]
    const r: Point2 = [b[0] - a[0], b[1] - a[1]]
    const s: Point2 = [d[0] - c[0], d[1] - c[1]]
    const denominator = r[0] * s[1] - r[1] * s[0]
    // Collinear neighbours have no corner to solve for; the vertex has already
    // been carried along the one shared normal.
    if (Math.abs(denominator) < 1e-9) return [b[0], b[1]]
    const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / denominator
    const corner: Point2 = [a[0] + t * r[0], a[1] + t * r[1]]

    // Miter limit. The front lower corner of the door glass closes to about
    // 25 degrees, and an unclamped miter there runs 110 mm past the vertex —
    // a black spike sticking out of the A-pillar foot, four times the width of
    // the band it belongs to. Clamping trades a truly sharp corner for a
    // slightly blunt one, which is what the corner of a real pane looks like.
    const reach = Math.hypot(corner[0] - pz, corner[1] - py)
    const limit = Math.abs(distance) * 2
    if (reach <= limit) return corner
    return [pz + ((corner[0] - pz) / reach) * limit, py + ((corner[1] - py) / reach) * limit]
  })
}

/**
 * The daylight opening down one side: door glass, rear quarter glass, the
 * B-pillar between them, and a frit ring round each pane.
 *
 * Everything is authored in the roof part's frame, since the roof is the only
 * greenhouse part with no rotation of its own. The glass band runs from the
 * beltline at roof-local y -0.345 to the roof underside at -0.045, so the panes
 * are 0.30 m tall about a -0.195 origin and the outlines below are +/-0.15.
 *
 * The sloped edges are taken off the pillars they sit against rather than
 * eyeballed. The A-pillar's axis moves 2.122 m in z per metre of drop and the
 * C-pillar's 0.842 m the other way, so across the 0.30 m band the front edge
 * leans 0.64 m back and the rear edge 0.25 m forward as they rise. That is why
 * the rectangular slabs these replace looked wrong from every three-quarter
 * angle: a pane with vertical ends leaves a wedge of daylight under each raked
 * pillar, and the eye reads the wedge long before it reads the glass.
 *
 * Panes are cut 30-50 mm inboard of the pillar axes so the pillars frame them
 * instead of fighting them for the same millimetres.
 */
function sideGlazing(side: number): Primitive[] {
  const rotation: Vec3 = [0, 0, side * 0.052]
  const x = side * 0.89

  // Front edge on the A-pillar, rear edge on the C-pillar, and a B-pillar split
  // at roof-local z 0.03 — the door's rear shut line, so the division in the
  // glass lands on the division in the sheet metal below it.
  const doorGlass: Point2[] = [
    [1.18, -0.15],
    [0.542, 0.15],
    [0.01, 0.15],
    [0.05, -0.15],
  ]
  const quarterGlass: Point2[] = [
    [0.0, -0.15],
    [-0.04, 0.15],
    [-0.444, 0.15],
    [-0.697, -0.15],
  ]

  return [
    ...[doorGlass, quarterGlass].flatMap((pane): Primitive[] => [
      { kind: 'prism', points: pane, depth: 0.02, position: [x, -0.195, 0], rotation, material: 'glass' },
      // Frit ring: a 24 mm band round the pane, overlapping its edge by 4 mm so
      // the cut edge is never the outline anyone sees. Thicker than the pane so
      // no face is coplanar with it — coplanar solids z-fight into stripes.
      {
        kind: 'prism',
        points: offsetOutline(pane, 0.024),
        holes: [offsetOutline(pane, -0.004)],
        depth: 0.026,
        position: [x, -0.195, 0],
        rotation,
        material: 'shadow',
      },
    ]),
    // B-pillar, filling the 60 mm gap left between the two panes and raked to
    // match their facing edges.
    {
      kind: 'box',
      args: [0.028, 0.302, 0.062],
      position: [x, -0.195, 0.005],
      rotation: [-0.1326, 0, side * 0.052],
      material: 'shadow',
    },
  ]
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
      // --- Exhaust system. The engine already carries headers and collectors
      // that previously stopped dead at the bellhousing; without a run to the
      // back the car has no underside story at all, and the underside is exactly
      // what the low orbit shots look at. Pipe crown sits at y 0.178, just under
      // the floor pan, and never drops below 0.10 so it keeps ground clearance.
      ...[-1, 1].flatMap((side): Primitive[] => [
        {
          kind: 'cylinder',
          args: [0.038, 0.038, 2.05, 12],
          position: [side * 0.26, 0.14, -0.42],
          rotation: [Math.PI / 2, 0, 0],
          material: 'exhaust',
        },
        // Downpipe, joining the engine's collector (local y 0.445, z 0.79 in car
        // space) to the front of the run. Euler XYZ applies Z first, so the pair
        // below aims the cylinder's +Y axis along (0.24, 0.85, 0.51) — up, out and
        // forward — with the X component mirrored per side.
        {
          kind: 'cylinder',
          args: [0.038, 0.038, 0.38, 12],
          position: [side * 0.2975, 0.2925, 0.6975],
          rotation: [0.55, 0, -side * 0.24],
          material: 'exhaust',
        },
        // Tailpipe out of the silencer, rising to meet the tip that the rear
        // bumper carries at x +/-0.40, y 0.315.
        {
          kind: 'cylinder',
          args: [0.034, 0.034, 0.3, 10],
          position: [side * 0.4, 0.315, -1.88],
          rotation: [Math.PI / 2, 0, 0],
          material: 'exhaust',
        },
      ]),
      // Silencer box, slung between the pipes ahead of the rear valance. Wide and
      // tall enough to swallow both the through-pipes at y 0.14 and the tailpipe
      // roots at 0.315.
      { kind: 'box', args: [0.9, 0.19, 0.52], position: [0, 0.225, -1.5], material: 'exhaust' },
      // --- Radiator and fan, filling the empty nose ahead of the block. Bay
      // limits from buildEngine() apply: y 0.33..0.77 clears the hood at 0.825.
      { kind: 'box', args: [0.76, 0.44, 0.05], position: [0, 0.55, 1.84], material: 'trim' },
      // Top rail stops at 0.78. The hood's shut plate runs at 0.818, and this is
      // the only bay part far enough forward to reach it.
      { kind: 'box', args: [0.8, 0.05, 0.07], position: [0, 0.755, 1.84], material: 'rawMetal' },
      {
        kind: 'cylinder',
        args: [0.17, 0.17, 0.05, 20],
        position: [0, 0.55, 1.76],
        rotation: [Math.PI / 2, 0, 0],
        material: 'shadow',
      },
      // Battery and washer bottle, the two things always visible in a real bay.
      { kind: 'box', args: [0.24, 0.2, 0.18], position: [-0.52, 0.45, 1.62], material: 'trim' },
      { kind: 'box', args: [0.1, 0.04, 0.14], position: [-0.52, 0.56, 1.62], material: 'rawMetal' },
      {
        kind: 'cylinder',
        args: [0.09, 0.09, 0.24, 14],
        position: [0.54, 0.47, 1.64],
        material: 'shadow',
      },
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
      // Rocker panels, ending short of the arches so nothing z-fights. Taken down
      // to y 0.22 from 0.27: the chassis floor pan sits at 0.175..0.265 and used
      // to show below them as a bright bare-metal strip the length of the car,
      // which read as a chrome running board. Not lower than that — at 0.17 the
      // whole midsection hung below the wings and the car read as a bathtub.
      { kind: 'box', args: [0.06, 0.35, 1.58], position: [-0.9, 0.395, -0.075] },
      { kind: 'box', args: [0.06, 0.35, 1.58], position: [0.9, 0.395, -0.075] },
      // Side skirts, standing proud of the rockers in dark trim. Two jobs: they
      // finish the last of the exposed floor pan, and the dark band across the
      // bottom of a 700 mm expanse of painted flank is the only thing breaking up
      // what is otherwise the flattest surface on the car.
      { kind: 'box', args: [0.05, 0.15, 1.6], position: [-0.925, 0.245, -0.075], material: 'trim' },
      { kind: 'box', args: [0.05, 0.15, 1.6], position: [0.925, 0.245, -0.075], material: 'trim' },
      // Front wings, split fore and aft of the wheel with a rail bridging over it.
      // A single full-height panel would bury the tyre — this is the box-geometry
      // stand-in for a wheel arch cutout. Front wheel spans z 0.99..1.65,
      // tyre crown at y 0.66.
      //
      // Taken down to the sill line at 0.27 rather than stopping at 0.41: the
      // 140 mm strip below them showed bare chassis from every side-on angle, so
      // the car appeared to have bodywork only in the middle.
      { kind: 'box', args: [0.1, 0.56, 0.35], position: [-0.92, 0.55, 1.825] },
      { kind: 'box', args: [0.1, 0.56, 0.35], position: [0.92, 0.55, 1.825] },
      { kind: 'box', args: [0.1, 0.56, 0.25], position: [-0.92, 0.55, 0.865] },
      { kind: 'box', args: [0.1, 0.56, 0.25], position: [0.92, 0.55, 0.865] },
      { kind: 'box', args: [0.1, 0.22, 0.66], position: [-0.92, 0.72, 1.32] },
      { kind: 'box', args: [0.1, 0.22, 0.66], position: [0.92, 0.72, 1.32] },
      // Rear quarters, same treatment. Rear wheel spans z -1.65..-0.99.
      { kind: 'box', args: [0.1, 0.62, 0.2], position: [-0.91, 0.63, -1.75] },
      { kind: 'box', args: [0.1, 0.62, 0.2], position: [0.91, 0.63, -1.75] },
      { kind: 'box', args: [0.1, 0.62, 0.14], position: [-0.91, 0.63, -0.92] },
      { kind: 'box', args: [0.1, 0.62, 0.14], position: [0.91, 0.63, -0.92] },
      { kind: 'box', args: [0.1, 0.28, 0.66], position: [-0.91, 0.8, -1.32] },
      { kind: 'box', args: [0.1, 0.28, 0.66], position: [0.91, 0.8, -1.32] },
      // Rear closing panel.
      { kind: 'box', args: [1.84, 0.4, 0.08], position: [0, 0.74, -1.86] },
      // --- Tail lamps. A flat emissive rectangle reads as a sticker no matter how
      // it is tuned, so each side is a dark housing with lit rings set into it —
      // the housing gives the lens somewhere to sit and something to shade against.
      ...[-1, 1].flatMap((side): Primitive[] => [
        { kind: 'box', args: [0.46, 0.16, 0.06], position: [side * 0.6, 0.79, -1.895], material: 'shadow' },
        // Torus normals already face +Z, so no rotation is needed to aim these
        // out of the back of the car.
        {
          kind: 'torus',
          args: [0.052, 0.017, 8, 20],
          position: [side * 0.52, 0.795, -1.925],
          material: 'lampRed',
        },
        {
          kind: 'torus',
          args: [0.052, 0.017, 8, 20],
          position: [side * 0.68, 0.795, -1.925],
          material: 'lampRed',
        },
        // Reverse lamp. Kept small and moved down beside the plate: sitting
        // directly under the pair of red rings it read as a mouth under two eyes,
        // which is all anyone could see afterwards.
        { kind: 'box', args: [0.12, 0.03, 0.03], position: [side * 0.42, 0.68, -1.925], material: 'lampWhite' },
      ]),
      // Rear plate, recessed below the lamps. Both this and the reverse lamps sit
      // above y 0.61, which is where the bumper skin now tops out — below that
      // line the bumper hides them and all that escapes is a glow along its edge.
      { kind: 'box', args: [0.56, 0.15, 0.02], position: [0, 0.68, -1.895], material: 'shadow' },
      { kind: 'box', args: [0.52, 0.125, 0.012], position: [0, 0.68, -1.908], material: 'plate' },
      // Front fascia, closing the nose between the wings. Sits below the hood
      // plane (0.825) and above the bumper (0.58) so it butts against neither.
      { kind: 'box', args: [1.74, 0.22, 0.08], position: [0, 0.7, 1.99] },
      // --- Headlights, same treatment: recessed housing, twin projector bowls,
      // and a slim daytime strip under them. The strip is what the eye locks onto
      // as a face, and it costs one box per side.
      ...[-1, 1].flatMap((side): Primitive[] => [
        { kind: 'box', args: [0.44, 0.18, 0.06], position: [side * 0.58, 0.725, 2.005], material: 'shadow' },
        {
          kind: 'cylinder',
          args: [0.05, 0.05, 0.035, 18],
          position: [side * 0.5, 0.75, 2.032],
          rotation: [Math.PI / 2, 0, 0],
          material: 'lampWhite',
        },
        {
          kind: 'cylinder',
          args: [0.05, 0.05, 0.035, 18],
          position: [side * 0.665, 0.75, 2.032],
          rotation: [Math.PI / 2, 0, 0],
          material: 'lampWhite',
        },
        { kind: 'box', args: [0.38, 0.028, 0.03], position: [side * 0.58, 0.667, 2.032], material: 'lampWhite' },
      ]),
      // B-pillar infill between door shut line and rear quarter.
      { kind: 'box', args: [0.1, 0.33, 0.31], position: [-0.9, 0.735, -0.695] },
      { kind: 'box', args: [0.1, 0.33, 0.31], position: [0.9, 0.735, -0.695] },
      // Cowl, carrying the windscreen base.
      { kind: 'box', args: [1.72, 0.16, 0.16], position: [0, BELTLINE, 0.64] },
      // Wipers parked on the cowl top (y 0.98), raked across the screen the way
      // they sit at rest. Two boxes and a pivot each — trivially cheap, and their
      // absence is one of the things that makes a render read as untextured CAD.
      ...[-1, 1].flatMap((side): Primitive[] => [
        {
          kind: 'cylinder',
          args: [0.018, 0.018, 0.03, 10],
          position: [side * 0.42, 0.985, 0.66],
          material: 'trim',
        },
        // Kept short enough that the swept end stays over the cowl (z 0.56..0.72)
        // rather than hanging in the air above the hood.
        {
          kind: 'box',
          args: [0.026, 0.022, 0.4],
          position: [side * 0.29, 0.992, 0.585],
          rotation: [0, side * 0.62, 0],
          material: 'trim',
        },
        {
          kind: 'box',
          args: [0.018, 0.03, 0.36],
          position: [side * 0.22, 1.0, 0.565],
          rotation: [0, side * 0.62, 0],
          material: 'shadow',
        },
      ]),
      // Fuel filler cap on the left rear quarter.
      {
        kind: 'cylinder',
        args: [0.056, 0.056, 0.014, 16],
        position: [-0.968, 0.86, -1.02],
        rotation: WHEEL_ROTATION,
        material: 'rim',
      },
      // --- Wheel-arch lips. The wings above only imply an arch by leaving a gap;
      // these are the curve itself, and they are the single most identifiable
      // line on a car body. Radii clear the tyre crown (WHEEL_RADIUS) with room
      // for the arch gap, and the rear runs wider, as rear arches do.
      archLip(-0.955, AXLE_F, 0.435),
      archLip(0.955, AXLE_F, 0.435),
      archLip(-0.945, AXLE_R, 0.455),
      archLip(0.945, AXLE_R, 0.455),
    ],
  },
  {
    id: 'roof',
    stage: 'body-panels',
    material: 'bodyPaint',
    position: [0, ROOF_Y, -0.55],
    explodedOffset: [0, 1.8, 0],
    primitives: [
      // Crowned roof: a flat centre with the outer thirds rolled down. A single
      // slab gives a dead-straight highlight across the roof from every angle,
      // which is the clearest "this is a box" signal on the whole car. Two
      // rotations of 4 deg are enough to bend that highlight.
      { kind: 'box', args: [0.9, 0.075, 0.95] },
      // Rotating about Z tilts a panel that runs along X, dropping its outer
      // edge for a negative angle on the +X side.
      //
      // Wider than the 1.56 m slab this replaces. The side glass sits at x 0.89
      // and the old roof stopped at 0.78, so the greenhouse had a 100 mm slot
      // down each side with the sky visible through it. These now reach 0.86 and
      // cap the glass with a thin reveal, which is how flush glazing actually sits.
      { kind: 'box', args: [0.5, 0.062, 0.95], position: [-0.61, -0.012, 0], rotation: [0, 0, 0.07] },
      { kind: 'box', args: [0.5, 0.062, 0.95], position: [0.61, -0.012, 0], rotation: [0, 0, -0.07] },
      // A-pillars: same 25 deg rake and length as the windscreen, set just
      // outboard of the glass so they frame it instead of intersecting it.
      { kind: 'box', args: [0.08, 0.05, 0.88], position: [-0.76, -0.185, 0.87], rotation: [0.44, 0, 0] },
      { kind: 'box', args: [0.08, 0.05, 0.88], position: [0.76, -0.185, 0.87], rotation: [0.44, 0, 0] },
      // C-pillars, leaning back onto the rear quarters.
      { kind: 'box', args: [0.1, 0.43, 0.1], position: [-0.72, -0.1825, -0.61], rotation: [0.7, 0, 0] },
      { kind: 'box', args: [0.1, 0.43, 0.1], position: [0.72, -0.1825, -0.61], rotation: [0.7, 0, 0] },
      // Backlight, filling the hole between them at the same rake. Carried by the
      // roof so it arrives with the pillars that frame it, and inset 10 mm ahead
      // of them so the pillars read as structure in front of glass.
      { kind: 'box', args: [1.38, 0.42, 0.02], position: [0, -0.1825, -0.60], rotation: [0.7, 0, 0], material: 'glass' },
      // Frit round its top and bottom edges, matching the side glass.
      { kind: 'box', args: [1.38, 0.03, 0.03], position: [0, -0.026, -0.474], rotation: [0.7, 0, 0], material: 'shadow' },
      { kind: 'box', args: [1.38, 0.03, 0.03], position: [0, -0.339, -0.737], rotation: [0.7, 0, 0], material: 'shadow' },
      // Side glazing, filling beltline (0.90) to roof (1.21). Carried by the roof
      // rather than the windshield part because the roof frame is unrotated, so
      // the coordinates in `sideGlazing` stay readable against the pillars above.
      //
      // Tilted 3 deg inboard at the top: tumblehome. Every road car has it, and
      // vertical glass on a tapering body is what makes a greenhouse read as a
      // bus. The rotation moves the top edge 8 mm in and the sill 8 mm out, which
      // still lands inside the door's 70 mm thickness at the beltline.
      ...sideGlazing(-1),
      ...sideGlazing(1),
    ],
  },
  {
    id: 'door_L',
    stage: 'body-panels',
    material: 'bodyPaint',
    // Spans sill top to beltline, inset from both by the shut line below.
    position: [-0.9, (SILL_TOP + BELTLINE) / 2, 0.02],
    explodedOffset: [-2.6, 0.1, 0],
    // Swings in from a slightly open pose rather than sliding flat.
    explodedRotation: [0, -0.5, 0],
    primitives: door(-1),
  },
  {
    id: 'door_R',
    stage: 'body-panels',
    material: 'bodyPaint',
    position: [0.9, (SILL_TOP + BELTLINE) / 2, 0.02],
    explodedOffset: [2.6, 0.1, 0],
    explodedRotation: [0, 0.5, 0],
    primitives: door(1),
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
    primitives: [
      // Crowned, like the roof: flat centre, outer thirds rolled down 4 deg. A
      // hood is the largest flat the camera ever sees, so a dead-straight
      // reflection across it is the most expensive thing to leave in.
      { kind: 'box', args: [0.9, 0.075, 1.21] },
      // Out to x 0.855, 15 mm short of the wings' inner faces at 0.87. At the
      // previous 0.825 there was a 45 mm slot down each side of the hood with
      // nothing under it — from a high three-quarter view you could see the
      // garage floor through the bodywork.
      { kind: 'box', args: [0.46, 0.062, 1.21], position: [-0.625, -0.014, 0], rotation: [0, 0, 0.07] },
      { kind: 'box', args: [0.46, 0.062, 1.21], position: [0.625, -0.014, 0], rotation: [0, 0, -0.07] },
      // Shallower inset than the other panels: the plate must stay above 0.818,
      // where the engine's air box and the radiator rail already are. It is also
      // what closes off the hood-to-wing gap from above.
      shutLine('y', [1.73, 0.016, 1.218], -0.026),
      // Extraction vents. Dark slots, so they read as holes into the bay rather
      // than as decals.
      { kind: 'box', args: [0.26, 0.03, 0.15], position: [-0.36, 0.03, -0.3], material: 'shadow' },
      { kind: 'box', args: [0.26, 0.03, 0.15], position: [0.36, 0.03, -0.3], material: 'shadow' },
    ],
  },
  {
    id: 'trunk',
    stage: 'body-panels',
    material: 'bodyPaint',
    // Moved back and shortened from a 0.92 m deck centred at z -1.42. The lid
    // used to run forward to z -0.95, straight under the roof's rear overhang,
    // which left nowhere for a backlight — and a car with no rear window reads as
    // a convertible with the roof left on. It now starts at z -1.31, just behind
    // where the C-pillars and the new backlight land.
    position: [0, 0.99, -1.6],
    rotation: [0.04, 0, 0],
    explodedOffset: [0, 1.3, -1.5],
    explodedRotation: [0.9, 0, 0],
    primitives: [
      // Same reasoning as the hood: out to x 0.85 against the rear quarters at
      // 0.86, or the boot has an 85 mm slot down each side of the lid.
      { kind: 'box', args: [1.7, 0.07, 0.58] },
      shutLine('y', [1.72, 0.02, 0.588], -0.04),
      // Ducktail lip. Two centimetres of raised trailing edge is the whole
      // difference between a saloon boot lid and a sports car's.
      { kind: 'box', args: [1.46, 0.055, 0.11], position: [0, 0.05, -0.25], rotation: [-0.12, 0, 0] },
    ],
  },
  {
    id: 'bumper_F',
    // Body-coloured, not dark trim. A black bar across the full width of the nose
    // and tail is a 1980s bumper; on anything modern the bumper skin is painted
    // with the car and only the valance, splitter and grille stay dark. Because
    // the material is the shared bodyPaint, both bumpers get primed and sprayed
    // by the paint scene along with every other panel.
    stage: 'body-panels',
    material: 'bodyPaint',
    position: [0, 0.44, 2.09],
    explodedOffset: [0, 0, 3.4],
    primitives: [
      { kind: 'box', args: [1.9, 0.28, 0.16] },
      { kind: 'box', args: [1.5, 0.14, 0.1], position: [0, -0.2, 0.02], material: 'trim' },
      // --- Grille. The nose was a blank wall, and a car with no aperture reads
      // as a bar of soap. The recess is near-black and set behind the front face,
      // so the slats in front of it cast into real depth rather than sitting on a
      // painted rectangle.
      { kind: 'box', args: [1.16, 0.15, 0.05], position: [0, -0.05, 0.035], material: 'shadow' },
      ...Array.from({ length: 4 }, (_, i): Primitive => ({
        kind: 'box',
        args: [1.14, 0.018, 0.026],
        position: [0, -0.05 + (i - 1.5) * 0.042, 0.072],
        material: 'trim',
      })),
      // Corner intakes, flanking the grille.
      { kind: 'box', args: [0.26, 0.1, 0.04], position: [-0.74, -0.07, 0.06], material: 'shadow' },
      { kind: 'box', args: [0.26, 0.1, 0.04], position: [0.74, -0.07, 0.06], material: 'shadow' },
      // Front plate, above the grille.
      { kind: 'box', args: [0.5, 0.11, 0.014], position: [0, 0.075, 0.086], material: 'plate' },
      // Splitter, running forward under the whole fascia. Reads as aero and, more
      // usefully, gives the nose a hard shadow line that stops it looking tall.
      // 5 cm proud of the bumper face, not 14: any more and the car's overall
      // length stops matching the 4.25 m footprint the silhouette is built to.
      { kind: 'box', args: [1.86, 0.028, 0.26], position: [0, -0.145, 0.02], material: 'trim' },
    ],
  },
  {
    id: 'bumper_R',
    stage: 'body-panels',
    material: 'bodyPaint',
    position: [0, 0.46, -2.0],
    explodedOffset: [0, 0, -3.4],
    primitives: [
      { kind: 'box', args: [1.88, 0.3, 0.16] },
      { kind: 'box', args: [1.44, 0.14, 0.1], position: [0, -0.2, -0.02], material: 'trim' },
      // Diffuser, with strakes. Same job as the splitter up front: a hard
      // horizontal shadow that pins the tail to the ground. Narrowed to 0.62 so
      // the exhaust tips sit outboard of it rather than inside it, where the
      // black diffuser box swallowed them completely.
      { kind: 'box', args: [0.62, 0.05, 0.26], position: [0, -0.16, -0.05], material: 'shadow' },
      ...Array.from({ length: 3 }, (_, i): Primitive => ({
        kind: 'box',
        args: [0.03, 0.1, 0.24],
        position: [(i - 1) * 0.18, -0.14, -0.05],
        material: 'trim',
      })),
      // --- Exhaust tips, meeting the tailpipes the chassis brings back at
      // x +/-0.40, y 0.315. An open-ended sleeve over a dark bore reads as a pipe
      // you could put a finger in; a solid cylinder reads as a peg.
      ...[-1, 1].flatMap((side): Primitive[] => [
        {
          kind: 'cylinder',
          args: [0.054, 0.05, 0.22, 18],
          position: [side * 0.4, -0.145, -0.06],
          rotation: [Math.PI / 2, 0, 0],
          openEnded: true,
          material: 'chrome',
        },
        {
          kind: 'cylinder',
          args: [0.042, 0.042, 0.19, 14],
          position: [side * 0.4, -0.145, -0.05],
          rotation: [Math.PI / 2, 0, 0],
          material: 'shadow',
        },
      ]),
    ],
  },
  {
    id: 'interior_seats',
    stage: 'interior',
    material: 'interior',
    position: [0, 0.5, -0.2],
    explodedOffset: [0, 1.2, -0.6],
    primitives: [
      // --- Seats. Squab, backrest, side bolsters and a headrest each. The
      // bolsters are what turn a slab into a bucket seat, and both are visible
      // through the side glass on every orbit.
      ...[-1, 1].flatMap((side): Primitive[] => [
        { kind: 'box', args: [0.44, 0.1, 0.46], position: [side * 0.38, 0, 0] },
        { kind: 'box', args: [0.44, 0.52, 0.1], position: [side * 0.38, 0.26, -0.26], rotation: [0.14, 0, 0] },
        // Squab bolsters.
        { kind: 'box', args: [0.08, 0.11, 0.42], position: [side * 0.38 - 0.185, 0.045, 0.01] },
        { kind: 'box', args: [0.08, 0.11, 0.42], position: [side * 0.38 + 0.185, 0.045, 0.01] },
        // Backrest bolsters, leaning with the backrest.
        { kind: 'box', args: [0.08, 0.48, 0.11], position: [side * 0.38 - 0.185, 0.27, -0.21], rotation: [0.14, 0, 0] },
        { kind: 'box', args: [0.08, 0.48, 0.11], position: [side * 0.38 + 0.185, 0.27, -0.21], rotation: [0.14, 0, 0] },
        // Headrest, on two posts.
        { kind: 'box', args: [0.26, 0.16, 0.1], position: [side * 0.38, 0.62, -0.33], rotation: [0.14, 0, 0] },
        { kind: 'box', args: [0.022, 0.08, 0.022], position: [side * 0.38 - 0.07, 0.53, -0.315], material: 'rawMetal' },
        { kind: 'box', args: [0.022, 0.08, 0.022], position: [side * 0.38 + 0.07, 0.53, -0.315], material: 'rawMetal' },
      ]),
      // Transmission tunnel and centre console, between the seats.
      { kind: 'box', args: [0.28, 0.34, 0.86], position: [0, -0.05, 0.06] },
      { kind: 'cylinder', args: [0.016, 0.016, 0.15, 8], position: [0, 0.16, 0.24], material: 'rawMetal' },
      { kind: 'cylinder', args: [0.034, 0.03, 0.06, 12], position: [0, 0.25, 0.24], material: 'trim' },
      { kind: 'box', args: [0.05, 0.03, 0.22], position: [0.1, 0.16, 0.02], material: 'rawMetal' },
      // Dash, stopping short of the cowl.
      { kind: 'box', args: [1.44, 0.2, 0.26], position: [0, 0.28, 0.62] },
      // --- Driver's side. Left-hand drive. A cabin with no steering wheel is the
      // first thing anyone notices once the doors and glass are on.
      { kind: 'box', args: [0.34, 0.14, 0.18], position: [-0.36, 0.42, 0.6], material: 'trim' },
      {
        kind: 'cylinder',
        args: [0.028, 0.028, 0.2, 10],
        position: [-0.36, 0.36, 0.5],
        rotation: [1.05, 0, 0],
        material: 'trim',
      },
      // Rim: torus normals face +Z, so a 1.05 rad tilt about X lays it back at
      // roughly the column angle.
      {
        kind: 'torus',
        args: [0.15, 0.021, 8, 24],
        position: [-0.36, 0.415, 0.415],
        rotation: [1.05, 0, 0],
        material: 'trim',
      },
      ...Array.from({ length: 3 }, (_, i): Primitive => {
        const angle = (i / 3) * Math.PI * 2 + Math.PI / 2
        return {
          kind: 'box',
          args: [0.03, 0.14, 0.02],
          // Spokes live in the wheel's own plane, then the whole thing is tilted
          // with the column.
          position: [-0.36 + Math.cos(angle) * 0.07, 0.415 + Math.sin(angle) * 0.07 * Math.cos(1.05), 0.415 - Math.sin(angle) * 0.07 * Math.sin(1.05)],
          rotation: [1.05, 0, -angle + Math.PI / 2],
          material: 'trim',
        }
      }),
      // Centre screen, angled toward the driver.
      { kind: 'box', args: [0.28, 0.16, 0.014], position: [0.05, 0.42, 0.52], rotation: [0.22, -0.2, 0], material: 'shadow' },
      // Parcel shelf. Runs from the back of the seats (z -0.55) to the leading
      // edge of the boot lid (z -1.52) and out to the inner faces of the rear
      // quarters, because anything short of that leaves an open slot between the
      // cabin and the lid — which is precisely what made the back of the car read
      // as a pickup bed rather than a boot.
      { kind: 'box', args: [1.72, 0.05, 0.97], position: [0, 0.43, -0.835] },
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
    primitives: [
      { kind: 'box', args: [1.48, 0.02, 0.88] },
      // Frit: the black ceramic band printed round the edge of every piece of
      // automotive glazing. It hides the bond line on a real car and, here, stops
      // the pane ending on a bare cut edge that reads as perspex. Thicker than the
      // glass so no face is coplanar with it — coplanar solids z-fight into stripes.
      // 40 mm band. At 70 it stopped reading as a printed edge and started
      // reading as a heavy black window frame bolted round the screen.
      { kind: 'box', args: [1.48, 0.026, 0.04], position: [0, 0, -0.42], material: 'shadow' },
      { kind: 'box', args: [1.48, 0.026, 0.04], position: [0, 0, 0.42], material: 'shadow' },
      { kind: 'box', args: [0.038, 0.026, 0.88], position: [-0.721, 0, 0], material: 'shadow' },
      { kind: 'box', args: [0.038, 0.026, 0.88], position: [0.721, 0, 0], material: 'shadow' },
      // Interior mirror, hanging off the top of the screen where it belongs.
      { kind: 'box', args: [0.036, 0.05, 0.04], position: [-0.12, -0.045, -0.35], material: 'trim' },
      { kind: 'box', args: [0.2, 0.055, 0.03], position: [-0.12, -0.08, -0.3], material: 'trim' },
    ],
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
