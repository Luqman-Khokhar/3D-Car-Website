import { memo } from 'react'
import { GARAGE_FLOOR } from '@/scenes/palette'

/**
 * Garage floor. Catches the spotlight shadow — without a receiver the car reads
 * as floating. Slightly glossy so the overhead lamp leaves a soft sheen, the way
 * sealed epoxy does; fully matte reads as felt.
 */
export const GroundPlane = memo(function GroundPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial color={GARAGE_FLOOR} metalness={0.18} roughness={0.62} />
    </mesh>
  )
})
