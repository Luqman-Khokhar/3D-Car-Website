import { memo, useEffect, useMemo } from 'react'
import { GARAGE_FLOOR } from '@/scenes/palette'
import { createConcreteFloorMaps } from '@/lib/surfaceTextures'

/**
 * Garage floor. Catches the spotlight shadow — without a receiver the car reads
 * as floating. Slightly glossy so the overhead lamp leaves a soft sheen, the way
 * sealed epoxy does; fully matte reads as felt.
 *
 * Textured rather than flat: the maps carry aggregate, old spills and worn
 * traffic lanes, and crucially a varying roughness. A single roughness value
 * reflects the ceiling strips as one clean unbroken band, which reads as polished
 * stone; breaking it into patches is what makes it read as a slab that has had
 * cars on it. See createConcreteFloorMaps.
 */
export const GroundPlane = memo(function GroundPlane() {
  const maps = useMemo(() => createConcreteFloorMaps(GARAGE_FLOOR), [])

  useEffect(() => {
    return () => {
      maps.map.dispose()
      maps.normalMap.dispose()
      maps.roughnessMap.dispose()
    }
  }, [maps])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial
        map={maps.map}
        normalMap={maps.normalMap}
        // Shallow. Concrete aggregate is millimetres across; anything stronger
        // turns the slab into gravel under a raking light.
        normalScale={[0.35, 0.35]}
        roughnessMap={maps.roughnessMap}
        // Multiplied by the map, so this is a ceiling on gloss rather than the
        // value itself.
        roughness={1}
        metalness={0.12}
      />
    </mesh>
  )
})
