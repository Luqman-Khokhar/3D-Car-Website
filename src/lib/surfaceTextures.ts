import {
  Color,
  DataTexture,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
  UnsignedByteType,
  LinearFilter,
  LinearMipmapLinearFilter,
} from 'three'

/**
 * Deterministic value noise. `Math.random` is avoided so the texture is identical
 * across reloads — a paint finish that changes between sessions is a bug you can
 * only see once you have already shipped it.
 */
function hash(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}

function smooth(t: number) {
  return t * t * (3 - 2 * t)
}

function valueNoise(x: number, y: number, period: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = smooth(x - xi)
  const yf = smooth(y - yi)
  // Wrap the lattice on `period` so the texture tiles seamlessly; a visible seam
  // running down a body panel is worse than no normal map at all.
  const wrap = (v: number) => ((v % period) + period) % period

  const a = hash(wrap(xi), wrap(yi))
  const b = hash(wrap(xi + 1), wrap(yi))
  const c = hash(wrap(xi), wrap(yi + 1))
  const d = hash(wrap(xi + 1), wrap(yi + 1))

  return (a * (1 - xf) + b * xf) * (1 - yf) + (c * (1 - xf) + d * xf) * yf
}

/**
 * Tangent-space normal map for automotive "orange peel" — the shallow, irregular
 * ripple every sprayed clearcoat has.
 *
 * This is the single cheapest thing that separates painted metal from coloured
 * plastic. A perfectly flat clearcoat slides its highlight across a panel as one
 * unbroken shape; a real one makes that highlight wobble. The amplitude is
 * deliberately tiny (`STRENGTH` below) — visible in the specular lobe, invisible
 * in the silhouette.
 *
 * Fed to `clearcoatNormalMap` rather than `normalMap`, so it perturbs only the
 * clear layer. The base coat's metallic flake stays smooth underneath, which is
 * physically what is happening.
 */
export function createOrangePeelNormalMap(size = 256) {
  // Two octaves: a broad swell plus a finer stipple. One octave alone reads as
  // either dents (low) or noise (high).
  const OCTAVES: Array<[period: number, weight: number]> = [
    [8, 0.65],
    [24, 0.35],
  ]
  const STRENGTH = 1.35

  const height = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let h = 0
      for (const [period, weight] of OCTAVES) {
        h += valueNoise((x / size) * period, (y / size) * period, period) * weight
      }
      height[y * size + x] = h
    }
  }

  const data = new Uint8Array(size * size * 4)
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Central differences give the surface gradient; the normal is its negative
      // in tangent space, with Z holding the flat component.
      const dx = (at(x + 1, y) - at(x - 1, y)) * STRENGTH
      const dy = (at(x, y + 1) - at(x, y - 1)) * STRENGTH
      const len = Math.hypot(dx, dy, 1)
      const i = (y * size + x) * 4
      data[i] = ((-dx / len) * 0.5 + 0.5) * 255
      data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255
      data[i + 2] = (1 / len) * 0.5 * 255 + 127.5
      data[i + 3] = 255
    }
  }

  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  // Panels are metres across and the merged geometry carries box UVs, so a high
  // repeat is what puts the ripple at a plausible ~3 cm pitch.
  texture.repeat.set(9, 9)
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

/* ------------------------------------------------------------------------- *
 * Room surfaces.
 *
 * The garage shell used to be flat colour: one value for every wall fragment and
 * one for the floor. Flat colour is what makes a room read as a box with paint on
 * it — real concrete has aggregate, patchy sealer, and dirt that collects where
 * people walk. None of that needs to be resolvable; it only needs to break the
 * uniformity so the eye stops reading a plane as a plane.
 *
 * Everything here is generated once, procedurally, from the same deterministic
 * noise as the orange peel above. No texture files, no fetch on the critical path.
 * ------------------------------------------------------------------------- */

