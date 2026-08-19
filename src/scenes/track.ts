import { BufferGeometry, Float32BufferAttribute } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { DOOR_OPENING_HALF_WIDTH, DOOR_Z, ROOM_HALF_Z } from './garage'

/**
 * The closed circuit outside the sectional door.
 *
 * Shape is a peanut — two wide lobes left and right, pinched top and bottom —
 * because a plain oval gives the driver two corners and nothing else to read.
 * It comes out of a polar radius that breathes with 2θ:
 *
 *   r(θ) = LOOP_RADIUS * (1 + LOOP_PINCH * cos 2θ)
 *
 * cos2θ is +1 along ±x (the lobes) and -1 along ±z (the pinches), so one
 * constant controls how much the circle zig-zags. LOOP_PINCH is bounded by the
 * ribbon width, not by taste: at the pinch the centreline's radius of curvature
 * is ~9 m, so a half width past that folds the inner edge through itself. 0.38
 * leaves the fold ~4 m away.
 *
 * θ = -π/2 is the near pinch, the point closest to the garage — that is where
 * the apron joins, so the driver noses out of the door onto a straightish run
 * rather than into a corner.
 */
const LOOP_RADIUS = 22
const LOOP_PINCH = 0.38

/** Half the driving surface's width — 10 m, two lanes plus room to overtake. */
export const TRACK_HALF_WIDTH = 5
/** Kerb strip either side of the surface. The whole track is white, so this dark
 *  band is the only thing that says where the road ends. */
export const BORDER_WIDTH = 0.5

/** Samples around the loop. High because the pinch is the tightest curvature in
 *  the scene and faceting there is visible from the chase camera. */
const SEGMENTS = 280

/** Clear tarmac between the door and the circuit, so the car has room to line
 *  itself up on the way out and to aim at the opening on the way back. */
const APRON_DEPTH = 6

const loopRadius = (theta: number) => LOOP_RADIUS * (1 + LOOP_PINCH * Math.cos(2 * theta))

/** dr/dθ, needed for the tangent — the ribbon's lateral direction is derived
 *  analytically rather than from neighbouring samples so the two edges stay
 *  exactly parallel at the pinch. */
const loopRadiusDeriv = (theta: number) => -2 * LOOP_RADIUS * LOOP_PINCH * Math.sin(2 * theta)

/** Centre of the loop, placed so its near edge sits APRON_DEPTH past the door. */
export const TRACK_CENTER_Z =
  DOOR_Z + APRON_DEPTH + loopRadius(-Math.PI / 2) + TRACK_HALF_WIDTH

/** Starts on the front wall's centre line, which is where the garage slab ends
 *  (see GroundPlane.tsx) — the tarmac takes over from the concrete exactly at the
 *  threshold, with no strip of bare ground between them. */
export const APRON_START_Z = ROOM_HALF_Z
export const APRON_END_Z = TRACK_CENTER_Z - loopRadius(-Math.PI / 2) - TRACK_HALF_WIDTH + 0.3
const APRON_SEGMENTS = 12

export interface TrackPoint {
  x: number
  z: number
  /** Unit lateral, pointing away from the loop's centre. */
  nx: number
  nz: number
}

export function trackPoint(theta: number): TrackPoint {
  const r = loopRadius(theta)
  const dr = loopRadiusDeriv(theta)
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  const dx = dr * cos - r * sin
  const dz = dr * sin + r * cos
  const len = Math.hypot(dx, dz)
  // (tz, -tx) is the outward side: at θ=0 the tangent is +z, which puts this at +x.
  return { x: r * cos, z: TRACK_CENTER_Z + r * sin, nx: dz / len, nz: -dx / len }
}

/** Outer footprint of track + kerb, sampled rather than solved — the extrema of
 *  the offset peanut have no tidy closed form and this runs once at module load.
 *  DriveControls fences the drive area off these. */
function footprint() {
  let maxX = 0
  let minZ = Infinity
  let maxZ = -Infinity
  const reach = TRACK_HALF_WIDTH + BORDER_WIDTH
  for (let i = 0; i < SEGMENTS; i++) {
    const p = trackPoint((i / SEGMENTS) * Math.PI * 2)
    maxX = Math.max(maxX, Math.abs(p.x) + reach)
    minZ = Math.min(minZ, p.z - reach)
    maxZ = Math.max(maxZ, p.z + reach)
  }
  return { maxX, minZ, maxZ }
}

