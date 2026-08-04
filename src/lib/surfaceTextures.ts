import { DataTexture, RGBAFormat, RepeatWrapping, UnsignedByteType, LinearFilter, LinearMipmapLinearFilter } from 'three'

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
