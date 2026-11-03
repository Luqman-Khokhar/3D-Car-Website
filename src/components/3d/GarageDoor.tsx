import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CylinderGeometry } from 'three'
import type { BufferGeometry, Group, Material, Mesh, Texture } from 'three'
import {
  DOOR_OPEN_TRAVEL,
  DOOR_PANELS,
  DOOR_Z,
  doorPanelPose,
} from '@/scenes/garage'
import type { DoorPart, GarageMaterialKey, Prop } from '@/scenes/garage'
import { buildGeometry, createMaterial, MATERIAL_SPECS, PROP_ENV_INTENSITY } from './Garage'
import { garageDoorState, toggleGarageDoor } from '@/animations/garageDoorState'
import { lightingState } from '@/animations/lightingState'
import { useEnvironmentMap } from './environmentContext'
import { WallLightSwitches } from './WallLightSwitches'
import { OutsideWorld } from './OutsideWorld'
import { requestFrame } from '@/lib/frame'
import { useHoverCursor } from '@/lib/hoverCursor'

/** How fast the chain eases toward its target, as the fraction of the remaining
 *  gap closed per second — same framerate-independent form as CameraRig's
 *  return-to-scripted ease. Tuned for a door that visibly accelerates and
 *  settles rather than snapping, without making the user wait it out. */
const DOOR_SMOOTHING = 0.4
/** Arc-length fraction below which the door counts as arrived and snaps, so the
 *  demand-driven render loop gets a last frame instead of an asymptote. */
const DOOR_EPSILON = 0.0005
/** Same, for the push-button cap's press decay. */
const PRESS_EPSILON = 0.002

/** Every material a piece of the moving leaf can use, built once and shared —
 *  mirrors how Garage.tsx batches the static room by material. */
function useDoorMaterials(envMap: Texture | null) {
  const materials = useMemo(() => {
    const keys: GarageMaterialKey[] = ['door', 'darkMetal', 'rubber', 'steel', 'glass']
    const map = new Map<GarageMaterialKey, Material>()
    for (const key of keys) map.set(key, createMaterial(MATERIAL_SPECS[key], envMap))
    return map
  }, [envMap])

  useEffect(() => {
    return () => {
      for (const material of materials.values()) material.dispose()
    }
  }, [materials])

  return materials
}

function partGeometry(part: DoorPart): BufferGeometry {
  const prop: Prop = { kind: 'box', args: part.args, position: [0, 0, 0], material: part.material }
  return buildGeometry(prop)
}

/**
 * The sectional door's moving leaf: five panel groups, each carrying its own
 * ribs and any hardware riding on it (seal, handle, vision lights). Every
 * frame each group is placed by `doorPanelPose`, which is the only thing that
 * knows about the vertical run, the curve, and the horizontal track — this
 * component just asks it where panel `i` belongs for the current arc-length.
 */