const FOOTPRINT = footprint()

/** Run-off around the circuit the car may still drive on. Generous: leaving the
 *  track is not a failure state here, it just has to end somewhere before the
 *  ground plane's fogged-out edge. */
const RUN_OFF = 10

export const TRACK_MAX_X = FOOTPRINT.maxX
export const DRIVE_HALF_X = FOOTPRINT.maxX + RUN_OFF
export const DRIVE_MAX_Z = FOOTPRINT.maxZ + RUN_OFF

/** Stacking order off the ground plane. Small gaps rather than polygonOffset:
 *  these are flat unlit quads read from a shallow angle, and a depth bias big
 *  enough to hold at the far end of the straight is big enough to lift the kerb
 *  visibly off the tarmac up close. */
export const TRACK_Y = {
  grass: 0.012,
  surface: 0.03,
  border: 0.045,
  dash: 0.055,
  band: 0.058,
  grid: 0.06,
} as const

/** Scratch buffers for geometry assembled quad by quad rather than as one sweep
 *  — striped kerbs, mown grass — where a single positions array cannot be
 *  written in order because consecutive quads land in different geometries. */
interface Mesh2D {
  positions: number[]
  indices: number[]
}

const emptyMesh = (): Mesh2D => ({ positions: [], indices: [] })

/** Four corners in ribbon order: near-inner, near-outer, far-inner, far-outer.
 *  Same winding as the swept bands, so DoubleSide is not load-bearing here. */
function pushQuad(m: Mesh2D, a0: number[], a1: number[], b0: number[], b1: number[]) {
  const base = m.positions.length / 3
  m.positions.push(...a0, ...a1, ...b0, ...b1)
  m.indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3)
}

function ribbonGeometry(positions: number[], indices: number[]): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}

/**
 * A band running the whole way round the loop, `width` wide and centred
 * `offset` metres to the outward side of the centreline. Used for the driving
 * surface (offset 0) and for each kerb.
 */
function loopBand(offset: number, width: number, y: number): BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  const inner = offset - width / 2
  const outer = offset + width / 2

  for (let i = 0; i <= SEGMENTS; i++) {
    const p = trackPoint((i / SEGMENTS) * Math.PI * 2)
    positions.push(p.x + p.nx * inner, y, p.z + p.nz * inner)
    positions.push(p.x + p.nx * outer, y, p.z + p.nz * outer)
  }
  for (let i = 0; i < SEGMENTS; i++) {
    const a = i * 2
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
  }
  return ribbonGeometry(positions, indices)
}

/** Samples per kerb stripe. ~0.7 m of centreline per sample, so this is a 1.4 m
 *  stripe — the length a real rumble strip runs before it changes colour. */
const KERB_STRIPE = 2

/** Same band as loopBand, split into two geometries by alternating runs of
 *  `stripe` samples, so one call gives both halves of a red/white kerb without
 *  generating the ribbon twice. */
function loopBandStriped(
  offset: number,
  width: number,
  y: number,
  stripe: number,
): [BufferGeometry, BufferGeometry] {
  const buckets: Mesh2D[] = [emptyMesh(), emptyMesh()]
  const inner = offset - width / 2
  const outer = offset + width / 2

  for (let i = 0; i < SEGMENTS; i++) {
    const a = trackPoint((i / SEGMENTS) * Math.PI * 2)
    const b = trackPoint(((i + 1) / SEGMENTS) * Math.PI * 2)
    pushQuad(
      buckets[Math.floor(i / stripe) % 2],
      [a.x + a.nx * inner, y, a.z + a.nz * inner],
      [a.x + a.nx * outer, y, a.z + a.nz * outer],
      [b.x + b.nx * inner, y, b.z + b.nz * inner],
      [b.x + b.nx * outer, y, b.z + b.nz * outer],
    )
  }
  return [ribbonGeometry(buckets[0].positions, buckets[0].indices),
          ribbonGeometry(buckets[1].positions, buckets[1].indices)]
}

/** Inset of the solid white edge line from the edge of the driving surface, and
 *  how wide that line is. Painted inside the kerb, as on a real circuit — the
 *  kerb says where the road ends, the line says where you should still be. */
