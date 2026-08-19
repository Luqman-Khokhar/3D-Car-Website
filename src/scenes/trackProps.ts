import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three'
import {
  APRON_END_Z,
  APRON_START_Z,
  arcRate,
  BORDER_WIDTH,
  START_THETA,
  TRACK_HALF_WIDTH,
  trackPoint,
} from './track'
import {
  HOARDING_COLORS,
  KERB_RED,
  KERB_WHITE,
  PROP_CONE,
  PROP_LEAF,
  PROP_LEAF_ALT,
  PROP_LIGHT_ON,
  PROP_SEAT,
  PROP_SEAT_ALT,
  PROP_STEEL,
  PROP_TRUNK,
  PROP_TYRE,
  TRACK_BORDER,
  TRACK_LINE,
} from './palette'

/**
 * Everything standing up around the circuit: the start gantry, sponsor
 * hoardings, tyre barriers, a grandstand, trees and cones.
 *
 * All of it lands in ONE BufferGeometry with baked vertex colour — see `shade`.
 * The outside world is drawn unlit (RaceTrack.tsx explains why: it must not dim
 * with the garage, and the drive-out sun only ramps in past the door), and an
 * unlit box is a flat silhouette with no readable form. So the light is baked
 * per face at build time instead, off the same direction OutsideSun uses, which
 * costs nothing per frame and keeps the whole scene one draw call.
 *
 * Nothing here is animated and nothing here is picked, so there is no reason for
 * these to be separate objects.
 */

/** Matches OutsideSun's position in SceneCanvas.tsx — the props have to be lit
 *  from where the scene's own sun is, or their shading fights the car's. */
const SUN = new Vector3(16, 24, -9).normalize()
/** Wrap term, not a true ambient: 0 would put every face turned away from the
 *  sun at black, and with no bounce light out here that reads as a hole. */
const AMBIENT = 0.55
const DIFFUSE = 0.45

type Vec3 = [number, number, number]

interface PropMesh {
  positions: number[]
  colors: number[]
  indices: number[]
}

const scratch = new Color()
const edgeA = new Vector3()
const edgeB = new Vector3()
const normal = new Vector3()

function shade(nx: number, ny: number, nz: number): number {
  return AMBIENT + DIFFUSE * Math.max(0, nx * SUN.x + ny * SUN.y + nz * SUN.z)
}

/**
 * One convex polygon, fanned from its first vertex. Flat shaded: the face's own
 * normal is used for all of its vertices, which is what makes low-poly cylinders
 * read as faceted metal rather than as smooth putty.
 *
 * `flat` skips the shading entirely — for the start lights, which are meant to
 * be emitting rather than receiving.
 */
function face(m: PropMesh, points: Vec3[], color: string, flat = false) {
  edgeA.set(points[1][0] - points[0][0], points[1][1] - points[0][1], points[1][2] - points[0][2])
  edgeB.set(points[2][0] - points[0][0], points[2][1] - points[0][1], points[2][2] - points[0][2])
  // edgeB x edgeA, not the other way round: every polygon here is written in
  // the order that reads clockwise from outside (top face as seen from above,
  // and so on), which is the winding three treats as back-facing. Negating here
  // and reversing the index fan below turns the whole set front-facing, so the
  // props can be culled normally instead of drawn DoubleSide.
  normal.crossVectors(edgeB, edgeA)
  if (normal.lengthSq() === 0) return
  normal.normalize()

  scratch.set(color)
  // Multiplied in the renderer's working (linear) space, which is where the
  // vertex colour is applied — shading an sRGB value would wash out the mid
  // tones.
  if (!flat) scratch.multiplyScalar(shade(normal.x, normal.y, normal.z))

  const base = m.positions.length / 3
  for (const p of points) {
    m.positions.push(p[0], p[1], p[2])
    m.colors.push(scratch.r, scratch.g, scratch.b)
  }
  for (let i = 2; i < points.length; i++) m.indices.push(base, base + i, base + i - 1)
}

/**
 * Axis-aligned box, then yawed about its own centre. Corners are written out
 * rather than transformed by a Matrix4 because only one rotation axis is ever
 * needed out here and the sin/cos pair is cheaper than a matrix per prop.
 */
