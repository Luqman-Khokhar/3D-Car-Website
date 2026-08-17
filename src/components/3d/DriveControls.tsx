import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { driveState, returnCarHome } from '@/animations/driveState'
import { garageDoorState } from '@/animations/garageDoorState'
import {
  DOOR_OPENING_HALF_WIDTH,
  DOOR_Z,
  OUTSIDE_DEPTH,
  OUTSIDE_HALF_WIDTH,
  ROOM_HALF_X,
  ROOM_HALF_Z,
} from '@/scenes/garage'

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
/** How far past the door plane the car has to clear before the wall pinch
 *  opens out into the wide world — roughly the wall's own thickness plus a
 *  margin, so the widening happens once the car is actually through it. */
const WALL_CLEAR = 1.0

const ROOM_X_LIMIT = ROOM_HALF_X - WALL_T / 2 - CAR_HALF_WIDTH
const ROOM_Z_BACK_LIMIT = -ROOM_HALF_Z + WALL_T / 2 + CAR_HALF_LENGTH
const DOOR_X_LIMIT = DOOR_OPENING_HALF_WIDTH - CAR_HALF_WIDTH
const OUTSIDE_X_LIMIT = OUTSIDE_HALF_WIDTH - CAR_HALF_WIDTH
const OUTSIDE_Z_LIMIT = DOOR_Z + OUTSIDE_DEPTH - CAR_HALF_LENGTH
/** Trigger line for the doorway channel: the car's nose reaching the door
 *  plane. Past this it has to fit through the opening. */
const DOORWAY_Z = DOOR_Z - CAR_HALF_LENGTH

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
 * Three concentric zones, widest to narrowest to widest again: the garage
 * interior, the wall pinch at the doorway (only passable, and only as wide as
 * the opening, once the door is clear), and the open world beyond it.
 *
 * Used to reject a proposed step rather than clamp it — clamping x directly
 * at the zone boundary would snap the car sideways the instant it crossed
 * back from the wide outside zone into the narrow doorway one.
 */
function inBounds(x: number, z: number, doorClear: boolean): boolean {
  if (z <= DOORWAY_Z) return Math.abs(x) <= ROOM_X_LIMIT && z >= ROOM_Z_BACK_LIMIT
  if (z <= DOOR_Z + WALL_CLEAR) return doorClear && Math.abs(x) <= DOOR_X_LIMIT
  return Math.abs(x) <= OUTSIDE_X_LIMIT && z <= OUTSIDE_Z_LIMIT
}

/**
 * Arrow-key / WASD driving, mounted only while free look is on — the same
 * reachability rule as DoorButton, since free look is already the mode that
 * hands pointer and keyboard control to the user.
 *
 * The car can never pass the front wall unless the sectional door is open and
 * it is lined up with the opening: `inBounds` enforces that every frame,
 * regardless of which keys are held. A step that would leave bounds is
 * resolved axis-by-axis instead of just being dropped, so the car slides
 * along whatever it bumped into rather than stopping dead the moment either
 * component alone would be invalid.
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

    const dx = Math.sin(driveState.yaw) * forward * SPEED * delta
    const dz = Math.cos(driveState.yaw) * forward * SPEED * delta
    const doorClear = garageDoorState.progress >= DOOR_CLEAR_PROGRESS

    const nx = driveState.x + dx
    const nz = driveState.z + dz
    if (inBounds(nx, nz, doorClear)) {
      driveState.x = nx
      driveState.z = nz
    } else if (inBounds(nx, driveState.z, doorClear)) {
      driveState.x = nx
    } else if (inBounds(driveState.x, nz, doorClear)) {
      driveState.z = nz
    }
  })

  return null
}
