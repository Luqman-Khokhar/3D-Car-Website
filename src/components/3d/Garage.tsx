import { memo, useEffect, useMemo } from 'react'
import {
  BoxGeometry,
  CylinderGeometry,
  TorusGeometry,
  Euler,
  Matrix4,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three'
import type { BufferGeometry, Material } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GARAGE_PROPS } from '@/scenes/garage'
import type { GarageMaterialKey, Prop } from '@/scenes/garage'
import { GARAGE_WALL } from '@/scenes/palette'
import { useEnvironmentMap } from './environmentContext'

function buildGeometry(prop: Prop): BufferGeometry {
  if (prop.kind === 'box') return new BoxGeometry(...prop.args)
  if (prop.kind === 'cylinder') {
    const [rTop, rBottom, height, radial] = prop.args
    return new CylinderGeometry(rTop, rBottom, height, radial)
  }
  return new TorusGeometry(...prop.args)
}

/**
 * Bakes a prop's transform into its vertices so it can be merged. Merging is
 * only valid in a shared space — a merged mesh has one transform for everything
 * in it, so each contribution has to carry its own placement.
 */
function bake(geometry: BufferGeometry, prop: Prop) {
  const matrix = new Matrix4().compose(
    new Vector3(...prop.position),
    new Quaternion().setFromEuler(new Euler(...(prop.rotation ?? [0, 0, 0]))),
    new Vector3(1, 1, 1),
  )
  geometry.applyMatrix4(matrix)
  return geometry
}

interface MaterialSpec {
  color: string
  emissive?: string
  emissiveIntensity?: number
  roughness?: number
  metalness?: number
  /**
   * Matte surfaces use MeshLambertMaterial — no PBR BRDF, no environment lookup.
   * Reserved for the shell, which covers most of the screen and reflects nothing.
   * Anything metallic keeps MeshStandardMaterial plus IBL, because those are small
   * on screen so the per-fragment cost barely registers.
   */
  matte?: boolean
}

const MATERIAL_SPECS: Record<GarageMaterialKey, MaterialSpec> = {
  // Matte colours run lighter than they would under IBL: Lambert gets no
  // environment contribution, so values tuned against a Standard material come
  // out muddy. These are pre-compensated.
  wall: { color: GARAGE_WALL, matte: true },
  ceiling: { color: '#cdc8bf', matte: true },
  // Warm hardboard, so the steel tools read against it.
  pegboard: { color: '#b58f64', matte: true },
  wood: { color: '#c08f5c', matte: true },
  crate: { color: '#d0a97b', matte: true },
  door: { color: '#c6cace', matte: true },
  // Painted bay lines: dead matte and slightly warm, or they read as glowing strips.
  marking: { color: '#c9bf94', matte: true },
  steel: { color: '#9aa1a9', roughness: 0.34, metalness: 0.86 },
  darkMetal: { color: '#33383e', roughness: 0.52, metalness: 0.62 },
  redPaint: { color: '#a8322c', roughness: 0.42, metalness: 0.28 },
  rubber: { color: '#1a1c1f', roughness: 0.9, metalness: 0.03 },
  drum: { color: '#3d5f7a', roughness: 0.46, metalness: 0.42 },
  glass: { color: '#b7cddb', roughness: 0.1, metalness: 0.1 },
  lamp: { color: '#f2efe4', emissive: '#fff6e2', emissiveIntensity: 1.1, matte: true },
}

/**
 * Static garage interior: shell, tool wall, workbench, shelving, roller cabinet,
 * drums, sectional door and ceiling strips.
 *
 * Every prop is merged into one geometry per material, which turns ~250 props
 * into 12 draw calls. Without merging this alone would roughly triple the scene's
 * draw call count and cost more than the car does.
 *
 * Nothing here casts or receives shadows on purpose: the spotlight's shadow
 * camera is clamped tightly around the car (near 4 / far 14), so the room is
 * outside it and would pay for shadow passes it can never appear in.
 */
export const Garage = memo(function Garage() {
  const envMap = useEnvironmentMap()

  const groups = useMemo(() => {
    const byMaterial = new Map<GarageMaterialKey, BufferGeometry[]>()

    for (const prop of GARAGE_PROPS) {
      const geometry = bake(buildGeometry(prop), prop)
      const list = byMaterial.get(prop.material) ?? []
      list.push(geometry)
      byMaterial.set(prop.material, list)
    }

    return [...byMaterial.entries()].map(([key, geometries]) => {
      const merged = mergeGeometries(geometries)
      // mergeGeometries copies vertex data out, so the sources are now dead weight.
      for (const geometry of geometries) geometry.dispose()
      const spec = MATERIAL_SPECS[key]
      const { matte, ...params } = spec
      const material: Material = matte
        ? new MeshLambertMaterial({
            color: params.color,
            emissive: params.emissive,
            emissiveIntensity: params.emissiveIntensity,
          })
        : new MeshStandardMaterial({ ...params, envMap, envMapIntensity: 0.7 })

      return { key, geometry: merged, material }
    })
  }, [envMap])

  useEffect(() => {
    return () => {
      for (const group of groups) {
        group.geometry?.dispose()
        group.material.dispose()
      }
    }
  }, [groups])

  return (
    <group name="garage">
      {groups.map((group) =>
        group.geometry ? (
          <mesh key={group.key} geometry={group.geometry} material={group.material} />
        ) : null,
      )}
    </group>
  )
})
