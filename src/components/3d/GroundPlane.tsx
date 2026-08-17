import { memo, useEffect, useMemo } from 'react'
import { GARAGE_FLOOR } from '@/scenes/palette'
import { ROOM_HALF_X, ROOM_HALF_Z } from '@/scenes/garage'
import { createConcreteFloorMaps } from '@/lib/surfaceTextures'

/**
 * The slab covers the room and stops there, running 0.2 m past the outer face of
 * the side and back walls so no sliver of the world beneath shows at the join,
 * and ending flush with the front wall line on the door side — the white apron
 * outside picks up from there (see src/scenes/track.ts).
 *
 * It used to be a flat 60 x 60 m, from when nothing outside the garage was ever
 * visible. With the circuit out front it is: a 60 m slab of dark concrete spread
 * 20 m either side of the building, which read as the garage sitting on a black
 * pad in the middle of a white field.
 */
const OVERHANG = 0.44
const WIDTH = (ROOM_HALF_X + OVERHANG) * 2
const DEPTH = ROOM_HALF_Z + OVERHANG + ROOM_HALF_Z
const CENTER_Z = (ROOM_HALF_Z - (ROOM_HALF_Z + OVERHANG)) / 2

/** Metres per texture tile — what the old 60 m plane got out of repeat 9. Kept
 *  constant so shrinking the slab does not shrink the aggregate with it. */
const TILE = 6.7

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
  const maps = useMemo(() => {
    const built = createConcreteFloorMaps(GARAGE_FLOOR)
    for (const texture of [built.map, built.normalMap, built.roughnessMap]) {
      texture.repeat.set(WIDTH / TILE, DEPTH / TILE)
    }
    return built
  }, [])

  useEffect(() => {
    return () => {
      maps.map.dispose()
      maps.normalMap.dispose()
      maps.roughnessMap.dispose()
    }
  }, [maps])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, CENTER_Z]} receiveShadow>
      <planeGeometry args={[WIDTH, DEPTH]} />
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
