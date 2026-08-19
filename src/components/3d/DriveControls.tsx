import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { driveState, returnCarHome } from '@/animations/driveState'
import { garageDoorState } from '@/animations/garageDoorState'
import { DOOR_OPENING_HALF_WIDTH, DOOR_Z, ROOM_HALF_X, ROOM_HALF_Z } from '@/scenes/garage'
import { DRIVE_HALF_X, DRIVE_MAX_Z } from '@/scenes/track'
import { trackObstacles } from '@/scenes/trackProps'

/**
 * Throttle model rather than the old constant 3.2 m/s: a lap of the circuit is
 * ~200 m, which at a fixed walking pace is a minute of holding a key down. Speed
 * now builds and carries, so the lobes are taken fast and the pinches have to be
 * braked for.
 *
 * All metres and seconds, tuned for the 4.4 m car.
 */
const MAX_SPEED = 10
const MAX_REVERSE = 4
const ACCEL = 7
/** Braking is deliberately stronger than acceleration — a car that cannot slow
 *  faster than it speeds up feels like a boat at the pinch. */
const BRAKE = 13
/** Coasting decay, as the fraction of speed shed per second with no key held. */
const COAST = 1.8
/** Ceiling on yaw rate, so low-speed manoeuvring in the garage stays controllable. */
const TURN_RATE = 1.7
/** Tightest circle the car will hold. Real steering geometry in one constant:
 *  yaw rate is speed / radius, so the car understeers at speed instead of
 *  pivoting on the spot at 10 m/s. Must stay under the circuit's ~9 m curvature
 *  at the pinch or that corner is not takeable. */
const MIN_TURN_RADIUS = 4.5

/** Longest integration slice. At MAX_SPEED this is a 25 cm step, an order of
 *  magnitude shorter than the ~3 m doorway channel `inBounds` tests for, so no
 *  step can straddle the front wall's zone entirely. */
const SUBSTEP = 0.025
/** Most simulated time a single frame may make up. */
const MAX_FRAME = 0.25

const TWO_PI = Math.PI * 2
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
/** The outside fence follows the circuit's own footprint plus its run-off, not
 *  the ground plane — the plane is huge so its edge is never in shot, and driving
 *  out to it would strand the car in empty fog. */
const OUTSIDE_X_LIMIT = DRIVE_HALF_X - CAR_HALF_WIDTH
const OUTSIDE_Z_LIMIT = DRIVE_MAX_Z - CAR_HALF_LENGTH
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
  if (Math.abs(x) > OUTSIDE_X_LIMIT || z > OUTSIDE_Z_LIMIT) return false
  return !hitsProp(x, z)
}

/** Half the car, treated as one circle. Between its half width (1.05) and half
 *  length (2.25), because a car that stops a full 2.25 m short of a hoarding it
 *  is driving straight at reads as an invisible wall. */
const CAR_RADIUS = 1.25

/**
 * Circle test against the track furniture. Linear scan — there are on the order
 * of a hundred circles and this runs once per SUBSTEP, so ~4k distance tests in
 * the worst frame, which is nothing next to a single draw call. A grid would be
 * faster and would also have to be kept in step with the props.
 *
 * Cones are deliberately absent from the list; see trackProps.ts.
 */
function hitsProp(x: number, z: number): boolean {
  for (const prop of trackObstacles()) {
    const dx = x - prop.x
    const dz = z - prop.z
    const reach = prop.r + CAR_RADIUS
    if (dx * dx + dz * dz < reach * reach) return true
  }
  return false
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

  /** One integration step of at most SUBSTEP seconds. */
  const advance = (dt: number, throttle: number, turn: number) => {
    let speed = driveState.speed
    if (throttle > 0) {
      // Down is a brake first and reverse second, so the same key stops the car
      // before it backs up — pressing it at 10 m/s should not shove the car
      // straight into reverse.
      speed += (speed < 0 ? BRAKE : ACCEL) * dt
    } else if (throttle < 0) {
      speed -= (speed > 0 ? BRAKE : ACCEL) * dt
    } else {
      speed -= speed * Math.min(COAST * dt, 1)
      if (Math.abs(speed) < 0.05) speed = 0
    }
    driveState.speed = Math.min(Math.max(speed, -MAX_REVERSE), MAX_SPEED)

    if (driveState.speed === 0) return

    // Steering only bites while rolling, same as a real car, and the circle it
    // can hold is bounded by MIN_TURN_RADIUS rather than by yaw rate alone.
    if (turn !== 0) {
      const rate = Math.min(Math.abs(driveState.speed) / MIN_TURN_RADIUS, TURN_RATE)
      driveState.yaw += turn * rate * dt * Math.sign(driveState.speed)
      // Wrapped, or a long stint of holding one direction walks yaw out to tens
      // of radians and the ease back to 0 on exit spins the car several times.
      if (driveState.yaw > Math.PI) driveState.yaw -= TWO_PI
      else if (driveState.yaw < -Math.PI) driveState.yaw += TWO_PI
    }

    const step = driveState.speed * dt
    const dx = Math.sin(driveState.yaw) * step
    const dz = Math.cos(driveState.yaw) * step
    const doorClear = garageDoorState.progress >= DOOR_CLEAR_PROGRESS

    const nx = driveState.x + dx
    const nz = driveState.z + dz
    if (inBounds(nx, nz, doorClear)) {
      driveState.x = nx
      driveState.z = nz
    } else if (inBounds(nx, driveState.z, doorClear)) {
      driveState.x = nx
      // Scrubbing off speed on a graze, rather than only on a dead stop, keeps
      // the car from sliding the full length of a wall at 10 m/s.
      driveState.speed *= 0.6
    } else if (inBounds(driveState.x, nz, doorClear)) {
      driveState.z = nz
      driveState.speed *= 0.6
    } else {
      driveState.speed = 0
    }
  }

  useFrame((_, delta) => {
    if (driveState.returning) return
    const keys = held.current
    const throttle =
      (keys.has('ArrowUp') || keys.has('w') || keys.has('W') ? 1 : 0) -
      (keys.has('ArrowDown') || keys.has('s') || keys.has('S') ? 1 : 0)
    const turn =
      (keys.has('ArrowLeft') || keys.has('a') || keys.has('A') ? 1 : 0) -
      (keys.has('ArrowRight') || keys.has('d') || keys.has('D') ? 1 : 0)
    // Published even on an early return below, so the front wheels centre
    // themselves the moment the key is released rather than staying cranked over
    // for as long as the car happens to be stationary. Left is +1 here and yaw
    // grows counter-clockwise, which is the same sign the wheels want.
    driveState.steer = turn

    if (throttle === 0 && turn === 0 && driveState.speed === 0) return

    // Integrated in SUBSTEP slices, because `inBounds` only tests the endpoint of
    // a step: one long frame at 10 m/s is a step several metres long, and a step
    // longer than the wall is thick lands past it and reads as in bounds. That is
    // not hypothetical — a backgrounded tab or a first frame on a slow GPU hands
    // useFrame multi-second deltas, and the car drove clean through the closed
    // front wall onto the circuit. MAX_FRAME then caps how much of such a stall
    // is made up at all; the rest is dropped, so a hitch costs distance rather
    // than launching the car across the map.
    let remaining = Math.min(delta, MAX_FRAME)
    while (remaining > 0) {
      const dt = Math.min(remaining, SUBSTEP)
      advance(dt, throttle, turn)
      remaining -= dt
    }
  })

  return null
}
