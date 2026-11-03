/**
 * Drive input from the on-screen pad (TouchDrivePad), merged with the keyboard
 * in DriveControls. Same plain-object pattern as driveState: the pad writes it
 * from pointer handlers, the frame loop reads it, React never re-renders.
 *
 * Both axes are -1..1 with the keyboard's signs: throttle +1 is forward, turn +1
 * is left.
 */
export const touchDrive = { throttle: 0, turn: 0 }

export function resetTouchDrive() {
  touchDrive.throttle = 0
  touchDrive.turn = 0
}
