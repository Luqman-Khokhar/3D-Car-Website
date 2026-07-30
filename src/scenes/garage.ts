export type Vec3 = [number, number, number]

export type GarageMaterialKey =
  | 'wall'
  | 'ceiling'
  | 'pegboard'
  | 'steel'
  | 'darkMetal'
  | 'wood'
  | 'redPaint'
  | 'crate'
  | 'rubber'
  | 'lamp'
  | 'door'
  | 'drum'
  | 'marking'
  | 'glass'

export type Prop =
  | { kind: 'box'; args: [number, number, number]; position: Vec3; rotation?: Vec3; material: GarageMaterialKey }
  | {
      kind: 'cylinder'
      /** [radiusTop, radiusBottom, height, radialSegments] */
      args: [number, number, number, number]
      position: Vec3
      rotation?: Vec3
      material: GarageMaterialKey
    }
  | {
      kind: 'torus'
      /** [radius, tube, radialSegments, tubularSegments] */
      args: [number, number, number, number]
      position: Vec3
      rotation?: Vec3
      material: GarageMaterialKey
    }

/**
 * Room shell. These bound the camera: CAMERA_KEYS radii and heights must stay
 * inside them or the camera clips through a wall mid-scroll. The room is large
 * for a domestic garage (17 x 19 m) precisely because the reveal orbit swings the
 * camera out to radius 7 and the establishing shot to 9.
 */
export const ROOM_HALF_X = 8.6
export const ROOM_HALF_Z = 9.6
export const ROOM_HEIGHT = 4.2
const WALL_T = 0.24

/** Inner faces, where wall-mounted props sit. */
const BACK = -ROOM_HALF_Z + WALL_T / 2
const LEFT = -ROOM_HALF_X + WALL_T / 2
const RIGHT = ROOM_HALF_X - WALL_T / 2
const FRONT = ROOM_HALF_Z - WALL_T / 2

const box = (
  args: [number, number, number],
  position: Vec3,
  material: GarageMaterialKey,
  rotation?: Vec3,
): Prop => ({ kind: 'box', args, position, material, rotation })

const cyl = (
  args: [number, number, number, number],
  position: Vec3,
  material: GarageMaterialKey,
  rotation?: Vec3,
): Prop => ({ kind: 'cylinder', args, position, material, rotation })

/** Walls, ceiling and skirting. Thin boxes rather than planes so the inner face
 *  is a normal front face — no double-sided material needed from inside. */
function shell(): Prop[] {
  const w = ROOM_HALF_X * 2
  const d = ROOM_HALF_Z * 2
  const h = ROOM_HEIGHT
  return [
    box([w, h, WALL_T], [0, h / 2, -ROOM_HALF_Z], 'wall'),
    box([w, h, WALL_T], [0, h / 2, ROOM_HALF_Z], 'wall'),
    box([WALL_T, h, d], [-ROOM_HALF_X, h / 2, 0], 'wall'),
    box([WALL_T, h, d], [ROOM_HALF_X, h / 2, 0], 'wall'),
    box([w, WALL_T, d], [0, h, 0], 'ceiling'),
    // Skirting, breaking the wall/floor join so it does not read as a seam.
    box([w, 0.16, 0.1], [0, 0.08, BACK - 0.07], 'darkMetal'),
    box([0.1, 0.16, d], [LEFT + 0.07, 0.08, 0], 'darkMetal'),
    box([0.1, 0.16, d], [RIGHT - 0.07, 0.08, 0], 'darkMetal'),
  ]
}

/**
 * Pegboard on the back wall with hand tools hung off it. Tool shapes are
 * deliberately coarse — at the closest camera distance (radius 3.2) they are
 * 6 m away, so silhouette is all that survives.
 */
