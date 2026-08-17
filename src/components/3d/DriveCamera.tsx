import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import { driveState, isCarAway } from '@/animations/driveState'

/** Per-second fraction of the remaining gap closed — same exponential form as
 *  CameraRig's RETURN_SMOOTHING, tuned faster since this is chasing a moving
 *  target rather than resolving a one-off hand-off. */
const CHASE_SMOOTHING = 0.02
const HEIGHT = 3.2
const BACK_DISTANCE = 7.4
const LOOK_AHEAD = 7
const LOOK_HEIGHT = 1.2
/** Extra metres of chase distance and look-ahead per m/s of speed. The camera
 *  drops back and looks further up the road as the car winds on, which is what
 *  makes a fast lap readable — a fixed rig at 10 m/s shows the roof and no
 *  corner. Tuned against MAX_SPEED in DriveControls (10 m/s). */
const SPEED_PULLBACK = 0.16
const SPEED_LOOK_AHEAD = 0.35

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

    const { x, z, yaw, speed } = driveState
    const sinY = Math.sin(yaw)
    const cosY = Math.cos(yaw)
    // Only forward speed opens the rig up; reversing should not swing the camera
    // round in front of the car.
    const pace = Math.max(speed, 0)
    const back = BACK_DISTANCE + pace * SPEED_PULLBACK
    const ahead = LOOK_AHEAD + pace * SPEED_LOOK_AHEAD
    desiredPos.set(x - sinY * back, HEIGHT, z - cosY * back)
    desiredLook.set(x + sinY * ahead, LOOK_HEIGHT, z + cosY * ahead)

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
