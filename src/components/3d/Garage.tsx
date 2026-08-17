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
  Vector2,
  Vector3,
} from 'three'
import type { BufferGeometry, Group, Material, Texture } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { CLOCK_FACE_CENTER, GARAGE_PROPS } from '@/scenes/garage'
import type { GarageMaterialKey, Prop } from '@/scenes/garage'
import { GARAGE_WALL } from '@/scenes/palette'
import { createWallSurfaceMaps } from '@/lib/surfaceTextures'
import { lightingState } from '@/animations/lightingState'
import { useSceneStore } from '@/store/useSceneStore'
import { approach, CEILING_FADE, switchTarget } from './GarageLights'
import { useEnvironmentMap } from './environmentContext'

/**
 * Largest chamfer any prop gets, in metres. Roughly a 10 mm break — the arris you
 * get on a rolled steel section or a painted timber edge.
 */
const EDGE_RADIUS = 0.012
/** Below this thickness a prop is a plate or a painted line; chamfering it costs
 *  13x the vertices to round an edge nobody can resolve. */
const MIN_CHAMFER_DIM = 0.05

/**
 * Builds a prop's geometry, breaking box edges where the prop is thick enough to
 * have a real one.
 *
 * This is the largest single realism change in the room. A perfectly sharp
 * 90-degree edge does not exist on any manufactured object, and more to the point
 * it cannot catch light: the shading jumps from one face's value straight to the
 * next, so every box in the scene reads as a flat-shaded primitive. A chamfer a
 * centimetre wide puts a bright sliver along every edge in the room, and that
 * sliver is what makes the shapes look built rather than generated.
 *
 * `segments: 1` gives three quads per face axis — one flat centre and two rounded
 * shoulders. That is the cheapest form that still produces the highlight.
 */
export function buildGeometry(prop: Prop): BufferGeometry {
  if (prop.kind === 'box') {
    const [w, h, d] = prop.args
    const smallest = Math.min(w, h, d)
    if (smallest < MIN_CHAMFER_DIM) return new BoxGeometry(w, h, d)
    return new RoundedBoxGeometry(w, h, d, 1, Math.min(EDGE_RADIUS, smallest * 0.22))
  }
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
  // mergeGeometries refuses a mix of indexed and non-indexed inputs, and
  // RoundedBoxGeometry is non-indexed while every other primitive here is
  // indexed. Flattening everything is the only way the two can share a group.
  if (geometry.index === null) return geometry
  const flat = geometry.toNonIndexed()
  geometry.dispose()
  return flat
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
  /**
   * Take albedo and normal from a generated plaster surface tinted to `color`,
   * rather than rendering flat colour. Only worth it on the shell: those are the
   * surfaces big enough on screen for flatness to be obvious.
   */
  plaster?: boolean
}

/** Baseline emissive on the ceiling strips, and baseline IBL on every prop that
 *  gets one. Both are scaled down by the blackout driver below, so they live here
 *  rather than inline in the spec table and the constructor. */
const LAMP_EMISSIVE = 1.1
export const PROP_ENV_INTENSITY = 0.7

export const MATERIAL_SPECS: Record<GarageMaterialKey, MaterialSpec> = {
  // Matte colours run lighter than they would under IBL: Lambert gets no
  // environment contribution, so values tuned against a Standard material come
  // out muddy. These are pre-compensated.
  wall: { color: GARAGE_WALL, matte: true, plaster: true },
  ceiling: { color: '#cdc8bf', matte: true, plaster: true },
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
  // Glazing, in the high window and the door's vision panels. Carries its own
  // emissive because there is no world outside the shell to see through it: with
  // reflection alone the panes render darker than the wall around them, which
  // reads as a hole rather than as daylight.
  glass: { color: '#b7cddb', emissive: '#9fc4dd', emissiveIntensity: 0.5, roughness: 0.1, metalness: 0.1 },
  // Bright, slightly rough zinc. Deliberately lighter and less polished than
  // `steel`, so conduit and door gear separate from hand tools instead of
  // merging into one grey metal.
  galv: { color: '#b3bac0', roughness: 0.46, metalness: 0.72 },
  // Oxidised steel: still metallic enough to catch the strip lights, matt and
  // brown enough to read as old next to the galvanised runs beside it.
  rust: { color: '#6d4636', roughness: 0.84, metalness: 0.34 },
  yellow: { color: '#c19a24', roughness: 0.66, metalness: 0.08 },
  // Painted dado. Mid tone rather than near-black: a dark band at floor level
  // plus a dark ceiling and a slate floor squeezes the room into a letterbox of
  // wall, and the whole shot loses its middle values.
  dado: { color: '#565f66', matte: true },
  // Painted structural steel, and deliberately Standard rather than matte so it
  // picks up the strip lights. Joists in bare dark metal render as black bars:
  // nothing below them lights their undersides.
  structure: { color: '#6a7076', roughness: 0.66, metalness: 0.32 },
  // Slab joints and drain recesses. Matte and dark, because these stand in for
  // gaps: anything with a specular response reads as a painted stripe. Neutral
  // rather than blue — the shell's hemisphere fill tints matte surfaces toward
  // the sky colour, and a cool seam came out navy.
  seam: { color: '#2c2e30', matte: true },
  // Split per row (back/mid/front) rather than one shared 'lamp' key, so each
  // row's wall switch can fade only its own pair of tubes — see the per-row
  // useFrame block below.
  lampBack: { color: '#f2efe4', emissive: '#fff6e2', emissiveIntensity: LAMP_EMISSIVE, matte: true },
  lampMid: { color: '#f2efe4', emissive: '#fff6e2', emissiveIntensity: LAMP_EMISSIVE, matte: true },
  lampFront: { color: '#f2efe4', emissive: '#fff6e2', emissiveIntensity: LAMP_EMISSIVE, matte: true },
}