function toolWall(): Prop[] {
  const props: Prop[] = []
  const z = BACK + 0.09
  const boardY = 2.15

  props.push(box([6.4, 1.9, 0.06], [-1.2, boardY, z], 'pegboard'))
  // Board frame.
  props.push(box([6.6, 0.07, 0.09], [-1.2, boardY + 0.98, z], 'darkMetal'))
  props.push(box([6.6, 0.07, 0.09], [-1.2, boardY - 0.98, z], 'darkMetal'))

  const t = z + 0.07

  // --- Spanners: a descending size run, the classic pegboard read.
  for (let i = 0; i < 7; i++) {
    const len = 0.5 - i * 0.045
    const x = -3.95 + i * 0.29
    props.push(box([0.055, len, 0.03], [x, boardY + 0.62 - len / 2, t], 'steel'))
    // Open jaws at each end.
    props.push(box([0.11, 0.1, 0.035], [x, boardY + 0.62, t], 'steel'))
    props.push(box([0.1, 0.09, 0.035], [x, boardY + 0.62 - len, t], 'steel'))
  }

  // --- Screwdrivers: shaft plus a coloured handle.
  for (let i = 0; i < 6; i++) {
    const x = -1.75 + i * 0.23
    const len = 0.34 + (i % 3) * 0.05
    props.push(cyl([0.014, 0.014, len, 6], [x, boardY + 0.5 - len / 2, t], 'steel'))
    props.push(cyl([0.035, 0.028, 0.15, 8], [x, boardY + 0.56, t], 'redPaint'))
  }

  // --- Hammers, heads outward.
  for (let i = 0; i < 2; i++) {
    const x = 0.05 + i * 0.4
    props.push(cyl([0.022, 0.026, 0.36, 8], [x, boardY + 0.34, t], 'wood'))
    props.push(box([0.24, 0.09, 0.09], [x, boardY + 0.56, t], 'darkMetal'))
    props.push(box([0.08, 0.13, 0.1], [x + 0.13, boardY + 0.55, t], 'darkMetal'))
  }

  // --- Handsaw.
  props.push(box([0.62, 0.2, 0.02], [1.55, boardY + 0.5, t], 'steel', [0, 0, -0.22]))
  props.push(box([0.16, 0.13, 0.05], [1.19, boardY + 0.61, t], 'wood'))

  // --- Pliers and clamps, hung as short pairs.
  for (let i = 0; i < 4; i++) {
    const x = 2.35 + i * 0.26
    props.push(box([0.05, 0.26, 0.028], [x - 0.02, boardY + 0.42, t], 'darkMetal', [0, 0, 0.07]))
    props.push(box([0.05, 0.26, 0.028], [x + 0.02, boardY + 0.42, t], 'darkMetal', [0, 0, -0.07]))
    props.push(box([0.05, 0.11, 0.032], [x, boardY + 0.3, t], 'redPaint'))
  }

  // --- Coiled air hose on a reel.
  props.push(cyl([0.34, 0.34, 0.12, 20], [-3.1, boardY - 0.45, t + 0.1], 'darkMetal', [Math.PI / 2, 0, 0]))
  props.push(cyl([0.22, 0.22, 0.16, 16], [-3.1, boardY - 0.45, t + 0.1], 'redPaint', [Math.PI / 2, 0, 0]))

  // --- Clipboard and a taped-up sheet, the detail that reads as "used".
  props.push(box([0.3, 0.42, 0.02], [3.6, boardY + 0.35, t], 'wall'))
  props.push(box([0.26, 0.34, 0.01], [3.62, boardY + 0.3, t + 0.02], 'ceiling'))

  return props
}

/** Workbench under the tool wall, with a vice and clutter. */
function workbench(): Prop[] {
  const z = BACK + 0.55
  const y = 0.92
  const props: Prop[] = [
    box([3.4, 0.08, 0.86], [-2.4, y, z], 'wood'),
    // Apron and legs.
    box([3.4, 0.14, 0.06], [-2.4, y - 0.11, z + 0.4], 'wood'),
    box([0.09, y, 0.09], [-3.98, y / 2, z + 0.34], 'darkMetal'),
    box([0.09, y, 0.09], [-0.82, y / 2, z + 0.34], 'darkMetal'),
    box([0.09, y, 0.09], [-3.98, y / 2, z - 0.34], 'darkMetal'),
    box([0.09, y, 0.09], [-0.82, y / 2, z - 0.34], 'darkMetal'),
    // Lower shelf with stored boxes.
    box([3.2, 0.05, 0.7], [-2.4, 0.3, z], 'steel'),
    box([0.5, 0.34, 0.44], [-3.4, 0.5, z], 'crate'),
    box([0.42, 0.28, 0.4], [-2.75, 0.47, z], 'crate'),
    // Bench vice.
    box([0.26, 0.16, 0.2], [-1.35, y + 0.12, z - 0.18], 'darkMetal'),
    box([0.1, 0.2, 0.24], [-1.2, y + 0.14, z - 0.18], 'darkMetal'),
    cyl([0.018, 0.018, 0.32, 8], [-1.35, y + 0.22, z - 0.18], 'steel', [0, 0, Math.PI / 2]),
    // Clutter on the top.
    box([0.34, 0.12, 0.26], [-3.3, y + 0.1, z - 0.1], 'redPaint'),
    cyl([0.06, 0.06, 0.18, 12], [-2.5, y + 0.13, z - 0.2], 'drum'),
    cyl([0.05, 0.05, 0.14, 12], [-2.3, y + 0.11, z - 0.05], 'steel'),
    box([0.44, 0.06, 0.3], [-1.85, y + 0.07, z + 0.1], 'darkMetal'),
  ]
  return props
}

