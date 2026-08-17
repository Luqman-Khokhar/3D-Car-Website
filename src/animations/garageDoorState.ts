/**
 * Live state for the sectional door, mirroring the `lightingState` /
 * `paintState` pattern: a plain mutable object the button click writes to and
 * GarageDoor.tsx eases toward inside useFrame, so opening the door never
 * triggers a React render.
 */
export interface GarageDoorState {
  /** Target the chain eases toward: false = fully down, true = fully open. */
  open: boolean
  /** Eased arc-length fraction actually applied to the panels, 0..1. */
  progress: number
}

export const garageDoorState: GarageDoorState = {
  open: false,
  progress: 0,
}

export function toggleGarageDoor() {
  garageDoorState.open = !garageDoorState.open
}
