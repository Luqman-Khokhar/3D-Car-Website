import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { driveState, isCarAway } from '@/animations/driveState'

/** Per-second fraction of the remaining gap closed — same exponential form as
 *  CameraRig's RETURN_SMOOTHING, tuned faster since this is chasing a moving
 *  target rather than resolving a one-off hand-off. */
const CHASE_SMOOTHING = 0.02
const HEIGHT = 2.0
const BACK_DISTANCE = 5.2
const LOOK_AHEAD = 3.5
const LOOK_HEIGHT = 0.9

const desiredPos = new Vector3()
const desiredLook = new Vector3()
const forward = new Vector3()

/**
 * Third-person chase camera for the drive-out mini-game: positions itself
 * behind and above the car, looking a little ahead of it, so the driver feels
 * like they are leaving the garage with the car rather than watching it
 * leave from a fixed orbit.
 *
 * Always mounted alongside FreeLookControls in free look, but only writes the
 * camera while `isCarAway()` — otherwise OrbitControls owns it. Both read the
 * same predicate so there is never a frame where two systems write the
 * camera at once (FreeLookControls disables its own controls the instant this
 * takes over — see the `away` check there).
 */
export function DriveCamera() {
  const camera = useThree((s) => s.camera)
  const lookAt = useRef(new Vector3())
  const seeded = useRef(false)

  useFrame((_, delta) => {
    if (!isCarAway()) {
      seeded.current = false
      return
    }

    const { x, z, yaw } = driveState
    const sinY = Math.sin(yaw)
    const cosY = Math.cos(yaw)
    desiredPos.set(x - sinY * BACK_DISTANCE, HEIGHT, z - cosY * BACK_DISTANCE)
    desiredLook.set(x + sinY * LOOK_AHEAD, LOOK_HEIGHT, z + cosY * LOOK_AHEAD)

    // First frame of the hand-off: adopt the point the outgoing controller
    // was looking at, so the swing to the chase framing eases in rather than
    // cutting — same trick CameraRig uses coming out of free look.
    if (!seeded.current) {
      camera.getWorldDirection(forward)
      lookAt.current.copy(camera.position).addScaledVector(forward, camera.position.distanceTo(desiredLook))
      seeded.current = true
    }

    const t = 1 - Math.pow(CHASE_SMOOTHING, delta)
    camera.position.lerp(desiredPos, t)
    lookAt.current.lerp(desiredLook, t)
    camera.lookAt(lookAt.current)
  })

  return null
}