/** Steel shelving unit on the left wall, loaded with crates, cans and tyres. */
function shelving(): Prop[] {
  const props: Prop[] = []
  const x = LEFT + 0.55
  const shelfY = [0.42, 1.12, 1.82, 2.52]
  const zc = -3.4
  const depth = 1.0
  const width = 4.2

  // Uprights.
  for (const dz of [-width / 2, width / 2]) {
    for (const dx of [-depth / 2, depth / 2]) {
      props.push(box([0.07, 2.95, 0.07], [x + dx, 1.48, zc + dz], 'steel'))
    }
  }
  // Shelves plus edge lips.
  for (const y of shelfY) {
    props.push(box([depth, 0.045, width], [x, y, zc], 'steel'))
    props.push(box([0.03, 0.07, width], [x + depth / 2, y + 0.05, zc], 'steel'))
  }

  // Load. Varied sizes and slight rotations so it does not read as a grid.
  const load: Array<[number, number, number, GarageMaterialKey]> = [
    [0, -1.5, 0.5, 'crate'],
    [0, -0.75, 0.42, 'crate'],
    [0, 0.1, 0.46, 'crate'],
    [1, -1.6, 0.38, 'crate'],
    [1, -0.9, 0.44, 'redPaint'],
    [1, 1.2, 0.4, 'crate'],
    [2, -1.4, 0.42, 'crate'],
    [2, 0.6, 0.36, 'crate'],
    [3, -1.2, 0.46, 'crate'],
    [3, 0.9, 0.4, 'crate'],
  ]
  for (const [tier, dz, size, material] of load) {
    const y = shelfY[tier] + size / 2 + 0.03
    props.push(
      box([size * 0.9, size, size * 1.05], [x, y, zc + dz], material, [0, dz * 0.06, 0]),
    )
  }

  // Paint and oil cans in a row.
  for (let i = 0; i < 6; i++) {
    props.push(
      cyl([0.1, 0.1, 0.26, 12], [x + 0.2, shelfY[1] + 0.16, zc + 0.35 + i * 0.24], i % 2 ? 'drum' : 'redPaint'),
    )
  }
  for (let i = 0; i < 5; i++) {
    props.push(
      cyl([0.085, 0.085, 0.2, 12], [x - 0.15, shelfY[2] + 0.13, zc + 1.0 + i * 0.22], 'steel'),
    )
  }

  // Tyre stack beside the shelving.
  for (let i = 0; i < 5; i++) {
    props.push(
      cyl([0.34, 0.34, 0.23, 24], [x + 0.05, 0.12 + i * 0.23, zc + 3.1], 'rubber', [0, i * 0.4, 0]),
    )
  }

  return props
}

