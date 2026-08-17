import { memo } from 'react'
import { OUTSIDE_EXTENT } from '@/scenes/garage'
import { OUTSIDE_GROUND } from '@/scenes/palette'
import { RaceTrack } from './RaceTrack'

/** 2 cm under the garage slab. It runs right under the building rather than
 *  starting at the door, so the ground either side of the garage is open country
 *  too — a plane that started at the door left the world missing where the car
 *  can see it from out on the circuit. Below rather than above so the slab still
 *  owns the room's floor; the offset is small enough that the doorway threshold
 *  reads as one surface. */
const GROUND_Y = -0.02

/**
 * Open ground around the garage, and the circuit laid on it — the arrow-key
 * drive-out area.
 *
 * Deliberately just a floor and the track: no walls, hills or scenery, because
 * the "world" reads as endless through the fog/background haze SceneCanvas's
 * NightPass drives off the car's own position, not through an enclosure. The
 * plane only has to reach past OUTSIDE_FOG_FAR — see OUTSIDE_EXTENT — so its
 * edge is never actually visible.
 *
 * Light grey rather than the white it used to be: the track itself is white, and
 * white tarmac on white ground is a track you cannot see. See OUTSIDE_GROUND.
 *
 * Unlit MeshBasicMaterial rather than a lit surface: this stands in for open
 * daylight, not a room, so it has to read the same regardless of the garage's
 * own lighting state (see the blackout driver in Garage.tsx/GarageDoor.tsx).
 */
export const OutsideWorld = memo(function OutsideWorld() {
  return (
    <>
      <mesh position={[0, GROUND_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[OUTSIDE_EXTENT, OUTSIDE_EXTENT]} />
        <meshBasicMaterial color={OUTSIDE_GROUND} toneMapped={false} />
      </mesh>
      <RaceTrack />
    </>
  )
})
