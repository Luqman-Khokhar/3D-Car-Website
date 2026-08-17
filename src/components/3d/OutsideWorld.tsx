import { memo } from 'react'
import { DOOR_Z, OUTSIDE_DEPTH, OUTSIDE_HALF_WIDTH } from '@/scenes/garage'

const CENTER_Z = DOOR_Z + OUTSIDE_DEPTH / 2

/**
 * Open white ground beyond the sectional door — the arrow-key drive-out area.
 * Deliberately just a floor and nothing else: no walls or ceiling, because the
 * "world" reads as endless through the fog/background whiteout SceneCanvas's
 * NightPass drives off the car's own position, not through an enclosure. The
 * plane only has to reach past FOG_FAR — see OUTSIDE_DEPTH — so its edge is
 * never actually visible.
 *
 * Unlit MeshBasicMaterial rather than a lit surface: this stands in for open
 * daylight, not a room, so it has to read the same regardless of the garage's
 * own lighting state (see the blackout driver in Garage.tsx/GarageDoor.tsx).
 */
export const OutsideWorld = memo(function OutsideWorld() {
  return (
    <mesh position={[0, 0.001, CENTER_Z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[OUTSIDE_HALF_WIDTH * 2, OUTSIDE_DEPTH]} />
      <meshBasicMaterial color="#ffffff" toneMapped={false} />
    </mesh>
  )
})