export const GarageDoor = memo(function GarageDoor() {
  const envMap = useEnvironmentMap()
  const materials = useDoorMaterials(envMap)
  const groupRefs = useRef<(Group | null)[]>([])

  const geometries = useMemo(() => DOOR_PANELS.map((panel) => panel.parts.map(partGeometry)), [])

  useEffect(() => {
    return () => {
      for (const panel of geometries) for (const geometry of panel) geometry.dispose()
    }
  }, [geometries])

  useFrame((_, delta) => {
    const target = garageDoorState.open ? 1 : 0
    const t = 1 - Math.pow(DOOR_SMOOTHING, delta)
    garageDoorState.progress += (target - garageDoorState.progress) * t
    if (Math.abs(target - garageDoorState.progress) < DOOR_EPSILON) garageDoorState.progress = target
    else requestFrame()

    for (let i = 0; i < DOOR_PANELS.length; i++) {
      const group = groupRefs.current[i]
      if (!group) continue
      const s = DOOR_PANELS[i].restS + garageDoorState.progress * DOOR_OPEN_TRAVEL
      const pose = doorPanelPose(s)
      group.position.set(0, pose.y, pose.z)
      group.rotation.x = pose.rotX
    }
  })

  // Same blackout driver as the static room: glazing dims with the rest of the
  // lamps, metal props dim their IBL contribution. Kept separate from Garage's
  // pass because these materials are not in its `groups` array.
  const applied = useRef(-1)
  useFrame(() => {
    const { dim } = lightingState
    if (dim === applied.current) return
    applied.current = dim

    for (const [key, material] of materials) {
      const m = material as unknown as { emissiveIntensity?: number; envMapIntensity?: number }
      const emissive = MATERIAL_SPECS[key].emissiveIntensity
      if (emissive !== undefined) m.emissiveIntensity = emissive * (1 - 0.94 * dim)
      if (m.envMapIntensity !== undefined) m.envMapIntensity = PROP_ENV_INTENSITY * (1 - 0.92 * dim)
    }
  })

  return (
    <group name="garageDoorLeaf">
      {DOOR_PANELS.map((panel, i) => (
        <group
          key={panel.index}
          ref={(el) => {
            groupRefs.current[i] = el
          }}
        >
          {panel.parts.map((part, j) => (
            <mesh
              key={j}
              geometry={geometries[i][j]}
              material={materials.get(part.material)}
              position={part.offset}
            />
          ))}
        </group>
      ))}
      <DoorButton />
      <WallLightSwitches />
      <OutsideWorld />
    </group>
  )
})

/** Mount point for the red push button, on the wall to the right of the
 *  opening, at a comfortable reach height. */
const BUTTON_POSITION: [number, number, number] = [3.05, 1.3, DOOR_Z + 0.1]

/**
 * Wall-mounted push button beside the door. Clicking it flips the door's open
 * target; a short-lived press decays the cap inward and back so the click
 * reads as a real switch rather than a UI hitbox floating in the room.
 *
 * Only reachable in free-look: the scroll spacers over the canvas swallow
 * pointer events outside it (see ScrollSections.tsx), same as every other
 * pointer interaction in the scene.
 */
const DoorButton = memo(function DoorButton() {
  const envMap = useEnvironmentMap()
  const capRef = useRef<Mesh>(null)
  const press = useRef(0)
  const hover = useHoverCursor()

  const parts = useMemo(() => {
    const housing = createMaterial(MATERIAL_SPECS.darkMetal, envMap)
    const cap = createMaterial(MATERIAL_SPECS.redPaint, envMap)
    return {
      housing,
      cap,
      housingGeo: buildGeometry({ kind: 'box', args: [0.16, 0.16, 0.04], position: [0, 0, 0], material: 'darkMetal' }),
      capGeo: new CylinderGeometry(0.055, 0.055, 0.03, 20),
    }
  }, [envMap])

  useEffect(() => {
    return () => {
      parts.housing.dispose()
      parts.cap.dispose()
      parts.housingGeo.dispose()
      parts.capGeo.dispose()
    }
  }, [parts])

  useFrame((_, delta) => {
    press.current *= Math.pow(0.0008, delta)
    if (press.current < PRESS_EPSILON) press.current = 0
    else requestFrame()
    // Local to the button's own group (BUTTON_POSITION), not world space. -z is
    // toward the room on this wall (see DOOR_Z), so the cap rests proud of the
    // housing and eases back toward it on a press.
    if (capRef.current) capRef.current.position.z = -0.05 + press.current * 0.025
  })

  return (
    <group position={BUTTON_POSITION}>
      <mesh geometry={parts.housingGeo} material={parts.housing} />
      <mesh
        ref={capRef}
        geometry={parts.capGeo}
        material={parts.cap}
        position={[0, 0, -0.05]}
        rotation={[Math.PI / 2, 0, 0]}
        {...hover}
        onClick={(e) => {
          e.stopPropagation()
          press.current = 1
          toggleGarageDoor()
          requestFrame()
        }}
      />
    </group>
  )
})