function box(
  m: PropMesh,
  center: Vec3,
  size: Vec3,
  rotY: number,
  color: string,
  flat = false,
) {
  const [cx, cy, cz] = center
  const [w, h, d] = size
  const sin = Math.sin(rotY)
  const cos = Math.cos(rotY)
  const corner = (sx: number, sy: number, sz: number): Vec3 => {
    const x = (sx * w) / 2
    const z = (sz * d) / 2
    return [cx + x * cos + z * sin, cy + (sy * h) / 2, cz - x * sin + z * cos]
  }

  const a = corner(-1, -1, -1)
  const b = corner(1, -1, -1)
  const c = corner(1, -1, 1)
  const d0 = corner(-1, -1, 1)
  const e = corner(-1, 1, -1)
  const f = corner(1, 1, -1)
  const g = corner(1, 1, 1)
  const h0 = corner(-1, 1, 1)

  face(m, [e, f, g, h0], color, flat) // top
  face(m, [d0, c, b, a], color, flat) // bottom
  face(m, [a, b, f, e], color, flat) // -z' side
  face(m, [c, d0, h0, g], color, flat) // +z' side
  face(m, [b, c, g, f], color, flat) // +x' side
  face(m, [d0, a, e, h0], color, flat) // -x' side
}

/** Cylinder or cone (topRadius 0), flat shaded, with caps. Used for tyres, tree
 *  trunks and cones — the only round things on the circuit. */
function drum(
  m: PropMesh,
  center: Vec3,
  bottomRadius: number,
  topRadius: number,
  height: number,
  segments: number,
  color: string,
) {
  const [cx, cy, cz] = center
  const y0 = cy
  const y1 = cy + height
  const ring = (radius: number, i: number): Vec3 => {
    const a = (i / segments) * Math.PI * 2
    return [cx + Math.cos(a) * radius, 0, cz + Math.sin(a) * radius]
  }

  const top: Vec3[] = []
  for (let i = 0; i < segments; i++) {
    const a0 = ring(bottomRadius, i)
    const a1 = ring(bottomRadius, i + 1)
    const b0 = ring(topRadius, i)
    const b1 = ring(topRadius, i + 1)
    if (topRadius === 0) {
      face(m, [[a0[0], y0, a0[2]], [a1[0], y0, a1[2]], [cx, y1, cz]], color)
    } else {
      face(m, [
        [a0[0], y0, a0[2]],
        [a1[0], y0, a1[2]],
        [b1[0], y1, b1[2]],
        [b0[0], y1, b0[2]],
      ], color)
    }
    top.push([b0[0], y1, b0[2]])
  }
  if (topRadius > 0) face(m, top, color)
}

export interface Obstacle {
  x: number
  z: number
  r: number
}

/** Filled as the props are built, so a prop and the thing the car bumps into are
 *  defined in one place and cannot drift apart. Circles only — DriveControls
 *  tests these per substep and a circle is two multiplies. */
const obstacles: Obstacle[] = []

const blocks = (x: number, z: number, r: number) => obstacles.push({ x, z, r })

/** Deterministic noise. Trees and tyre stacks want to look scattered, but the
 *  scatter has to be the same every load — the obstacle list is derived from it,
 *  and a track whose barriers move between reloads is not a track. */
