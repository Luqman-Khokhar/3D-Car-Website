import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { EulerOrder, Object3D } from 'three'
import { driveState } from '@/animations/driveState'
import { getPart } from '@/animations/partRegistry'
import { WHEEL_RADIUS } from '@/scenes/carParts'
import type { PartId } from '@/scenes/carParts'

const FRONT: PartId[] = ['wheel_FL', 'wheel_FR']
const REAR: PartId[] = ['wheel_RL', 'wheel_RR']

/** Full lock at the rim, radians — about 27 degrees. Matches the tightest circle
 *  DriveControls will hold (MIN_TURN_RADIUS 4.5 m over a 2.64 m wheelbase) closely
 *  enough that the wheels are not obviously lying about where the car is going. */
const MAX_STEER = 0.48

/** Per-second fraction of the remaining steering gap closed — the same
 *  exponential form as the camera and door eases. Fast, but not instant: a rack
 *  that snaps to full lock in one frame reads as a bug rather than as steering. */
const STEER_SMOOTHING = 0.0002

const TWO_PI = Math.PI * 2

interface Saved {
  object: Object3D
  front: boolean
  x: number
  y: number
  order: EulerOrder
}

/**
 * Rolls the wheels and points the front pair while the car is being driven.
 *
 * Mounted only in free look, alongside DriveControls, for the same reason that
 * one is: the wheels' `rotation.x` is owned by the scrubbed assembly timeline
 * (see the isWheel branch in buildAssemblyTimeline), which rolls each wheel in
 * from the nose or tail as it is installed. Free look locks the page scroll
 * (useFreeLookLock), so the timeline is parked for as long as this is up and the
 * two never write the same value in one frame. Whatever pose the timeline left is
 * captured on mount and put back on unmount, so scrubbing back up the page after
 * a drive still shows the wheels where the scroll position says they should be.
 *
 * Front wheels get their rotation order swapped to YXZ. In the default XYZ the
 * roll about X is applied last, i.e. about the car's axis rather than the
 * steered axle, so a steered wheel visibly wobbles instead of spinning. YXZ puts
 * the steer outermost: camber, then roll about the axle, then swing the whole
 * thing on the kingpin — which is the order a real corner happens in.
 */
export function WheelMotion() {
  const saved = useRef<Saved[]>([])
  const steer = useRef(0)

  useEffect(() => {
    const entries: Saved[] = []
    for (const id of [...FRONT, ...REAR]) {
      const object = getPart(id)
      if (!object) continue
      const front = FRONT.includes(id)
      entries.push({
        object,
        front,
        x: object.rotation.x,
        y: object.rotation.y,
        order: object.rotation.order,
      })
      if (front) object.rotation.order = 'YXZ'
    }
    saved.current = entries
    steer.current = 0

    return () => {
      for (const entry of entries) {
        entry.object.rotation.x = entry.x
        entry.object.rotation.y = entry.y
        entry.object.rotation.order = entry.order
      }
      saved.current = []
    }
  }, [])

  useFrame((_, delta) => {
    const entries = saved.current
    if (entries.length === 0) return

    // Rolling without slipping, the same relation the assembly timeline uses:
    // travel over radius, and a wheel travelling +Z spins +X.
    const roll = (driveState.speed * delta) / WHEEL_RADIUS
    const target = driveState.steer * MAX_STEER
    steer.current += (target - steer.current) * (1 - Math.pow(STEER_SMOOTHING, delta))

    for (const entry of entries) {
      // Wrapped, so a long stint at 30 rad/s does not walk the angle out to five
      // figures and start losing precision in the fractional part.
      if (roll !== 0) entry.object.rotation.x = (entry.object.rotation.x + roll) % TWO_PI
      if (entry.front) entry.object.rotation.y = steer.current
    }
  })

  return null
}
