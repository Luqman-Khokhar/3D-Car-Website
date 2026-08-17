import { useEffect, useRef, type ComponentRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { cameraState } from '@/animations/cameraPath'
import { ROOM_HALF_X, ROOM_HALF_Z } from '@/scenes/garage'

/** Keeps the near plane off the wall geometry rather than flush against it. */
const WALL_MARGIN = 0.7
const MIN_EYE_Y = 0.35
const MAX_EYE_Y = 3.6

/**
 * How far the look-at point may be dragged from the car. Bounded well inside the
 * room so panning cannot park the pivot in a wall and leave the orbit sweeping
 * through it.
 */
const TARGET_HALF_X = ROOM_HALF_X - 3.4
const TARGET_HALF_Z = ROOM_HALF_Z - 3.4
const TARGET_MIN_Y = 0.15
const TARGET_MAX_Y = 2.4

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
  useFrame(() => {
    const c = controls.current
    if (!c) return

    c.target.x = clamp(c.target.x, -TARGET_HALF_X, TARGET_HALF_X)
    c.target.y = clamp(c.target.y, TARGET_MIN_Y, TARGET_MAX_Y)
    c.target.z = clamp(c.target.z, -TARGET_HALF_Z, TARGET_HALF_Z)

    const p = camera.position
    p.x = clamp(p.x, -(ROOM_HALF_X - WALL_MARGIN), ROOM_HALF_X - WALL_MARGIN)
    p.y = clamp(p.y, MIN_EYE_Y, MAX_EYE_Y)
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