function rng(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** World position at `offset` metres outward from the centreline, plus the yaw
 *  that puts a prop's local +z along the outward normal. */
function at(theta: number, offset: number) {
  const p = trackPoint(theta)
  return {
    x: p.x + p.nx * offset,
    z: p.z + p.nz * offset,
    rotY: Math.atan2(p.nx, p.nz),
  }
}

/** Edge of the tarmac, everything outside is measured from here. */
const KERB_EDGE = TRACK_HALF_WIDTH + BORDER_WIDTH
/** Run-off between the kerb and the barrier line. Wide enough that going off at
 *  a lobe is a mistake to recover from rather than an instant wall. */
const BARRIER_OFFSET = KERB_EDGE + 6.5
const TYRE_OFFSET = KERB_EDGE + 5.4

/** θ window in front of the garage, kept clear of furniture: the apron joins the
 *  circuit here and a barrier across it would fence the car out of its own
 *  track. Centred on the near pinch. */
const DOOR_THETA = -Math.PI / 2
const DOOR_CLEAR = 0.75

const angleGap = (a: number, b: number) => {
  const d = Math.abs(((a - b) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
  return Math.min(d, Math.PI * 2 - d)
}

const nearDoor = (theta: number, margin = DOOR_CLEAR) =>
  angleGap(theta, DOOR_THETA) < margin

/* ------------------------------------------------------------------ gantry */

const GANTRY_HEIGHT = 6.4
const GANTRY_LEG_OFFSET = KERB_EDGE + 1.1
/** Chequer squares strung across the beam, and the five start lights under it. */
const GANTRY_SQUARES = 18
const START_LIGHTS = 5

function gantry(m: PropMesh) {
  const p = trackPoint(START_THETA)
  const { rotY } = at(START_THETA, 0)
  const span = GANTRY_LEG_OFFSET * 2

  for (const side of [-1, 1]) {
    const x = p.x + p.nx * GANTRY_LEG_OFFSET * side
    const z = p.z + p.nz * GANTRY_LEG_OFFSET * side
    box(m, [x, GANTRY_HEIGHT / 2, z], [0.42, GANTRY_HEIGHT, 0.42], rotY, PROP_STEEL)
    box(m, [x, 0.35, z], [0.9, 0.7, 0.9], rotY, KERB_RED)
    blocks(x, z, 0.75)
  }

  // Beam, and the sponsor band on its face. Length goes in the local z (the
  // outward normal, which is the across-the-track axis), NOT local x — x runs
  // along the tangent, which would lay the beam down the road instead of over it.
  box(m, [p.x, GANTRY_HEIGHT + 0.55, p.z], [0.55, 1.1, span], rotY, PROP_STEEL)
  box(m, [p.x, GANTRY_HEIGHT + 0.55, p.z], [0.62, 0.62, span * 0.72], rotY, KERB_RED)

  // Chequer strip along the underside of the beam.
  const squareW = span / GANTRY_SQUARES
  for (let i = 0; i < GANTRY_SQUARES; i++) {
    const offset = -span / 2 + squareW * (i + 0.5)
    const q = at(START_THETA, offset)
    box(
      m,
      [q.x, GANTRY_HEIGHT - 0.18, q.z],
      [0.5, 0.36, squareW],
      rotY,
      i % 2 === 0 ? TRACK_LINE : TRACK_BORDER,
    )
  }

  // Start lights: a dark housing with an emitting face, hung under the middle of
  // the beam. Kept small and tucked up against it — at gantry scale a light big
  // enough to see from the far lobe is a red wall in front of the car as it
  // comes under the bridge.
  const lightSpacing = 0.72
  for (let i = 0; i < START_LIGHTS; i++) {
    const offset = (i - (START_LIGHTS - 1) / 2) * lightSpacing
    const q = at(START_THETA, offset)
    box(m, [q.x, GANTRY_HEIGHT - 0.4, q.z], [0.34, 0.5, 0.5], rotY, TRACK_BORDER)
    box(m, [q.x, GANTRY_HEIGHT - 0.4, q.z], [0.44, 0.34, 0.34], rotY, PROP_LIGHT_ON, true)
  }
}

/* ------------------------------------------------------------------ tyres */

const TYRE_RADIUS = 0.62
const TYRE_HEIGHT = 0.34

function tyreStack(m: PropMesh, x: number, z: number, count: number, capColor: string) {
  for (let i = 0; i < count; i++) {
    const last = i === count - 1
    drum(m, [x, i * TYRE_HEIGHT, z], TYRE_RADIUS, TYRE_RADIUS, TYRE_HEIGHT, 10,
      last ? capColor : PROP_TYRE)
  }
  blocks(x, z, TYRE_RADIUS + 0.15)
}

/** Barriers at the two lobes, where the car is quickest and most likely to run
 *  wide, and on the inside of the far pinch. */
function tyreBarriers(m: PropMesh) {
  const random = rng(0x7ac)
  const caps = [KERB_RED, KERB_WHITE, PROP_SEAT]
  const runs: { theta: number; span: number; offset: number; count: number }[] = [
    { theta: 0, span: 0.42, offset: TYRE_OFFSET, count: 7 },
    { theta: Math.PI, span: 0.42, offset: TYRE_OFFSET, count: 7 },
    { theta: Math.PI / 2, span: 0.3, offset: -(KERB_EDGE + 3.2), count: 5 },
  ]

  for (const run of runs) {
    for (let i = 0; i < run.count; i++) {
      const t = run.theta + (i / (run.count - 1) - 0.5) * run.span
      const q = at(t, run.offset)
      tyreStack(m, q.x, q.z, 3 + Math.floor(random() * 2), caps[i % caps.length])
    }
  }
}

/* -------------------------------------------------------------- hoardings */

const HOARDING_WIDTH = 5.4
const HOARDING_HEIGHT = 1.05
/** Gap between boards. Stepped by arc length rather than by a fixed angle: the
 *  peanut's radius more than doubles between pinch and lobe, so a constant Δθ
 *  put the boards shoulder to shoulder at the pinches and 12 m apart down the
 *  lobes. */
const HOARDING_GAP = 0.5

/** Sponsor boards ringing the outside of the circuit. They double as the visual
 *  fence: past them is verge, and there is nothing out there to drive to. */
function hoardings(m: PropMesh) {
  let index = 0
  let theta = 0
  while (theta < Math.PI * 2 - 1e-6) {
    // Stepped off the barrier line's own arc rate, not the centreline's: the
    // boards sit BARRIER_OFFSET metres further out, where a radian is longer.
    const step = (HOARDING_WIDTH + HOARDING_GAP) / (arcRate(theta) + BARRIER_OFFSET)
    theta += step
    if (nearDoor(theta, DOOR_CLEAR + 0.25)) continue
    const q = at(theta, BARRIER_OFFSET)
    const color = HOARDING_COLORS[index % HOARDING_COLORS.length]
    index++
    box(m, [q.x, HOARDING_HEIGHT / 2, q.z], [HOARDING_WIDTH, HOARDING_HEIGHT, 0.16], q.rotY, color)
    // White cap rail, so the boards still read as a line when the colours behind
    // them go dark at the far end of the fog.
    box(m, [q.x, HOARDING_HEIGHT + 0.06, q.z], [HOARDING_WIDTH, 0.12, 0.26], q.rotY, KERB_WHITE)
    // Three circles rather than one: a 5.4 m board approximated by a single
    // circle either leaves the ends open or bulges a long way into the run-off.
    const tx = Math.cos(q.rotY)
    const tz = -Math.sin(q.rotY)
    for (const s of [-1, 0, 1]) blocks(q.x + tx * s * 1.8, q.z + tz * s * 1.8, 1.0)
  }
}

/* ------------------------------------------------------------ grandstand */

const STAND_THETA = Math.PI / 2
const STAND_OFFSET = BARRIER_OFFSET + 4.5
const STAND_WIDTH = 30
const STAND_TIERS = 7
const STAND_RISE = 0.78
const STAND_TREAD = 1.5

/** Faces the far pinch, which is the part of the circuit the chase camera looks
 *  straight down as the car comes out of the near straight. */
function grandstand(m: PropMesh) {
  const q = at(STAND_THETA, STAND_OFFSET)
  const nx = Math.sin(q.rotY)
  const nz = Math.cos(q.rotY)

  for (let tier = 0; tier < STAND_TIERS; tier++) {
    const depth = tier * STAND_TREAD
    const x = q.x + nx * depth
    const z = q.z + nz * depth
    const h = STAND_RISE * (tier + 1)
    // Riser block, then the seat bench sitting on it.
    box(m, [x, h / 2, z], [STAND_WIDTH, h, STAND_TREAD], q.rotY, PROP_STEEL)
    box(m, [x, h + 0.22, z], [STAND_WIDTH, 0.44, STAND_TREAD * 0.62], q.rotY,
      tier % 2 === 0 ? PROP_SEAT : PROP_SEAT_ALT)
  }

  // Roof on two posts, overhanging the top tier.
  const roofDepth = STAND_TREAD * STAND_TIERS
  const roofY = STAND_RISE * STAND_TIERS + 3.6
  const rx = q.x + nx * (roofDepth / 2 - STAND_TREAD / 2)
  const rz = q.z + nz * (roofDepth / 2 - STAND_TREAD / 2)
  box(m, [rx, roofY, rz], [STAND_WIDTH + 1.2, 0.4, roofDepth], q.rotY, PROP_STEEL)
  box(m, [rx, roofY - 0.35, rz], [STAND_WIDTH + 1.2, 0.3, 0.4], q.rotY, KERB_RED)
  for (const side of [-1, 1]) {
    const px = rx + Math.cos(q.rotY) * side * (STAND_WIDTH / 2)
    const pz = rz - Math.sin(q.rotY) * side * (STAND_WIDTH / 2)
    box(m, [px, roofY / 2, pz], [0.4, roofY, 0.4], q.rotY, PROP_STEEL)
  }

  // Blocked along its front face only — the car cannot get behind it anyway.
  for (let i = -3; i <= 3; i++) {
    const bx = q.x + Math.cos(q.rotY) * i * 4.4
    const bz = q.z - Math.sin(q.rotY) * i * 4.4
    blocks(bx, bz, 2.4)
  }
}

/* ----------------------------------------------------------------- trees */

const TREE_COUNT = 26
const TREE_MIN_OFFSET = BARRIER_OFFSET + 3.5
const TREE_SPREAD = 9

/** Scattered on the verge behind the hoardings. Purely for the horizon: with
 *  nothing standing up out there the circuit's far side is a flat green band
 *  against flat haze and the world has no depth at all. */
function trees(m: PropMesh) {
  const random = rng(0x51e2)
  for (let i = 0; i < TREE_COUNT; i++) {
    const theta = random() * Math.PI * 2
    if (nearDoor(theta, DOOR_CLEAR + 0.5)) continue
    if (angleGap(theta, STAND_THETA) < 0.45) continue
    const q = at(theta, TREE_MIN_OFFSET + random() * TREE_SPREAD)
    const scale = 0.8 + random() * 0.7
    const trunk = 1.5 * scale
    drum(m, [q.x, 0, q.z], 0.26 * scale, 0.2 * scale, trunk, 6, PROP_TRUNK)
    drum(m, [q.x, trunk * 0.8, q.z], 1.7 * scale, 0, 3.4 * scale, 7, PROP_LEAF)
    drum(m, [q.x, trunk * 2.0, q.z], 1.2 * scale, 0, 2.6 * scale, 7, PROP_LEAF_ALT)
    blocks(q.x, q.z, 0.9)
  }
}

/* ----------------------------------------------------------------- cones */

const CONE_HEIGHT = 0.62
const CONE_RADIUS = 0.28

/** Down both sides of the apron, funnelling out of the door. Deliberately NOT
 *  obstacles: a cone is the one thing on a circuit that is meant to be knocked
 *  over, and fencing the car off its own exit with them would be perverse. */
function cones(m: PropMesh) {
  const rows = 6
  for (let i = 0; i < rows; i++) {
    const t = (i + 0.5) / rows
    const z = APRON_START_Z + (APRON_END_Z - APRON_START_Z) * t
    const half = 3.0 + t * 2.4
    for (const side of [-1, 1]) {
      const x = side * half
      drum(m, [x, 0, z], CONE_RADIUS, 0.05, CONE_HEIGHT, 8, PROP_CONE)
      // White band, the way a real cone is banded — at this size it is the only
      // thing that stops them reading as orange pebbles.
      drum(m, [x, CONE_HEIGHT * 0.42, z], CONE_RADIUS * 0.62, CONE_RADIUS * 0.5, 0.1, 8, KERB_WHITE)
      box(m, [x, 0.03, z], [CONE_RADIUS * 2.4, 0.06, CONE_RADIUS * 2.4], 0, PROP_CONE)
    }
  }
}

/**
 * Circles the car is kept out of. Read by DriveControls.
 *
 * Filled as a by-product of building the props, which in practice has already
 * happened by the time anything asks — TrackProps mounts with the scene, the
 * drive controls only in free look. The fallback build is for the order not
 * holding: the layout is deterministic (see rng), so building it a second time
 * just to throw the geometry away yields exactly the same circles.
 */
export function trackObstacles(): readonly Obstacle[] {
  if (obstacles.length === 0) buildTrackProps().dispose()
  return obstacles
}

export function buildTrackProps(): BufferGeometry {
  obstacles.length = 0
  const m: PropMesh = { positions: [], colors: [], indices: [] }

  gantry(m)
  tyreBarriers(m)
  hoardings(m)
  grandstand(m)
  trees(m)
  cones(m)

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(m.positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(m.colors, 3))
  geometry.setIndex(m.indices)
  geometry.computeBoundingSphere()
  return geometry
}
