import { memo, useCallback, useEffect, useMemo } from 'react'
import type { Group } from 'three'
import { CAR_PARTS } from '@/scenes/carParts'
import type { CarPart } from '@/scenes/carParts'
import { mergePart } from '@/lib/mergeParts'
import type { MergedGroup } from '@/lib/mergeParts'
import { useCarMaterials } from '@/hooks/useCarMaterials'
import type { CarMaterials } from '@/hooks/useCarMaterials'
import { registerPart, clearRegistry } from '@/animations/partRegistry'
import { useSceneStore } from '@/store/useSceneStore'

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

  return (
    <group name="car">
      {merged.map(({ part, groups }) => (
        <PartGroup key={part.id} part={part} groups={groups} materials={materials} />
      ))}
    </group>
  )
}