/**
 * Integer bit-mix hash, used instead of the `sin`-based one above.
 *
 * Not a style choice: the room maps are 512² and 256², sampled by several
 * multi-octave fields each, which comes to roughly ten million hash calls. On
 * `Math.sin` that is ~700 ms of blocked main thread before first paint. This
 * runs the same work in well under a tenth of that. The paint's orange peel
 * keeps the old hash — it is 256² sampled once, so it costs nothing, and its
 * amplitude was tuned against that specific noise.
 */
function hashInt(x: number, y: number) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function tiledNoise(x: number, y: number, period: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = smooth(x - xi)
  const yf = smooth(y - yi)
  const wrap = (v: number) => ((v % period) + period) % period

  const x0 = wrap(xi)
  const y0 = wrap(yi)
  const x1 = wrap(xi + 1)
  const y1 = wrap(yi + 1)

  const a = hashInt(x0, y0)
  const b = hashInt(x1, y0)
  const c = hashInt(x0, y1)
  const d = hashInt(x1, y1)

  return (a * (1 - xf) + b * xf) * (1 - yf) + (c * (1 - xf) + d * xf) * yf
}

/** Fractal sum of `tiledNoise`. Each octave doubles the lattice period, so the
 *  whole stack still tiles on the base period. */
function fbm(u: number, v: number, basePeriod: number, octaves: number, gain = 0.5) {
  let amplitude = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    const period = basePeriod * 2 ** i
    sum += amplitude * tiledNoise(u * period, v * period, period)
    norm += amplitude
    amplitude *= gain
  }
  return sum / norm
}

/** Uncorrelated per-texel grain — the aggregate speck in concrete. Deliberately
 *  not noise: an interpolated lattice cannot produce single-texel detail. */
function grain(x: number, y: number) {
  return hashInt(x + 17, y * 3 + 5)
}

interface TextureOptions {
  srgb?: boolean
  repeat: number
  anisotropy?: number
}

function toTexture(data: Uint8Array, size: number, { srgb, repeat, anisotropy = 8 }: TextureOptions) {
  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType)
  if (srgb) texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.repeat.set(repeat, repeat)
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = anisotropy
  texture.needsUpdate = true
  return texture
}

/** Packs a height field into a tangent-space normal map, wrapping at the edges. */
function normalFromHeight(height: Float32Array, size: number, strength: number, repeat: number) {
  const data = new Uint8Array(size * size * 4)
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)]

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      const len = Math.hypot(dx, dy, 1)
      const i = (y * size + x) * 4
      data[i] = ((-dx / len) * 0.5 + 0.5) * 255
      data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255
      data[i + 2] = (1 / len) * 0.5 * 255 + 127.5
      data[i + 3] = 255
    }
  }
  return toTexture(data, size, { repeat })
}

/**
 * Hex string to sRGB-encoded components, ready to write into a texture byte.
 *
 * `new Color('#ddd8cf')` does not hold 0xdd/0xd8/0xcf: colour management converts
 * it to linear on the way in. Writing those linear numbers into a texture that is
 * then tagged sRGB applies the transfer curve a second time, and the surface
 * renders noticeably darker and warmer than the same hex used as a flat material
 * colour. Undoing the conversion is what keeps a textured wall and a plain one
 * the same shade.
 */
function srgbTint(hex: string) {
  return new Color(hex).convertLinearToSRGB()
}

export interface SurfaceMaps {
  map: DataTexture
  normalMap: DataTexture
  roughnessMap: DataTexture
}

/**
 * Sealed concrete floor: albedo, normal and roughness.
 *
 * The roughness map does most of the work. A floor with one roughness value
 * reflects the ceiling strips as one clean band no matter where you stand, which
 * is what a mirror does, not what a garage does. Varying it — polished where
 * traffic has worn the sealer, dull where dust and old spills have killed it —
 * makes that reflection break up into patches, and a broken reflection is the
 * cue that says "this floor has been used".
 */
