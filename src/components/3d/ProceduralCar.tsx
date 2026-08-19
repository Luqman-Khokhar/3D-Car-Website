import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { CAR_PARTS } from '@/scenes/carParts'
import type { CarPart } from '@/scenes/carParts'
import { mergePart } from '@/lib/mergeParts'
import type { MergedGroup } from '@/lib/mergeParts'
import { useCarMaterials } from '@/hooks/useCarMaterials'
import type { CarMaterials } from '@/hooks/useCarMaterials'
import { registerPart, clearRegistry } from '@/animations/partRegistry'
import { driveState } from '@/animations/driveState'
import { useSceneStore } from '@/store/useSceneStore'
import { RobotRig } from './RobotRig'

/** Per-second fraction of the remaining gap closed while easing the car back
 *  to the garage origin after free look ends — same exponential form as
 *  garageDoorState's DOOR_SMOOTHING. */
const DRIVE_RETURN_SMOOTHING = 0.1
const DRIVE_RETURN_EPSILON = 0.01

interface PartGroupProps {
  part: CarPart
  groups: MergedGroup[]
  materials: CarMaterials
}

/**
 * One named group per part, containing one merged mesh per material used by that
 * part. Timelines tween the group, never the meshes, so a part built from fifty
 * primitives still animates as one rigid body.
 */
const PartGroup = memo(function PartGroup({ part, groups, materials }: PartGroupProps) {
  // Callback ref instead of useEffect: the group must be in the registry before
  // any timeline binds, and callback refs fire during commit.
  const attach = useCallback(
    (group: Group | null) => {
      registerPart(part.id, group)
    },
    [part.id],
  )

  return (
    <group ref={attach} name={part.id} position={part.position} rotation={part.rotation}>
      {groups.map((group) => (
        <mesh
          key={group.material}
          geometry={group.geometry}
          material={materials[group.material]}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  )
})

/**
 * Stand-in for a real GLB, built from primitives at real-world scale. Part names
 * match the GLB contract in public/models/README.md, so swapping in a downloaded
 * model changes only CarModel.tsx — no timeline touches this file.
 */
export function ProceduralCar() {
  const materials = useCarMaterials()
  const setModelReady = useSceneStore((s) => s.setModelReady)
  const carGroupRef = useRef<Group>(null)

  // Merging is the expensive step, so it happens once for the whole car.
  const merged = useMemo(
    () => CAR_PARTS.map((part) => ({ part, groups: mergePart(part) })),
    [],
  )

  useEffect(() => {
    return () => {
      for (const { groups } of merged) {
        for (const group of groups) group.geometry.dispose()
      }
    }
  }, [merged])

  useEffect(() => {
    setModelReady(true)
    return () => {
      setModelReady(false)
      clearRegistry()
    }
  }, [setModelReady])

  // Drives the car's rigid-body offset from arrow-key input written by
  // DriveControls — a wrapper transform outside the per-part assembly groups,
  // so it never fights the timeline's own part tweens.
  useFrame((_, delta) => {
    const group = carGroupRef.current
    if (!group) return

    if (driveState.returning) {
      const t = 1 - Math.pow(DRIVE_RETURN_SMOOTHING, delta)
      driveState.x += (0 - driveState.x) * t
      driveState.z += (0 - driveState.z) * t
      driveState.yaw += (0 - driveState.yaw) * t
      if (
        Math.abs(driveState.x) < DRIVE_RETURN_EPSILON &&
        Math.abs(driveState.z) < DRIVE_RETURN_EPSILON &&
        Math.abs(driveState.yaw) < DRIVE_RETURN_EPSILON
      ) {
        driveState.x = 0
        driveState.z = 0
        driveState.yaw = 0
        driveState.returning = false
      }
    }

    group.position.set(driveState.x, 0, driveState.z)
    group.rotation.y = driveState.yaw
  })

  return (
    <group name="car" ref={carGroupRef}>
      {merged.map(({ part, groups }) => (
        <PartGroup key={part.id} part={part} groups={groups} materials={materials} />
      ))}
      {/* Robot skeleton, collapsed and hidden until the transform runs. Inside the
          same group so the panels and the limbs share one parent transform, and
          handed this component's materials so the painted armour tracks the paint
          scene — see RobotRig. */}
      <RobotRig materials={materials} />
    </group>
  )
}