const EDGE_INSET = 0.45
const EDGE_WIDTH = 0.16

/** Segments per dash and per gap. Counted in samples rather than metres, so the
 *  dashes stretch slightly through the lobes where a sample covers more ground
 *  — cheaper than an arc-length reparametrisation, and not readable at speed. */
const DASH_ON = 7
const DASH_OFF = 9
const DASH_WIDTH = 0.35

/** Both solid edge lines, as one geometry — they are always the same colour and
 *  always drawn together. */
function edgeLines(y: number): BufferGeometry {
  const m = emptyMesh()
  for (const side of [-1, 1]) {
    const inner = side * (TRACK_HALF_WIDTH - EDGE_INSET) - EDGE_WIDTH / 2
    const outer = inner + EDGE_WIDTH
    for (let i = 0; i < SEGMENTS; i++) {
      const a = trackPoint((i / SEGMENTS) * Math.PI * 2)
      const b = trackPoint(((i + 1) / SEGMENTS) * Math.PI * 2)
      pushQuad(
        m,
        [a.x + a.nx * inner, y, a.z + a.nz * inner],
        [a.x + a.nx * outer, y, a.z + a.nz * outer],
        [b.x + b.nx * inner, y, b.z + b.nz * inner],
        [b.x + b.nx * outer, y, b.z + b.nz * outer],
      )
    }
  }
  return ribbonGeometry(m.positions, m.indices)
}

/** How far the verge runs out from the kerb. Has to cover RUN_OFF, or the car
 *  leaves the grass and stands on bare ground while still inside the fence. */
const VERGE_WIDTH = 26
/** Samples per mown stripe. Longer than the kerb's, or the two patterns beat
 *  against each other along the edge of the road. */
const GRASS_STRIPE = 7
/** The verge never comes closer to the garage than the track's own near edge:
 *  the apron and the paddock in front of the building are made ground, not
 *  field, and grass swept over them would run into the slab. Applied as a
 *  per-vertex clamp on how far out the band reaches rather than as a cut-out,
 *  so the verge simply narrows as it comes round the near pinch. */
const GRASS_MIN_Z = APRON_END_Z

/** Outward reach of the verge at one point of the loop, clamped so the far edge
 *  never crosses GRASS_MIN_Z. nz < 0 is the only case that can: the outward side
 *  pointing back toward the garage. */
function vergeReach(p: TrackPoint): number {
  if (p.nz >= 0) return VERGE_WIDTH
  return Math.max(0, Math.min(VERGE_WIDTH, (GRASS_MIN_Z - p.z) / p.nz))
}

/**
 * Infield and verge in one pass, split into two geometries by alternating runs
 * of samples — the mown stripes. The infield is a fan from the loop's centre,
 * which is only valid because r(θ) is single-valued: the peanut is star-shaped
 * about its centre, pinch and all.
 */
function grass(y: number): [BufferGeometry, BufferGeometry] {
  const buckets: Mesh2D[] = [emptyMesh(), emptyMesh()]
  const edge = -(TRACK_HALF_WIDTH + BORDER_WIDTH)
  const outer = TRACK_HALF_WIDTH + BORDER_WIDTH

  for (let i = 0; i < SEGMENTS; i++) {
    const a = trackPoint((i / SEGMENTS) * Math.PI * 2)
    const b = trackPoint(((i + 1) / SEGMENTS) * Math.PI * 2)
    const m = buckets[Math.floor(i / GRASS_STRIPE) % 2]
    // Infield: the centre point is repeated as a degenerate edge so the same
    // quad writer covers the fan. Always the darker tone — striping it too gave
    // a sunburst radiating from the loop's centre, since the fan's wedges all
    // meet there. Mown stripes only make sense where the bands stay parallel,
    // which on this shape is the verge.
    pushQuad(
      buckets[0],
      [0, y, TRACK_CENTER_Z],
      [a.x + a.nx * edge, y, a.z + a.nz * edge],
      [0, y, TRACK_CENTER_Z],
      [b.x + b.nx * edge, y, b.z + b.nz * edge],
    )
    const ra = vergeReach(a)
    const rb = vergeReach(b)
    if (ra <= 0 && rb <= 0) continue
    pushQuad(
      m,
      [a.x + a.nx * outer, y, a.z + a.nz * outer],
      [a.x + a.nx * (outer + ra), y, a.z + a.nz * (outer + ra)],
      [b.x + b.nx * outer, y, b.z + b.nz * outer],
      [b.x + b.nx * (outer + rb), y, b.z + b.nz * (outer + rb)],
    )
  }
  return [ribbonGeometry(buckets[0].positions, buckets[0].indices),
          ribbonGeometry(buckets[1].positions, buckets[1].indices)]
}

