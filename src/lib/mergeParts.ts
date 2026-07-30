import {
  BoxGeometry,
  CylinderGeometry,
  TorusGeometry,
  Euler,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three'
import type { BufferGeometry } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { CarPart, MaterialKey, Primitive } from '@/scenes/carParts'

const BEVEL = 0.022
const MIN_BEVEL = 0.004
const BEVEL_SEGMENTS = 1

/**
 * A box can only be rounded by less than half its smallest dimension, or the
 * geometry inverts. Thin panels (the 0.02 m windshield) and small engine details
 * therefore get a proportionally smaller bevel, or none.
 */
function bevelFor(args: [number, number, number]) {
  const smallest = Math.min(...args)
  return Math.min(BEVEL, smallest * 0.3)
}

function build(primitive: Primitive): BufferGeometry {
  if (primitive.kind === 'box') {
    const bevel = bevelFor(primitive.args)
    return bevel >= MIN_BEVEL
      ? new RoundedBoxGeometry(...primitive.args, BEVEL_SEGMENTS, bevel)
      : new BoxGeometry(...primitive.args)
  }
  if (primitive.kind === 'cylinder') {
    const [rTop, rBottom, height, radial] = primitive.args
    return new CylinderGeometry(rTop, rBottom, height, radial, 1, primitive.openEnded === true)
  }
  return new TorusGeometry(...primitive.args)
}

export interface MergedGroup {
  material: MaterialKey
  geometry: BufferGeometry
}

/**
 * Collapses a part's primitives into one geometry per material.
 *
 * Parts are rigid — primitives never move relative to each other, only the part
 * group does — so merging costs nothing in flexibility and removes a draw call
 * per primitive. The detailed engine alone is ~50 primitives; unmerged that would
 * be ~100 extra draw calls once the shadow pass is counted.
 *
 * Transforms are baked into the vertices because a merged mesh has a single
 * transform for everything inside it.
 */
export function mergePart(part: CarPart): MergedGroup[] {
  const byMaterial = new Map<MaterialKey, BufferGeometry[]>()

  for (const primitive of part.primitives) {
    const raw = build(primitive)

    // mergeGeometries rejects a mix of indexed and non-indexed inputs, and
    // RoundedBoxGeometry is non-indexed while Box/Cylinder/Torus are indexed.
    // Normalising everything to non-indexed is the cheap way to make any
    // combination mergeable; it costs some duplicated vertices, not draw calls.
    const geometry = raw.index ? raw.toNonIndexed() : raw
    if (geometry !== raw) raw.dispose()

    geometry.applyMatrix4(
      new Matrix4().compose(
        new Vector3(...(primitive.position ?? [0, 0, 0])),
        new Quaternion().setFromEuler(new Euler(...(primitive.rotation ?? [0, 0, 0]))),
        new Vector3(1, 1, 1),
      ),
    )

    const key = primitive.material ?? part.material
    const list = byMaterial.get(key) ?? []
    list.push(geometry)
    byMaterial.set(key, list)
  }

  const groups: MergedGroup[] = []
  for (const [material, geometries] of byMaterial) {
    const merged = mergeGeometries(geometries)
    // mergeGeometries copies the vertex data out, so the sources are dead weight.
    for (const geometry of geometries) geometry.dispose()
    if (merged) groups.push({ material, geometry: merged })
  }
  return groups
}