/** Roller cabinet, drums and a compressor along the right wall. */
function rightBay(): Prop[] {
  const x = RIGHT - 0.6
  const props: Prop[] = []

  // Roller tool cabinet with drawer fronts and castors.
  const cy = 0.52
  props.push(box([0.92, 1.0, 1.5], [x, cy + 0.1, -1.4], 'redPaint'))
  props.push(box([0.96, 0.06, 1.56], [x, cy + 0.63, -1.4], 'darkMetal'))
  for (let i = 0; i < 4; i++) {
    props.push(box([0.02, 0.03, 1.34], [x - 0.47, 0.24 + i * 0.24, -1.4], 'darkMetal'))
    props.push(box([0.04, 0.05, 0.42], [x - 0.48, 0.24 + i * 0.24, -1.4], 'steel'))
  }
  for (const dz of [-0.55, 0.55]) {
    props.push(cyl([0.07, 0.07, 0.06, 10], [x, 0.07, -1.4 + dz], 'darkMetal', [Math.PI / 2, 0, 0]))
  }

  // Oil drums with rolling ribs.
  for (let i = 0; i < 3; i++) {
    const z = 1.4 + i * 0.72
    props.push(cyl([0.29, 0.29, 0.88, 20], [x - 0.05, 0.44, z], i === 1 ? 'redPaint' : 'drum'))
    props.push({ kind: 'torus', args: [0.29, 0.022, 6, 20], position: [x - 0.05, 0.6, z], rotation: [Math.PI / 2, 0, 0], material: 'darkMetal' })
    props.push({ kind: 'torus', args: [0.29, 0.022, 6, 20], position: [x - 0.05, 0.3, z], rotation: [Math.PI / 2, 0, 0], material: 'darkMetal' })
  }

  // Compressor: tank, motor, legs.
  props.push(cyl([0.26, 0.26, 1.15, 18], [x, 0.42, 4.3], 'drum', [0, 0, Math.PI / 2]))
  props.push(box([0.34, 0.26, 0.4], [x, 0.74, 4.3], 'darkMetal'))
  props.push(cyl([0.12, 0.12, 0.22, 14], [x, 0.86, 4.3], 'steel', [0, 0, Math.PI / 2]))
  for (const dz of [-0.42, 0.42]) {
    props.push(box([0.08, 0.16, 0.08], [x, 0.08, 4.3 + dz], 'darkMetal'))
  }

  // Wall-mounted extinguisher, and a rolled hose.
  props.push(cyl([0.09, 0.09, 0.42, 12], [RIGHT - 0.15, 1.35, 0.4], 'redPaint'))
  props.push(box([0.06, 0.1, 0.14], [RIGHT - 0.15, 1.62, 0.4], 'darkMetal'))

  return props
}

/** Sectional garage door on the front wall. */
function garageDoor(): Prop[] {
  const props: Prop[] = []
  const z = FRONT - 0.1
  const panels = 5
  const panelH = 0.62

  for (let i = 0; i < panels; i++) {
    const y = 0.36 + i * (panelH + 0.03)
    props.push(box([5.0, panelH, 0.08], [0, y, z], 'door'))
    // Two ribs per panel.
    props.push(box([4.86, 0.05, 0.03], [0, y + 0.16, z - 0.05], 'darkMetal'))
    props.push(box([4.86, 0.05, 0.03], [0, y - 0.16, z - 0.05], 'darkMetal'))
  }
  // Guide rails and header.
  props.push(box([0.1, 3.5, 0.14], [-2.55, 1.75, z - 0.06], 'darkMetal'))
  props.push(box([0.1, 3.5, 0.14], [2.55, 1.75, z - 0.06], 'darkMetal'))
  props.push(box([5.4, 0.16, 0.2], [0, 3.6, z - 0.06], 'darkMetal'))

  return props
}

/** Ceiling strip lights. Emissive only — adding real lights per fixture would
 *  cost a full lighting term per fragment across the whole scene. */
function ceilingLights(): Prop[] {
  const props: Prop[] = []
  const y = ROOM_HEIGHT - 0.22

  for (const x of [-3.4, 1.6]) {
    for (const z of [-4.6, 1.4, 6.2]) {
      // Housing.
      props.push(box([0.34, 0.12, 2.5], [x, y + 0.08, z], 'darkMetal'))
      // Tube.
      props.push(box([0.26, 0.07, 2.36], [x, y, z], 'lamp'))
      // Chains.
      props.push(box([0.03, 0.22, 0.03], [x, y + 0.2, z - 1.1], 'darkMetal'))
      props.push(box([0.03, 0.22, 0.03], [x, y + 0.2, z + 1.1], 'darkMetal'))
    }
  }
  return props
}

/** Floor markings: a painted bay outline. Flat boxes just above the floor. */
function floorMarkings(): Prop[] {
  const y = 0.006
  return [
    box([0.08, 0.012, 6.4], [-1.75, y, 0.2], 'marking'),
    box([0.08, 0.012, 6.4], [1.75, y, 0.2], 'marking'),
    box([3.5, 0.012, 0.08], [0, y, -3.0], 'marking'),
  ]
}

/**
 * Left-wall dressing: a high window, a clock, and signage. The establishing shot
 * looks straight at this wall, and a 17 m blank expanse reads as unfinished.
 */