/** Broken lane line down the middle of the surface. */
function centreDashes(y: number): BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  const period = DASH_ON + DASH_OFF

  for (let i = 0; i < SEGMENTS; i++) {
    if (i % period >= DASH_ON) continue
    const base = positions.length / 3
    for (const step of [i, i + 1]) {
      const p = trackPoint((step / SEGMENTS) * Math.PI * 2)
      positions.push(p.x - p.nx * (DASH_WIDTH / 2), y, p.z - p.nz * (DASH_WIDTH / 2))
      positions.push(p.x + p.nx * (DASH_WIDTH / 2), y, p.z + p.nz * (DASH_WIDTH / 2))
    }
    indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3)
  }
  return ribbonGeometry(positions, indices)
}

/** Where the start line sits, a little round from the apron junction so it is
 *  ahead of the car as it joins rather than under it. */
export const START_THETA = -Math.PI / 2 + 0.5
const START_COLUMNS = 10
const START_ROWS = 2
const START_DEPTH = 1.6

/** |dp/dθ| — metres of centreline per radian, so a length in metres can be turned
 *  into a θ span. Not the same as r() once the pinch starts moving the radius. */
export function arcRate(theta: number): number {
  const r = loopRadius(theta)
  const dr = loopRadiusDeriv(theta)
  return Math.hypot(dr * Math.cos(theta) - r * Math.sin(theta), dr * Math.sin(theta) + r * Math.cos(theta))
}

/** Full-width dark band under the chequer. The surface is asphalt now, not
 *  white, so both halves of the pattern have to be painted: this is the dark
 *  half, with startGrid's white squares laid over it. */
function startBand(y: number): BufferGeometry {
  const m = emptyMesh()
  const span = (START_DEPTH / 2) / arcRate(START_THETA)
  const a = trackPoint(START_THETA - span)
  const b = trackPoint(START_THETA + span)
  pushQuad(
    m,
    [a.x - a.nx * TRACK_HALF_WIDTH, y, a.z - a.nz * TRACK_HALF_WIDTH],
    [a.x + a.nx * TRACK_HALF_WIDTH, y, a.z + a.nz * TRACK_HALF_WIDTH],
    [b.x - b.nx * TRACK_HALF_WIDTH, y, b.z - b.nz * TRACK_HALF_WIDTH],
    [b.x + b.nx * TRACK_HALF_WIDTH, y, b.z + b.nz * TRACK_HALF_WIDTH],
  )
  return ribbonGeometry(m.positions, m.indices)
}

/**
 * Start/finish chequer: the light squares, laid over startBand.
 */
function startGrid(y: number): BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  const span = (START_DEPTH / 2) / arcRate(START_THETA)

  for (let row = 0; row < START_ROWS; row++) {
    const t0 = START_THETA - span + (row * 2 * span) / START_ROWS
    const t1 = START_THETA - span + ((row + 1) * 2 * span) / START_ROWS
    const a = trackPoint(t0)
    const b = trackPoint(t1)
    for (let col = 0; col < START_COLUMNS; col++) {
      if ((col + row) % 2 === 1) continue
      const o0 = -TRACK_HALF_WIDTH + (col * 2 * TRACK_HALF_WIDTH) / START_COLUMNS
      const o1 = -TRACK_HALF_WIDTH + ((col + 1) * 2 * TRACK_HALF_WIDTH) / START_COLUMNS
      const base = positions.length / 3
      positions.push(a.x + a.nx * o0, y, a.z + a.nz * o0)
      positions.push(a.x + a.nx * o1, y, a.z + a.nz * o1)
      positions.push(b.x + b.nx * o0, y, b.z + b.nz * o0)
      positions.push(b.x + b.nx * o1, y, b.z + b.nz * o1)
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3)
    }
  }
  return ribbonGeometry(positions, indices)
}

