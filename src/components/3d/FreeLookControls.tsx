import { useEffect, useRef, type ComponentRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Vector3 } from 'three'
import { cameraState } from '@/animations/cameraPath'
import { isCarAway } from '@/animations/driveState'
import { ROOM_HALF_X, ROOM_HALF_Z } from '@/scenes/garage'
import { useSceneStore } from '@/store/useSceneStore'

/** Keeps the near plane off the wall geometry rather than flush against it. */
const WALL_MARGIN = 0.7
const MIN_EYE_Y = 0.35
const MAX_EYE_Y = 3.6
/** The robot's head is at ~3.2 m, so the car's eye ceiling puts the camera level
 *  with the chest at the closest orbit and there is no way to look down on it. */
const ROBOT_MAX_EYE_Y = 4.05

/**
 * How far the look-at point may be dragged from the car. Bounded well inside the
 * room so panning cannot park the pivot in a wall and leave the orbit sweeping
 * through it.
 */
const TARGET_HALF_X = ROOM_HALF_X - 3.4
const TARGET_HALF_Z = ROOM_HALF_Z - 3.4
const TARGET_MIN_Y = 0.15
const TARGET_MAX_Y = 2.4
/** Same reasoning as ROBOT_MAX_EYE_Y: the pivot has to be able to reach the head,
 *  or orbiting the robot always swings around its waist. */
const ROBOT_TARGET_MAX_Y = 3.4

/**
 * Where the orbit is moved to when the robot stands up. Framed on the chest at a
 * three-quarter angle and far enough out for a 3.5 m figure — the car's last
 * scripted pose is aimed at something a metre tall, so keeping it would leave the
 * robot's head out of frame and its feet filling the shot.
 */
const ROBOT_VIEW = {
  target: new Vector3(0, 1.75, 0),
  eye: new Vector3(4.1, 2.6, 5.8),
}

/** Per-second fraction of the remaining gap closed while easing onto ROBOT_VIEW —
 *  the same exponential form as CameraRig's return blend, so the move is
 *  framerate-independent. */
const FRAME_SMOOTHING = 0.0015
const FRAME_EPSILON = 0.02

const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v)

type Controls = ComponentRef<typeof OrbitControls>

/**
 * Cursor-driven orbit for free-look mode. Only mounted while `freeLook` is on;
 * CameraRig stands down for the same period, so exactly one thing writes the
 * camera at a time.
 *
 * OrbitControls recomputes its spherical coordinates from the live camera
 * position at the top of every update(), which is what lets the clamp below run
 * as a plain post-pass: pushing the camera back inside the room sticks instead
 * of being undone on the next frame. Damping means the drag decelerates into the
 * wall rather than stopping dead.
 */
export function FreeLookControls() {
  const controls = useRef<Controls>(null)
  const camera = useThree((s) => s.camera)
  const robotMode = useSceneStore((s) => s.robotMode)
  /** True while the view is still easing onto ROBOT_VIEW. Cleared once it
   *  arrives, so the user's own drags are never fought after that. */
  const reframing = useRef(false)

  // Standing the robot up reframes; folding it back leaves the camera where the
  // user left it, because by then they are looking at a car in the same spot.
  useEffect(() => {
    reframing.current = robotMode
  }, [robotMode])

  // Adopt the scripted pivot on entry so the mode starts framed on whatever the
  // scroll timeline was last looking at, not on the world origin.
  useEffect(() => {
    const c = controls.current
    if (!c) return
    c.target.set(cameraState.tx, cameraState.ty, cameraState.tz)
    c.update()
  }, [])

  // Priority 0 — drei drives controls.update() at -1, so this runs after it and
  // before the render.
  useFrame((_, delta) => {
    const c = controls.current
    if (!c) return

    // DriveCamera takes the wheel while the car is out near the door — see
    // isCarAway(). Disabling rather than unmounting keeps the orbit's target
    // and damping state intact for when control hands back.
    const away = isCarAway()
    c.enabled = !away
    if (away) return

    // Ahead of the clamps, so the eased pose is then subject to them like any
    // other. Both ROBOT_VIEW values sit inside the robot limits below.
    if (reframing.current) {
      const t = 1 - Math.pow(FRAME_SMOOTHING, delta)
      c.target.lerp(ROBOT_VIEW.target, t)
      camera.position.lerp(ROBOT_VIEW.eye, t)
      if (camera.position.distanceTo(ROBOT_VIEW.eye) < FRAME_EPSILON) reframing.current = false
    }

    const targetMaxY = robotMode ? ROBOT_TARGET_MAX_Y : TARGET_MAX_Y
    const eyeMaxY = robotMode ? ROBOT_MAX_EYE_Y : MAX_EYE_Y

    c.target.x = clamp(c.target.x, -TARGET_HALF_X, TARGET_HALF_X)
    c.target.y = clamp(c.target.y, TARGET_MIN_Y, targetMaxY)
    c.target.z = clamp(c.target.z, -TARGET_HALF_Z, TARGET_HALF_Z)

    const p = camera.position
    p.x = clamp(p.x, -(ROOM_HALF_X - WALL_MARGIN), ROOM_HALF_X - WALL_MARGIN)
    p.y = clamp(p.y, MIN_EYE_Y, eyeMaxY)
    p.z = clamp(p.z, -(ROOM_HALF_Z - WALL_MARGIN), ROOM_HALF_Z - WALL_MARGIN)
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.075}
      rotateSpeed={0.55}
      zoomSpeed={0.7}
      panSpeed={0.7}
      // 1.6 m keeps the near plane out of the bodywork; 11 m is the longest
      // sightline the room affords once the wall margin is applied.
      minDistance={1.6}
      maxDistance={11}
      // Stop just short of both poles — true 0/pi is a degenerate look-at with
      // no meaningful up vector. Eye-height clamp above (MIN_EYE_Y/MAX_EYE_Y)
      // is what actually stops the camera going through floor or ceiling, so
      // this can sit close to the poles without fighting that clamp.
      minPolarAngle={0.03}
      maxPolarAngle={Math.PI - 0.03}
      // Pan along the floor rather than the screen plane, so dragging walks
      // through the garage instead of sliding the whole scene.
      screenSpacePanning={false}
    />
  )
}