/** Albedo + normal for the shell, tinted at generation time — so the material's
 *  own colour stays white and does not tint the map a second time. */
type PlasterMaps = ReturnType<typeof createWallSurfaceMaps>

export function createMaterial(spec: MaterialSpec, envMap: Texture | null, plaster?: PlasterMaps): Material {
  const { matte, plaster: _plaster, ...params } = spec
  if (matte) {
    const material = new MeshLambertMaterial({
      color: plaster ? '#ffffff' : params.color,
      emissive: params.emissive,
      emissiveIntensity: params.emissiveIntensity,
    })
    if (plaster) {
      material.map = plaster.map
      material.normalMap = plaster.normalMap
      // Barely there. Painted blockwork is a texture you read as a change in
      // value, not as relief; a strong normal turns the walls into stucco.
      material.normalScale = new Vector2(0.3, 0.3)
    }
    return material
  }
  return new MeshStandardMaterial({ ...params, envMap, envMapIntensity: PROP_ENV_INTENSITY })
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

  // One set of maps per distinct shell colour, generated once. Both keys that use
  // them cover thousands of pixels, and both would otherwise render as a single
  // flat value across a 17 m surface.
  const plaster = useMemo(() => {
    const cache = new Map<string, PlasterMaps>()
    for (const spec of Object.values(MATERIAL_SPECS)) {
      if (spec.plaster && !cache.has(spec.color)) cache.set(spec.color, createWallSurfaceMaps(spec.color))
    }
    return cache
  }, [])

  useEffect(() => {
    return () => {
      for (const maps of plaster.values()) {
        maps.map.dispose()
        maps.normalMap.dispose()
      }
    }
  }, [plaster])

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
      const material = createMaterial(spec, envMap, spec.plaster ? plaster.get(spec.color) : undefined)

      return { key, geometry: merged, material }
    })
  }, [envMap, plaster])

  useEffect(() => {
    return () => {
      for (const group of groups) {
        group.geometry?.dispose()
        group.material.dispose()
      }
    }
  }, [groups])

  // Switches the room off along with the light rig. Two things here are not
  // lights and so survive dimming on their own: the ceiling strips are emissive
  // geometry, and every metal prop is lit by the environment map. Leaving either
  // alone gives a blackout with glowing tubes still hanging in it and a chrome
  // tool wall still catching a room that is no longer lit.
  const tubeBackSwitch = useSceneStore((s) => s.lightSwitches.tubeBack)
  const tubeMidSwitch = useSceneStore((s) => s.lightSwitches.tubeMid)
  const tubeFrontSwitch = useSceneStore((s) => s.lightSwitches.tubeFront)
  // Tracks the same thrown-switch fade as the ceiling fixtures in GarageLights,
  // so each row's tube geometry goes out with the light it is standing in for
  // rather than only reacting to the scroll-scrubbed atmosphere.
  const backLevel = useRef(1)
  const midLevel = useRef(1)
  const frontLevel = useRef(1)
  const applied = useRef(-1)
  useFrame((_state, dt) => {
    const { dim } = lightingState
    const backTarget = switchTarget(tubeBackSwitch)
    const midTarget = switchTarget(tubeMidSwitch)
    const frontTarget = switchTarget(tubeFrontSwitch)
    const anyTubeThrown = backTarget !== null || midTarget !== null || frontTarget !== null
    if (backTarget !== null) backLevel.current = approach(backLevel.current, backTarget, dt, CEILING_FADE)
    if (midTarget !== null) midLevel.current = approach(midLevel.current, midTarget, dt, CEILING_FADE)
    if (frontTarget !== null) frontLevel.current = approach(frontLevel.current, frontTarget, dt, CEILING_FADE)
    if (!anyTubeThrown && dim === applied.current) {
      return
    }
    applied.current = dim

    // Each row's strip follows its own thrown switch; every other emissive
    // (the door/window glazing) only ever follows the atmosphere dim.
    const backDim = backTarget !== null ? 1 - backLevel.current : dim
    const midDim = midTarget !== null ? 1 - midLevel.current : dim
    const frontDim = frontTarget !== null ? 1 - frontLevel.current : dim

    for (const group of groups) {
      const material = group.material as unknown as {
        emissiveIntensity?: number
        envMapIntensity?: number
      }
      // Any emissive in the room is a light fitting or a window, and both go out
      // with the rest of the building. Read off the spec rather than special
      // casing the lamps, so glazing added later dims without touching this.
      const emissive = MATERIAL_SPECS[group.key].emissiveIntensity
      if (emissive !== undefined) {
        let groupDim = dim
        if (group.key === 'lampBack') groupDim = backDim
        else if (group.key === 'lampMid') groupDim = midDim
        else if (group.key === 'lampFront') groupDim = frontDim
        material.emissiveIntensity = emissive * (1 - 0.94 * groupDim)
      }
      if (material.envMapIntensity !== undefined) {
        material.envMapIntensity = PROP_ENV_INTENSITY * (1 - 0.92 * dim)
      }
    }
  })

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
