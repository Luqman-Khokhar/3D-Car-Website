import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { driveState, returnCarHome } from '@/animations/driveState'
import { garageDoorState } from '@/animations/garageDoorState'
import { DOOR_OPENING_HALF_WIDTH, DOOR_Z, ROOM_HALF_X, ROOM_HALF_Z, YARD_DEPTH } from '@/scenes/garage'

/** Metres/second and radians/second at full lock — tuned for the 4.4 m car. */
const SPEED = 3.2
const TURN_RATE = 1.6
/** Door progress needed before the opening counts as clear — short of 1 so the
 *  car can nose out as soon as the leaf is out of the way, not only once it is
 *  fully stowed against the ceiling. */
const DOOR_CLEAR_PROGRESS = 0.85

/** Half the car's footprint, from CAR_PARTS' 4.42 m x 2.11 m envelope. Used only
 *  for clamping the drive area, not for real collision. */
const CAR_HALF_WIDTH = 1.05
const CAR_HALF_LENGTH = 2.25
const WALL_T = 0.24

const ROOM_X_LIMIT = ROOM_HALF_X - WALL_T / 2 - CAR_HALF_WIDTH
const ROOM_Z_BACK_LIMIT = -ROOM_HALF_Z + WALL_T / 2 + CAR_HALF_LENGTH
const DOOR_X_LIMIT = DOOR_OPENING_HALF_WIDTH - CAR_HALF_WIDTH
/** Trigger line for the doorway channel: the car's nose reaching the door
 *  plane. Past this the car must fit through the opening (or be in the yard). */
const DOORWAY_Z = DOOR_Z - CAR_HALF_LENGTH
const YARD_Z_LIMIT = DOOR_Z + YARD_DEPTH - CAR_HALF_LENGTH

const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v)

const DRIVE_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'w',
  'W',
  'a',
  'A',
  's',
  'S',
  'd',
  'D',
])

/**
 * Arrow-key / WASD driving, mounted only while free look is on — the same
 * reachability rule as DoorButton, since free look is already the mode that
 * hands pointer and keyboard control to the user.
 *
 * The car can never pass the front wall unless the sectional door is open and
 * it is lined up with the opening: the clamp in useFrame below enforces that
 * every frame, regardless of which keys are held.
 */
export function DriveControls() {
  const held = useRef<Set<string>>(new Set())

  useEffect(() => {
    const keys = held.current
    const onKeyDown = (e: KeyboardEvent) => {
      if (!DRIVE_KEYS.has(e.key)) return
      keys.add(e.key)
      e.preventDefault()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.key)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      keys.clear()
      // Free look just ended (this only unmounts alongside it) — send the car
      // back to the garage origin so the scripted camera isn't left framing
      // an empty room.
      returnCarHome()
    }
  }, [])

  useFrame((_, delta) => {
    if (driveState.returning) return
    const keys = held.current
    const forward =
      (keys.has('ArrowUp') || keys.has('w') || keys.has('W') ? 1 : 0) -
      (keys.has('ArrowDown') || keys.has('s') || keys.has('S') ? 1 : 0)
    const turn =
      (keys.has('ArrowLeft') || keys.has('a') || keys.has('A') ? 1 : 0) -
      (keys.has('ArrowRight') || keys.has('d') || keys.has('D') ? 1 : 0)
    if (forward === 0 && turn === 0) return

    // Steering only bites while rolling, same as a real car.
    if (forward !== 0) driveState.yaw += turn * TURN_RATE * delta * Math.sign(forward)
    driveState.x += Math.sin(driveState.yaw) * forward * SPEED * delta
    driveState.z += Math.cos(driveState.yaw) * forward * SPEED * delta

    const doorClear = garageDoorState.progress >= DOOR_CLEAR_PROGRESS
    if (driveState.z > DOORWAY_Z) {
      // In the doorway channel or the yard beyond it — width is the opening's,
      // the whole way through.
      driveState.x = clamp(driveState.x, -DOOR_X_LIMIT, DOOR_X_LIMIT)
      driveState.z = doorClear ? Math.min(driveState.z, YARD_Z_LIMIT) : DOORWAY_Z
    } else {
      driveState.x = clamp(driveState.x, -ROOM_X_LIMIT, ROOM_X_LIMIT)
    }
    driveState.z = Math.max(driveState.z, ROOM_Z_BACK_LIMIT)
  })

  return null
}