/** Funnel from the door opening out to track width, eased rather than linear so
 *  the join reads as a slip road instead of a wedge. */
function apronHalfWidth(t: number): number {
  const e = t * t * (3 - 2 * t)
  return DOOR_OPENING_HALF_WIDTH + (TRACK_HALF_WIDTH - DOOR_OPENING_HALF_WIDTH) * e
}

const apronZ = (t: number) => APRON_START_Z + (APRON_END_Z - APRON_START_Z) * t

function apronSurface(y: number): BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= APRON_SEGMENTS; i++) {
    const t = i / APRON_SEGMENTS
    const half = apronHalfWidth(t)
    const z = apronZ(t)
    positions.push(-half, y, z, half, y, z)
  }
  for (let i = 0; i < APRON_SEGMENTS; i++) {
    const a = i * 2
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
  }
  return ribbonGeometry(positions, indices)
}

/** Both kerbs of the apron, striped like the circuit's. Stops short of the loop
 *  so it does not lay a bar across the racing line where the two meet. */
function apronBorders(y: number): [BufferGeometry, BufferGeometry] {
  const buckets: Mesh2D[] = [emptyMesh(), emptyMesh()]
  const last = APRON_SEGMENTS - 1

  for (const side of [-1, 1]) {
    for (let i = 0; i < last; i++) {
      const m = buckets[i % 2]
      const t0 = i / APRON_SEGMENTS
      const t1 = (i + 1) / APRON_SEGMENTS
      const h0 = apronHalfWidth(t0)
      const h1 = apronHalfWidth(t1)
      pushQuad(
        m,
        [side * h0, y, apronZ(t0)],
        [side * (h0 + BORDER_WIDTH), y, apronZ(t0)],
        [side * h1, y, apronZ(t1)],
        [side * (h1 + BORDER_WIDTH), y, apronZ(t1)],
      )
    }
  }
  return [ribbonGeometry(buckets[0].positions, buckets[0].indices),
          ribbonGeometry(buckets[1].positions, buckets[1].indices)]
}

export interface TrackGeometry {
  surface: BufferGeometry
  apron: BufferGeometry
  /** Red and white halves of every kerb — the loop's two sides and the apron's,
   *  merged by colour rather than by location so each is one draw call. */
  kerbRed: BufferGeometry
  kerbWhite: BufferGeometry
  grassDark: BufferGeometry
  grassLight: BufferGeometry
  edgeLines: BufferGeometry
  dashes: BufferGeometry
  startBand: BufferGeometry
  startGrid: BufferGeometry
}

export function buildTrackGeometry(): TrackGeometry {
  const kerb = TRACK_HALF_WIDTH + BORDER_WIDTH / 2
  const [innerA, innerB] = loopBandStriped(-kerb, BORDER_WIDTH, TRACK_Y.border, KERB_STRIPE)
  const [outerA, outerB] = loopBandStriped(kerb, BORDER_WIDTH, TRACK_Y.border, KERB_STRIPE)
  const [apronA, apronB] = apronBorders(TRACK_Y.border)
  const [grassA, grassB] = grass(TRACK_Y.grass)

  const kerbRed = mergeGeometries([innerA, outerB, apronA], false)
  const kerbWhite = mergeGeometries([innerB, outerA, apronB], false)
  // The six inputs are copied into the two merges, so nothing else references
  // them from here on.
  for (const part of [innerA, innerB, outerA, outerB, apronA, apronB]) part.dispose()
  kerbRed.computeBoundingSphere()
  kerbWhite.computeBoundingSphere()

  return {
    surface: loopBand(0, TRACK_HALF_WIDTH * 2, TRACK_Y.surface),
    apron: apronSurface(TRACK_Y.surface),
    // The inner kerb's stripes are offset by one run from the outer's, so the
    // two sides of the road are never in phase — in phase they read as one
    // ladder laid across the track.
    kerbRed,
    kerbWhite,
    grassDark: grassA,
    grassLight: grassB,
    edgeLines: edgeLines(TRACK_Y.dash),
    dashes: centreDashes(TRACK_Y.dash),
    startBand: startBand(TRACK_Y.band),
    startGrid: startGrid(TRACK_Y.grid),
  }
}