export function createConcreteFloorMaps(base: string, size = 512): SurfaceMaps {
  const tint = srgbTint(base)
  const height = new Float32Array(size * size)
  const albedo = new Uint8Array(size * size * 4)
  const rough = new Uint8Array(size * size * 4)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size

      // Broad blotching: pour variation and old, half-cleaned spills.
      const blotch = fbm(u, v, 3, 3)
      // Mid-scale grime, denser than the blotching so the two do not move together.
      const grime = fbm(u, v, 9, 2)
      const speck = grain(x, y)

      // Value multiplier. Centred on 1 so the mean stays at the palette colour.
      const shade = 0.78 + blotch * 0.32 + (grime - 0.5) * 0.14 + (speck - 0.5) * 0.1

      // Oil: the darkest tail of the blotch field only, so stains stay as a few
      // discrete patches rather than an even mottle over the whole slab.
      const oil = Math.max(0, 0.34 - blotch) / 0.34

      const i = (y * size + x) * 4
      // Stains are near-neutral and slightly warm; the slab itself is cool slate.
      albedo[i] = Math.min(255, tint.r * 255 * shade * (1 - oil * 0.35) + oil * 6)
      albedo[i + 1] = Math.min(255, tint.g * 255 * shade * (1 - oil * 0.4))
      albedo[i + 2] = Math.min(255, tint.b * 255 * shade * (1 - oil * 0.5))
      albedo[i + 3] = 255

      // Worn-smooth traffic lanes and slick oil versus dull, dusty edges.
      const wear = Math.max(0, blotch - 0.55) / 0.45
      const roughness = 0.78 - wear * 0.34 - oil * 0.3 + (speck - 0.5) * 0.06
      const r = Math.max(0.12, Math.min(0.95, roughness)) * 255
      rough[i] = r
      rough[i + 1] = r
      rough[i + 2] = r
      rough[i + 3] = 255

      // Aggregate bumps plus a slow trowel swell. Reuses the grime field rather
      // than sampling a third one — this loop runs a quarter of a million times.
      height[y * size + x] = speck * 0.58 + grime * 0.42
    }
  }

  return {
    map: toTexture(albedo, size, { srgb: true, repeat: 9 }),
    roughnessMap: toTexture(rough, size, { repeat: 9 }),
    normalMap: normalFromHeight(height, size, 0.5, 9),
  }
}

/**
 * Painted block wall: albedo and normal.
 *
 * No roughness map — the shell renders matte and unlit by IBL, so a roughness
 * channel would have nothing to modulate. What it needs is a value break, because
 * a 17 m wall of one colour has no scale: nothing on it tells you whether you are
 * two metres away or ten.
 */
export function createWallSurfaceMaps(base: string, size = 256): { map: DataTexture; normalMap: DataTexture } {
  const tint = srgbTint(base)
  const albedo = new Uint8Array(size * size * 4)
  const height = new Float32Array(size * size)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size

      // Fine stipple only. A broad, low-frequency term was tried first and had to
      // go: the shell's UVs come from box faces, so one wall stretches the map
      // across 19 m horizontally and 4 m vertically. Any feature big enough to
      // see gets smeared 4:1 by that, and the walls read as wood panelling. Small
      // features survive the stretch because there is nothing in them to smear.
      const stipple = fbm(u, v, 22, 2)
      const speck = grain(x, y)

      const shade = 0.96 + (stipple - 0.5) * 0.1 + (speck - 0.5) * 0.05

      const i = (y * size + x) * 4
      albedo[i] = Math.min(255, tint.r * 255 * shade)
      albedo[i + 1] = Math.min(255, tint.g * 255 * shade)
      albedo[i + 2] = Math.min(255, tint.b * 255 * shade)
      albedo[i + 3] = 255

      height[y * size + x] = stipple * 0.6 + speck * 0.4
    }
  }

  return {
    map: toTexture(albedo, size, { srgb: true, repeat: 9 }),
    normalMap: normalFromHeight(height, size, 0.35, 9),
  }
}
