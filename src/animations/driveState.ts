import { DOOR_Z } from '@/scenes/garage'

/**
 * Live state for arrow-key driving through the open garage door, mirroring the
 * garageDoorState / cameraState pattern: DriveControls mutates this plain
 * object while free look is on, and ProceduralCar reads it every frame to
 * place the car's outer group — no React render on either side.
 */
export interface DriveState {
  x: number
  z: number
  /** Heading, radians. 0 faces +Z — the car's nose, per CAR_PARTS' contract. */
  yaw: number
  /** Set on exiting free look; ProceduralCar eases the car back to the garage
   *  origin instead of leaving it stranded outside for the scripted camera. */
  returning: boolean
}

export const driveState: DriveState = { x: 0, z: 0, yaw: 0, returning: false }

export function returnCarHome() {
  driveState.returning = true
}

/** z past which DriveCamera takes over from free-look orbit — a few metres
 *  before the doorway, so the hand-off happens as the car approaches rather
 *  than snapping the instant it crosses the wall. Symmetric with the return:
 *  once the car is driven back deeper than this, FreeLookControls resumes. */
const CHASE_ENGAGE_Z = DOOR_Z - 3

/** Whether the car is close enough to (or through) the door that the drive
 *  chase camera should own the view instead of orbit. Read by both
 *  FreeLookControls (to stand down) and DriveCamera (to take over). */
export function isCarAway(): boolean {
  return driveState.z > CHASE_ENGAGE_Z
}
