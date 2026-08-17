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
  /** Galvanised conduit, trunking, door hardware. Bright, slightly rough metal. */
  | 'galv'
  /** Weathered, oxidised steel — brackets, older fixings, the drum ribs. */
  | 'rust'
  /** Safety yellow: bollards, floor hatching, the cord reel. */
  | 'yellow'
  /** Painted dado band around the base of the walls. */
  | 'dado'
  /** Exposed ceiling steelwork. Painted, not bare — bare metal up there reads as
   *  a black bar because almost no light reaches the underside of a joist. */
  | 'structure'
  /** Slab joints, drain slots and other recesses. Dark and dead matte, so they
   *  read as gaps rather than as painted lines. */
  | 'seam'

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

/** Actual hole in the front wall the sectional door sits in — floor to header,
 *  so opening the door has somewhere to reveal rather than the wall behind it. */
const DOOR_OPENING_HALF_WIDTH = 2.6
const DOOR_OPENING_HEIGHT = 3.62

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
  // Front wall is built around the door opening rather than as one slab: a
  // door leaf that retracts needs an actual hole behind it, not a solid wall
  // that happens to be dressed with panels.
  const openHalfW = DOOR_OPENING_HALF_WIDTH
  const openH = DOOR_OPENING_HEIGHT
  const sideW = ROOM_HALF_X - openHalfW
  return [
    box([w, h, WALL_T], [0, h / 2, -ROOM_HALF_Z], 'wall'),
    box([sideW, h, WALL_T], [-(openHalfW + sideW / 2), h / 2, ROOM_HALF_Z], 'wall'),
    box([sideW, h, WALL_T], [openHalfW + sideW / 2, h / 2, ROOM_HALF_Z], 'wall'),
    box([openHalfW * 2, h - openH, WALL_T], [0, openH + (h - openH) / 2, ROOM_HALF_Z], 'wall'),
    box([WALL_T, h, d], [-ROOM_HALF_X, h / 2, 0], 'wall'),
    box([WALL_T, h, d], [ROOM_HALF_X, h / 2, 0], 'wall'),
    box([w, WALL_T, d], [0, h, 0], 'ceiling'),
    // Skirting, breaking the wall/floor join so it does not read as a seam.
    // BACK is the inner face, so the offset has to be +z to sit in the room —
    // this used to be -0.07 and the whole strip was buried inside the wall.
    box([w, 0.16, 0.1], [0, 0.08, BACK + 0.07], 'darkMetal'),
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

/**
 * Sectional door's closed face, on the front wall. The moving leaf (panels,
 * ribs, vision lights, seal, handle) is not part of the static room — it lives
 * in DOOR_PANELS below and is driven every frame by GarageDoor.tsx, so both the
 * static surround here and the animated leaf agree on the same face plane.
 */
export const DOOR_Z = FRONT - 0.1

/** Door surround only: guide rails and header. The leaf itself is dynamic. */
function garageDoor(): Prop[] {
  const z = DOOR_Z
  return [
    box([0.1, 3.5, 0.14], [-2.55, 1.75, z - 0.06], 'darkMetal'),
    box([0.1, 3.5, 0.14], [2.55, 1.75, z - 0.06], 'darkMetal'),
    box([5.4, 0.16, 0.2], [0, 3.6, z - 0.06], 'darkMetal'),
  ]
}

/**
 * Moving-leaf geometry and kinematics for the sectional door.
 *
 * A real sectional door is a chain of rigid panels riding a track that runs
 * straight up beside the opening, then curves onto a horizontal run along the
 * ceiling. The panels don't each animate independently — they stay spaced
 * exactly as they were when closed and the whole chain advances by one
 * arc-length parameter, `s`. Low panels are still straight and vertical while
 * a high panel is already mid-curve, which is exactly what makes a real door
 * look like a chain going over a pulley rather than a shutter sliding up.
 *
 * `s` is measured in metres from the floor: 0..DOOR_CURVE_START_Y is the
 * straight vertical run (s === world Y), DOOR_CURVE_START_Y.. is the quarter
 * -circle bend, and beyond that it is metres travelled horizontally into the
 * bay along the ceiling track.
 */
export const DOOR_PANEL_COUNT = 5
const DOOR_PANEL_H = 0.62
const DOOR_PANEL_GAP = 0.03
export const DOOR_PANEL_SPACING = DOOR_PANEL_H + DOOR_PANEL_GAP
export const DOOR_WIDTH = 5.0

/** Height of the horizontal ceiling track, matching the header hardware above. */
export const DOOR_TRACK_Y = DOOR_OPENING_HEIGHT
/** Bend radius of the curve from vertical rail onto the horizontal track. */
export const DOOR_CURVE_RADIUS = 0.3
/** Arc-length where the vertical run ends and the curve begins. */
export const DOOR_CURVE_START_S = DOOR_TRACK_Y - DOOR_CURVE_RADIUS
/** Arc-length where the curve ends and the horizontal run begins. */
export const DOOR_CURVE_END_S = DOOR_CURVE_START_S + DOOR_CURVE_RADIUS * (Math.PI / 2)
/** Total arc-length the chain advances going from fully closed to fully open —
 *  one door-height's worth, so the bottom panel ends up where the top panel
 *  started and the chain never stretches or gaps. */
export const DOOR_OPEN_TRAVEL = 3.9

/** A single flat piece riding on a door panel, in the panel's own rest frame
 *  (offset from the panel's closed-position centre at (0, restY, DOOR_Z)). */
export interface DoorPart {
  args: [number, number, number]
  offset: Vec3
  material: GarageMaterialKey
}

export interface DoorPanel {
  index: number
  /** Arc-length coordinate of this panel's centre when the door is closed —
   *  equal to its closed-position world Y, since the vertical run is 1:1 with
   *  world Y. */
  restS: number
  parts: DoorPart[]
}

function buildDoorPanels(): DoorPanel[] {
  const panels: DoorPanel[] = []

  for (let i = 0; i < DOOR_PANEL_COUNT; i++) {
    const restS = 0.36 + i * DOOR_PANEL_SPACING
    const parts: DoorPart[] = [
      { args: [DOOR_WIDTH, DOOR_PANEL_H, 0.08], offset: [0, 0, 0], material: 'door' },
      { args: [4.86, 0.05, 0.03], offset: [0, 0.16, -0.05], material: 'darkMetal' },
      { args: [4.86, 0.05, 0.03], offset: [0, -0.16, -0.05], material: 'darkMetal' },
    ]

    // Weather seal along the bottom edge of the bottom panel.
    if (i === 0) {
      parts.push({ args: [DOOR_WIDTH, 0.06, 0.11], offset: [0, 0.055 - restS, 0], material: 'rubber' })
    }
    // Lift handle, roughly waist height.
    if (i === 1) {
      parts.push({ args: [0.34, 0.06, 0.05], offset: [0, 0.72 - restS, -0.07], material: 'steel' })
    }
    // Vision lights in the top panel: frame behind, glazing proud of the face.
    if (i === DOOR_PANEL_COUNT - 1) {
      for (let v = 0; v < 4; v++) {
        const x = -1.65 + v * 1.1
        parts.push({ args: [0.7, 0.38, 0.02], offset: [x, 2.95 - restS, -0.05], material: 'darkMetal' })
        parts.push({ args: [0.62, 0.3, 0.02], offset: [x, 2.95 - restS, -0.07], material: 'glass' })
      }
    }

    panels.push({ index: i, restS, parts })
  }

  return panels
}

export const DOOR_PANELS: DoorPanel[] = buildDoorPanels()

/**
 * Maps an arc-length position to a world (y, z) and an X rotation, for the
 * door's own centre plane (x = 0, wall face). Used every frame per panel — see
 * GarageDoor.tsx.
 */
export function doorPanelPose(s: number): { y: number; z: number; rotX: number } {
  if (s <= DOOR_CURVE_START_S) {
    return { y: s, z: DOOR_Z, rotX: 0 }
  }
  if (s <= DOOR_CURVE_END_S) {
    const theta = (s - DOOR_CURVE_START_S) / DOOR_CURVE_RADIUS
    const z = DOOR_Z - DOOR_CURVE_RADIUS + DOOR_CURVE_RADIUS * Math.cos(theta)
    const y = DOOR_CURVE_START_S + DOOR_CURVE_RADIUS * Math.sin(theta)
    return { y, z, rotX: -theta }
  }
  const extra = s - DOOR_CURVE_END_S
  return { y: DOOR_TRACK_Y, z: DOOR_Z - DOOR_CURVE_RADIUS - extra, rotX: -Math.PI / 2 }
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
const CLOCK_Y = 2.45
const CLOCK_Z = -0.6

/**
 * Front face of the wall clock, in world space. The hands are rendered outside
 * the merged geometry so they can turn, and hang off this point.
 */
export const CLOCK_FACE_CENTER: Vec3 = [LEFT + 0.16, CLOCK_Y, CLOCK_Z]

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

  // Wall clock. Bezel, face and hour ticks are static and merged with the rest of
  // the room; the hands are live (see WallClock) and mount at CLOCK_FACE_CENTER.
  props.push(cyl([0.26, 0.26, 0.07, 20], [x + 0.04, CLOCK_Y, CLOCK_Z], 'wall', [0, 0, Math.PI / 2]))
  props.push(cyl([0.22, 0.22, 0.02, 20], [x + 0.09, CLOCK_Y, CLOCK_Z], 'ceiling', [0, 0, Math.PI / 2]))
  // Hour ticks, so the hands read as a time rather than as two sticks. Rotating
  // about X keeps a tick flat against the face, whose normal is +X.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const r = 0.185
    const quarter = i % 3 === 0
    props.push(
      box(
        [0.012, quarter ? 0.044 : 0.024, quarter ? 0.018 : 0.012],
        [x + 0.1, CLOCK_Y + r * Math.cos(a), CLOCK_Z - r * Math.sin(a)],
        'darkMetal',
        [-a, 0, 0],
      ),
    )
  }

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

/**
 * Exposed ceiling structure: cross joists and a spine beam.
 *
 * A flat ceiling plane is the single flattest thing in the room — it fills the
 * top of every wide shot with one unbroken value and gives the eye nothing to
 * judge height by. Joists put a repeating, receding rhythm up there, which is
 * what actually communicates the ceiling's distance.
 *
 * The Z positions are chosen to fall in the gaps between the three rows of strip
 * lights (which span z ±1.25 about -4.6, 1.4 and 6.2), so nothing intersects a
 * fixture. Everything sits above y 3.8, well clear of the camera's 3.1 m ceiling.
 */
function ceilingStructure(): Prop[] {
  const props: Prop[] = []
  const w = ROOM_HALF_X * 2
  const webY = ROOM_HEIGHT - 0.19
  const flangeY = ROOM_HEIGHT - 0.36

  for (const z of [-7.6, -1.6, 3.8, 8.6]) {
    // Web and bottom flange: an inverted T, which is what reads as a joist from
    // below without modelling a section.
    props.push(box([w, 0.34, 0.14], [0, webY, z], 'structure'))
    props.push(box([w, 0.06, 0.34], [0, flangeY, z], 'structure'))
    // Bolted end plates where the joist lands on the wall.
    props.push(box([0.26, 0.4, 0.24], [-ROOM_HALF_X + 0.2, webY - 0.03, z], 'galv'))
    props.push(box([0.26, 0.4, 0.24], [ROOM_HALF_X - 0.2, webY - 0.03, z], 'galv'))
  }

  // Spine beam down the middle of the bay, between the two lamp rows.
  props.push(box([0.24, 0.44, ROOM_HALF_Z * 2], [-0.9, ROOM_HEIGHT - 0.24, 0], 'structure'))
  props.push(box([0.44, 0.06, ROOM_HALF_Z * 2], [-0.9, ROOM_HEIGHT - 0.45, 0], 'structure'))

  return props
}

/**
 * Wall trim: skirting-height wainscot, a cap rail, a cornice, corner posts and
 * panel seams.
 *
 * All of it is there for one reason — an unbroken 4.2 m wall has no scale. Bands
 * at 1.15 m and at the ceiling give the eye two known heights to measure the room
 * against, and the vertical seams give it a repeating horizontal interval. That
 * is most of what "well defined" means for a room: readable intervals, not more
 * objects.
 */
function wallTrim(): Prop[] {
  const props: Prop[] = []
  const w = ROOM_HALF_X * 2
  const d = ROOM_HALF_Z * 2
  const railY = 1.15

  // Wainscot: a proud band of darker board up to the rail, on the three walls the
  // camera ever faces.
  props.push(box([w, railY - 0.16, 0.05], [0, (railY + 0.16) / 2, BACK + 0.05], 'dado'))
  props.push(box([0.05, railY - 0.16, d], [LEFT + 0.05, (railY + 0.16) / 2, 0], 'dado'))
  props.push(box([0.05, railY - 0.16, d], [RIGHT - 0.05, (railY + 0.16) / 2, 0], 'dado'))

  // Cap rail on top of it, and cornice where the wall meets the ceiling.
  props.push(box([w, 0.06, 0.1], [0, railY, BACK + 0.07], 'wood'))
  props.push(box([0.1, 0.06, d], [LEFT + 0.07, railY, 0], 'wood'))
  props.push(box([0.1, 0.06, d], [RIGHT - 0.07, railY, 0], 'wood'))

  const cornice = ROOM_HEIGHT - 0.09
  props.push(box([w, 0.12, 0.09], [0, cornice, BACK + 0.06], 'ceiling'))
  props.push(box([0.09, 0.12, d], [LEFT + 0.06, cornice, 0], 'ceiling'))
  props.push(box([0.09, 0.12, d], [RIGHT - 0.06, cornice, 0], 'ceiling'))
  props.push(box([w, 0.12, 0.09], [0, cornice, FRONT - 0.06], 'ceiling'))

  // Corner posts, hiding the four vertical seams where the wall boxes meet.
  for (const x of [LEFT + 0.06, RIGHT - 0.06]) {
    for (const z of [BACK + 0.06, FRONT - 0.06]) {
      props.push(box([0.14, ROOM_HEIGHT - 0.2, 0.14], [x, ROOM_HEIGHT / 2 - 0.1, z], 'wall', [0, Math.PI / 4, 0]))
    }
  }

  // Panel joints above the rail. Left and right walls only — the back wall is
  // taken up by the pegboard across most of its width.
  //
  // Modelled as proud pilasters in the wall's own colour rather than as dark
  // inset lines. A dark line is a stripe painted on a flat surface and reads as
  // exactly that; a strip standing 30 mm off the wall gets a lit face and a
  // shaded one, and relief is what the eye accepts as a joint.
  const seamTop = ROOM_HEIGHT - 0.16
  const seamH = seamTop - railY
  for (const z of [-8.2, -6.6, 0.9, 8.6]) {
    props.push(box([0.06, seamH, 0.16], [LEFT + 0.06, railY + seamH / 2, z], 'wall'))
  }
  for (const z of [-7.5, -3.5, 3.0, 7.0]) {
    props.push(box([0.06, seamH, 0.16], [RIGHT - 0.06, railY + seamH / 2, z], 'wall'))
  }

  return props
}

/**
 * Electrical and air services: surface conduit, junction boxes, sockets, a
 * distribution board and the air line feeding the compressor.
 *
 * A garage is a working building and its services are on the surface, not buried.
 * Conduit is also the only thing in the room that draws a continuous line across
 * two walls, which ties the separate prop clusters into one space instead of
 * three arrangements against a backdrop.
 */
function wallServices(): Prop[] {
  const props: Prop[] = []
  const runY = 3.35

  // Horizontal runs along the back and right walls, above everything mounted.
  props.push(cyl([0.035, 0.035, ROOM_HALF_X * 2 - 0.3, 8], [0, runY, BACK + 0.09], 'galv', [0, 0, Math.PI / 2]))
  props.push(cyl([0.035, 0.035, ROOM_HALF_Z * 2 - 0.3, 8], [RIGHT - 0.09, runY, 0], 'galv', [Math.PI / 2, 0, 0]))
  // Saddle clips holding the run off the wall.
  for (let i = 0; i < 9; i++) {
    props.push(box([0.05, 0.09, 0.09], [-7.6 + i * 1.9, runY, BACK + 0.06], 'galv'))
  }
  for (let i = 0; i < 9; i++) {
    props.push(box([0.09, 0.09, 0.05], [RIGHT - 0.06, runY, -8.4 + i * 2.1], 'galv'))
  }

  // Junction boxes.
  for (const x of [-5.5, 0.6, 5.2]) {
    props.push(box([0.17, 0.17, 0.09], [x, runY, BACK + 0.08], 'galv'))
  }

  // Distribution board on the right wall, with a drop from the run into its top.
  const panelZ = -3.6
  props.push(box([0.13, 0.66, 0.46], [RIGHT - 0.07, 1.95, panelZ], 'galv'))
  props.push(box([0.03, 0.58, 0.38], [RIGHT - 0.14, 1.95, panelZ], 'darkMetal'))
  props.push(box([0.05, 0.05, 0.12], [RIGHT - 0.15, 1.95, panelZ - 0.21], 'steel'))
  props.push(cyl([0.03, 0.03, 1.05, 8], [RIGHT - 0.09, 2.83, panelZ], 'galv', [0, 0, 0]))

  // Sockets, sat on the cap rail at 1.15 the way surface boxes usually are.
  const sockets: Array<[number, number, number]> = [
    [-3.2, BACK + 0.07, 0],
    [1.4, BACK + 0.07, 0],
    [RIGHT - 0.07, 2.2, Math.PI / 2],
    [RIGHT - 0.07, 5.0, Math.PI / 2],
  ]
  for (const [x, z, rotY] of sockets) {
    const position: Vec3 = [x, 1.28, z]
    props.push(box([0.16, 0.13, 0.06], position, 'ceiling', [0, rotY, 0]))
    // Stub of conduit dropping into the box from above.
    props.push(cyl([0.022, 0.022, 0.16, 6], [x, 1.42, z], 'galv'))
  }
  // Switch bank beside the door.
  props.push(box([0.2, 0.16, 0.05], [RIGHT - 0.07, 1.42, 7.6], 'ceiling', [0, Math.PI / 2, 0]))

  // Air line from the compressor up to the run, then along the wall.
  props.push(cyl([0.018, 0.018, 2.4, 6], [RIGHT - 0.14, 2.1, 4.3], 'rust'))
  props.push(cyl([0.018, 0.018, 5.2, 6], [RIGHT - 0.14, 3.28, 1.8], 'rust', [Math.PI / 2, 0, 0]))
  // Drop leg with a coupler, where a hose would be plugged in.
  props.push(cyl([0.016, 0.016, 1.7, 6], [RIGHT - 0.14, 2.45, -0.8], 'rust'))
  props.push(cyl([0.035, 0.035, 0.12, 8], [RIGHT - 0.14, 1.58, -0.8], 'steel'))

  return props
}

/**
 * Slab detail: expansion joints, a floor drain and safety hatching at the door.
 *
 * The joint grid is the highest-value item in this file per line of code. A
 * poured slab is cut into panels roughly three metres square, and those cuts give
 * the floor a perspective grid — the single strongest depth cue available in a
 * shot where the floor is half the frame. Offset from the origin so the car does
 * not sit astride a line.
 */
function slabDetail(): Prop[] {
  const props: Prop[] = []
  const y = 0.005
  const w = ROOM_HALF_X * 2
  const d = ROOM_HALF_Z * 2

  for (const z of [-6.4, -3.2, 3.2, 6.4]) {
    props.push(box([w, 0.012, 0.035], [0, y, z], 'seam'))
  }
  for (const x of [-5.4, -2.2, 2.2, 5.4]) {
    props.push(box([0.035, 0.012, d], [x, y, 0], 'seam'))
  }

  // Floor drain: a recessed square with slotted bars across it.
  const dx = 4.6
  const dz = -6.2
  props.push(box([0.5, 0.014, 0.5], [dx, y + 0.002, dz], 'seam'))
  props.push(box([0.56, 0.02, 0.06], [dx, y + 0.004, dz - 0.25], 'galv'))
  props.push(box([0.56, 0.02, 0.06], [dx, y + 0.004, dz + 0.25], 'galv'))
  for (let i = 0; i < 6; i++) {
    props.push(box([0.04, 0.016, 0.44], [dx - 0.2 + i * 0.08, y + 0.006, dz], 'galv'))
  }

  // Hatched threshold at the door, and a kerb the door seal closes onto.
  props.push(box([5.4, 0.05, 0.16], [0, 0.025, FRONT - 0.34], 'seam'))
  for (let i = 0; i < 11; i++) {
    props.push(box([0.16, 0.014, 0.42], [-2.4 + i * 0.48, y, FRONT - 0.75], 'yellow', [0, 0.62, 0]))
  }

  // Two bollards protecting the bench corner from a badly parked car.
  for (const z of [BACK + 1.9, BACK + 3.1]) {
    props.push(cyl([0.075, 0.085, 0.72, 12], [LEFT + 2.5, 0.36, z], 'yellow'))
    props.push(cyl([0.12, 0.12, 0.03, 12], [LEFT + 2.5, 0.015, z], 'darkMetal'))
  }

  return props
}

/**
 * Door hardware: jambs, torsion gear, tracks, and the opener hanging off the
 * ceiling.
 *
 * The sectional door already read as a door; what it lacked was the machinery
 * that makes one work. Tracks running back into the room also carry the eye from
 * the front wall to the ceiling, which is the join the original room never made.
 */
function doorHardware(): Prop[] {
  const props: Prop[] = []
  const z = DOOR_Z

  // Jambs either side of the opening.
  for (const x of [-2.72, 2.72]) {
    props.push(box([0.22, 3.7, 0.26], [x, 1.85, z - 0.02], 'wood'))
    props.push(box([0.06, 3.7, 0.06], [x + (x < 0 ? 0.13 : -0.13), 1.85, z - 0.16], 'darkMetal'))
  }

  // Torsion shaft above the opening, with cable drums and the spring.
  const shaftY = 3.78
  props.push(cyl([0.028, 0.028, 5.5, 8], [0, shaftY, z - 0.24], 'steel', [0, 0, Math.PI / 2]))
  for (const x of [-2.5, 2.5]) {
    props.push(cyl([0.1, 0.1, 0.16, 12], [x, shaftY, z - 0.24], 'darkMetal', [0, 0, Math.PI / 2]))
  }
  props.push(cyl([0.075, 0.075, 1.7, 12], [0, shaftY, z - 0.24], 'rust', [0, 0, Math.PI / 2]))
  props.push(box([0.12, 0.26, 0.22], [0.9, shaftY, z - 0.24], 'galv'))
  props.push(box([0.12, 0.26, 0.22], [-0.9, shaftY, z - 0.24], 'galv'))

  // Horizontal tracks running back into the bay, on drop hangers.
  for (const x of [-2.55, 2.55]) {
    props.push(box([0.09, 0.11, 4.2], [x, 3.62, z - 2.3], 'darkMetal'))
    for (const dz of [-1.1, -3.2]) {
      props.push(box([0.04, 0.5, 0.04], [x, 3.86, z + dz], 'galv'))
    }
  }

  // Opener: motor head, rail down the middle, and its own hangers.
  props.push(box([0.36, 0.28, 0.94], [0, 3.55, z - 3.7], 'galv'))
  props.push(box([0.3, 0.1, 0.24], [0, 3.36, z - 3.7], 'darkMetal'))
  props.push(box([0.09, 0.13, 3.2], [0, 3.66, z - 1.7], 'galv'))
  props.push(box([0.04, 0.46, 0.04], [-0.2, 3.9, z - 3.9], 'galv'))
  props.push(box([0.04, 0.46, 0.04], [0.2, 3.9, z - 3.9], 'galv'))

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
  ...doorHardware(),
  ...ceilingLights(),
  ...ceilingStructure(),
  ...wallTrim(),
  ...wallServices(),
  ...floorMarkings(),
  ...slabDetail(),
  ...leftWallDetail(),
  ...floorClutter(),
]
