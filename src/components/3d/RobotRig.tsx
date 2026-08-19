import { memo, useCallback, useEffect, useMemo } from 'react'
import type { Group } from 'three'
import { ROBOT_BONES } from '@/scenes/robotParts'
import type { RobotBone } from '@/scenes/robotParts'
import { mergePart } from '@/lib/mergeParts'
import type { MergedGroup } from '@/lib/mergeParts'
import type { CarMaterials } from '@/hooks/useCarMaterials'
import { registerBone, clearBoneRegistry } from '@/animations/boneRegistry'
import { BONE_STOW_SCALE, boneStowPosition } from '@/animations/robotPose'

interface BoneGroupProps {
  bone: RobotBone
  groups: MergedGroup[]
  materials: CarMaterials
}

/**
 * One group per bone, mounted collapsed and hidden.
 *
 * Mounted from the first frame rather than added when the transform starts: the
 * fold is a GSAP timeline that resolves Object3D handles up front and then plays,
 * so a bone that appears in the same commit as the timeline is built would not be
 * in the registry in time. Hidden and at BONE_STOW_SCALE it costs nothing — three
 * skips invisible objects before the draw call and before the shadow pass.
 */
const BoneGroup = memo(function BoneGroup({ bone, groups, materials }: BoneGroupProps) {
  // Callback ref for the same reason PartGroup uses one: the handle has to be in
  // the registry before any timeline binds, and callback refs fire during commit.
  const attach = useCallback(
    (group: Group | null) => {
      registerBone(bone.id, group)
    },
    [bone.id],
  )

  const stow = useMemo(() => boneStowPosition(bone), [bone])

  return (
    <group
      ref={attach}
      name={bone.id}
      position={stow}
      rotation={bone.rot ?? [0, 0, 0]}
      scale={BONE_STOW_SCALE}
      visible={false}
    >
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
 * The robot's skeleton: everything the car has no panel for.
 *
 * Rendered inside ProceduralCar's `car` group and handed that component's
 * materials, so the painted armour plates share the one `bodyPaint` instance the
 * paint scene tweens — a second call to useCarMaterials would build a second set
 * and the robot's plates would stay in primer while the panels went red.
 */
export const RobotRig = memo(function RobotRig({ materials }: { materials: CarMaterials }) {
  const merged = useMemo(
    () => ROBOT_BONES.map((bone) => ({ bone, groups: mergePart(bone) })),
    [],
  )

  useEffect(() => {
    return () => {
      for (const { groups } of merged) {
        for (const group of groups) group.geometry.dispose()
      }
    }
  }, [merged])

  useEffect(() => () => clearBoneRegistry(), [])

  return (
    <>
      {merged.map(({ bone, groups }) => (
        <BoneGroup key={bone.id} bone={bone} groups={groups} materials={materials} />
      ))}
    </>
  )
})