function leftWallDetail(): Prop[] {
  const x = LEFT + 0.06
  const props: Prop[] = []

  // Window: frame, glazing, and two mullions.
  const wy = 2.9
  const wz = 3.2
  props.push(box([0.1, 1.15, 2.5], [x, wy, wz], 'darkMetal'))
  props.push(box([0.04, 1.0, 2.35], [x + 0.05, wy, wz], 'glass'))
  props.push(box([0.07, 1.0, 0.05], [x + 0.05, wy, wz], 'darkMetal'))
  props.push(box([0.07, 0.05, 2.35], [x + 0.05, wy, wz], 'darkMetal'))
  // Sill.
  props.push(box([0.16, 0.06, 2.6], [x + 0.04, wy - 0.6, wz], 'wall'))

  // Wall clock.
  props.push(cyl([0.26, 0.26, 0.07, 20], [x + 0.04, 2.45, -0.6], 'wall', [0, 0, Math.PI / 2]))
  props.push(cyl([0.22, 0.22, 0.02, 20], [x + 0.09, 2.45, -0.6], 'ceiling', [0, 0, Math.PI / 2]))
  props.push(box([0.02, 0.03, 0.16], [x + 0.11, 2.45, -0.55], 'darkMetal'))
  props.push(box([0.02, 0.11, 0.02], [x + 0.11, 2.5, -0.6], 'darkMetal'))

  // Signage boards.
  props.push(box([0.03, 0.42, 0.32], [x + 0.05, 2.3, 6.4], 'redPaint'))
  props.push(box([0.03, 0.3, 0.42], [x + 0.05, 1.75, 6.4], 'drum'))

  return props
}

/** Floor clutter that sells scale and use: trolley jack, pallets, bin, broom. */
function floorClutter(): Prop[] {
  const props: Prop[] = []

  // Trolley jack, parked near the left wall.
  const jx = LEFT + 1.9
  const jz = 5.4
  props.push(box([0.34, 0.13, 1.0], [jx, 0.14, jz], 'redPaint'))
  props.push(box([0.28, 0.1, 0.34], [jx, 0.26, jz - 0.2], 'redPaint'))
  props.push(cyl([0.03, 0.03, 0.9, 8], [jx, 0.42, jz + 0.55], 'steel', [0.5, 0, 0]))
  for (const [dx, dz] of [
    [-0.15, -0.42],
    [0.15, -0.42],
    [-0.15, 0.42],
    [0.15, 0.42],
  ]) {
    props.push(cyl([0.07, 0.07, 0.05, 10], [jx + dx, 0.07, jz + dz], 'darkMetal', [0, 0, Math.PI / 2]))
  }

  // Stacked pallets in the back corner.
  for (let i = 0; i < 4; i++) {
    const y = 0.07 + i * 0.14
    props.push(box([1.1, 0.04, 1.1], [LEFT + 1.2, y, BACK + 1.1], 'wood'))
    props.push(box([1.1, 0.09, 0.11], [LEFT + 1.2, y - 0.06, BACK + 0.65], 'wood'))
    props.push(box([1.1, 0.09, 0.11], [LEFT + 1.2, y - 0.06, BACK + 1.55], 'wood'))
  }

  // Waste bin and a broom leaning on the wall.
  props.push(cyl([0.28, 0.23, 0.72, 14], [RIGHT - 0.55, 0.36, -4.6], 'darkMetal'))
  props.push(cyl([0.022, 0.022, 1.4, 8], [RIGHT - 0.35, 0.7, -5.6], 'wood', [0.12, 0, 0]))
  props.push(box([0.34, 0.07, 0.1], [RIGHT - 0.43, 0.05, -5.68], 'darkMetal'))

  // Cable drum on the floor.
  props.push(cyl([0.3, 0.3, 0.28, 18], [LEFT + 1.4, 0.3, 7.8], 'darkMetal', [0, 0, Math.PI / 2]))

  return props
}

/** Everything static in the room, built once at module scope. */
export const GARAGE_PROPS: Prop[] = [
  ...shell(),
  ...toolWall(),
  ...workbench(),
  ...shelving(),
  ...rightBay(),
  ...garageDoor(),
  ...ceilingLights(),
  ...floorMarkings(),
  ...leftWallDetail(),
  ...floorClutter(),
]
