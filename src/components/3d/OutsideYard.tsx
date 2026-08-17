import { memo } from 'react'
import { DoubleSide } from 'three'
import { DOOR_OPENING_HALF_WIDTH, DOOR_TRACK_Y, DOOR_Z, YARD_DEPTH } from '@/scenes/garage'

const HALF_W = DOOR_OPENING_HALF_WIDTH
const HEIGHT = DOOR_TRACK_Y + 0.6
const NEAR_Z = DOOR_Z
const FAR_Z = DOOR_Z + YARD_DEPTH
const CENTER_Z = (NEAR_Z + FAR_Z) / 2

/**
 * Small enclosed yard just outside the sectional door — five plain white,
 * unlit faces sized to exactly match the drive clamp in DriveControls.tsx, so
 * the car can never end up somewhere no wall exists for.
 *
 * MeshBasicMaterial rather than a lit surface: this stands in for open
 * daylight, not a room, so it has to read the same regardless of the garage's
 * own lighting state (see the blackout driver in Garage.tsx/GarageDoor.tsx).
 */
export const OutsideYard = memo(function OutsideYard() {
  return (
    <group name="outsideYard">
      <mesh position={[0, 0.001, CENTER_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HALF_W * 2, YARD_DEPTH]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh position={[0, HEIGHT / 2, FAR_Z]}>
        <planeGeometry args={[HALF_W * 2, HEIGHT]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} side={DoubleSide} />
      </mesh>
      <mesh position={[-HALF_W, HEIGHT / 2, CENTER_Z]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[YARD_DEPTH, HEIGHT]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} side={DoubleSide} />
      </mesh>
      <mesh position={[HALF_W, HEIGHT / 2, CENTER_Z]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[YARD_DEPTH, HEIGHT]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} side={DoubleSide} />
      </mesh>
      <mesh position={[0, HEIGHT, CENTER_Z]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[HALF_W * 2, YARD_DEPTH]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} side={DoubleSide} />
      </mesh>
    </group>
  )
})
