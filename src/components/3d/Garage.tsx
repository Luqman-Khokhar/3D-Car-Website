import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
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
import type { BufferGeometry, Group, Material, Texture } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CLOCK_FACE_CENTER, GARAGE_PROPS } from '@/scenes/garage'
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

function createMaterial(spec: MaterialSpec, envMap: Texture | null): Material {
  const { matte, ...params } = spec
  return matte
    ? new MeshLambertMaterial({
        color: params.color,
        emissive: params.emissive,
        emissiveIntensity: params.emissiveIntensity,
      })
    : new MeshStandardMaterial({ ...params, envMap, envMapIntensity: 0.7 })
}

/**
 * A clock hand: a bar whose pivot sits at one end rather than at its centre, so
 * the parent group's rotation swings it about the clock's centre. `depth` lifts
 * it off the face far enough to clear the hand behind it.
 */
function handGeometry(length: number, width: number, depth: number): BufferGeometry {
  const geometry = new BoxGeometry(0.014, length, width)
  // Overhang past the pivot, so the hand looks pinned rather than hinged.
  geometry.translate(depth, length / 2 - length * 0.14, 0)
  return geometry
}

/**
 * Wall-clock hands, driven off the system clock so the garage shows the viewer's
 * real local time.
 *
 * The face normal is +X and the camera is on the +X side of it, which puts the
 * viewer's right at -Z. A positive rotation about X carries +Y toward +Z, i.e.
 * anticlockwise on screen — hence the negated angles below.
 *
 * Rotations are written straight onto the groups in useFrame rather than held in
 * state: this runs every frame, and re-rendering React 60 times a second for
 * three quaternions would cost far more than the hands are worth.
 */
const WallClock = memo(function WallClock() {
  const envMap = useEnvironmentMap()
  const hour = useRef<Group>(null)
  const minute = useRef<Group>(null)
  const second = useRef<Group>(null)

  const parts = useMemo(() => {
    const dark = createMaterial(MATERIAL_SPECS.darkMetal, envMap)
    const red = createMaterial(MATERIAL_SPECS.redPaint, envMap)
    return {
      dark,
      red,
      hour: handGeometry(0.115, 0.018, 0.006),
      minute: handGeometry(0.17, 0.014, 0.013),
      second: handGeometry(0.185, 0.008, 0.02),
      cap: new CylinderGeometry(0.014, 0.014, 0.05, 10),
    }
  }, [envMap])

  useEffect(() => {
    return () => {
      parts.dark.dispose()
      parts.red.dispose()
      parts.hour.dispose()
      parts.minute.dispose()
      parts.second.dispose()
      parts.cap.dispose()
    }
  }, [parts])

  useFrame(() => {
    const now = new Date()
    const s = now.getSeconds()
    const m = now.getMinutes()
    const h = now.getHours() % 12
    const turn = Math.PI * 2
    // The seconds hand steps once a second the way a quartz movement does; the
    // other two sweep, because a minute hand that only jumps reads as broken.
    if (second.current) second.current.rotation.x = -(s / 60) * turn
    if (minute.current) minute.current.rotation.x = -((m + s / 60) / 60) * turn
    if (hour.current) hour.current.rotation.x = -((h + m / 60) / 12) * turn
  })

  return (
    <group position={CLOCK_FACE_CENTER} name="wallClock">
      <group ref={hour}>
        <mesh geometry={parts.hour} material={parts.dark} />
      </group>
      <group ref={minute}>
        <mesh geometry={parts.minute} material={parts.dark} />
      </group>
      <group ref={second}>
        <mesh geometry={parts.second} material={parts.red} />
      </group>
      {/* Centre boss, hiding where the three hands overlap. */}
      <mesh
        geometry={parts.cap}
        material={parts.dark}
        position={[0.014, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      />
    </group>
  )
})

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
      const material = createMaterial(MATERIAL_SPECS[key], envMap)

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
      <WallClock />
    </group>
  )
})
