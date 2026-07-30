import { gsap } from '@/lib/gsap'
import { CAR_PARTS } from '@/scenes/carParts'
import type { CarPart, Vec3 } from '@/scenes/carParts'
import { getPart } from './partRegistry'
import { CAMERA_KEYS, cameraState, sceneTime } from './cameraPath'
import { paintState } from './paintState'
import { SECTIONS } from '@/store/useSceneStore'

/** One timeline second per scene, so scene i is fully reached at t = i. */
const SCENE_DURATION = 1

/** Fraction of a scene each successive part is delayed by, for a staggered fly-in. */
const STAGGER = 0.1

function explodedPosition(part: CarPart): Vec3 {
  return [
    part.position[0] + part.explodedOffset[0],
    part.position[1] + part.explodedOffset[1],
    part.position[2] + part.explodedOffset[2],
  ]
}

function assembledRotation(part: CarPart): Vec3 {
  return part.rotation ?? [0, 0, 0]
}

function explodedRotation(part: CarPart): Vec3 {
  return part.explodedRotation ?? assembledRotation(part)
}

/**
 * Builds the single scrubbed master timeline for the whole page.
 *
 * Layout: scene i owns [i - 1, i], so a part installed in scene i animates as
 * the camera arrives there. Total duration is SECTIONS.length - 1 (8), which the
 * ScrollTrigger maps onto the full document scroll.
 *
 * Everything here is a `fromTo` with `ease: 'none'`. Scrubbed timelines must be
 * position-deterministic: any given scroll offset has to produce exactly one
 * pose, forward or backward. Eased or relative tweens make reverse scrubbing
 * drift out of sync with the copy.
 */
export function buildAssemblyTimeline() {
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } })

  // --- Camera ------------------------------------------------------------
  // Reset to the hero key so a rebuild (hot reload) does not inherit a stale pose.
  tl.set(cameraState, { ...CAMERA_KEYS.hero }, 0)

  for (let i = 1; i < SECTIONS.length; i++) {
    tl.to(
      cameraState,
      { ...CAMERA_KEYS[SECTIONS[i]], duration: SCENE_DURATION },
      i - SCENE_DURATION,
    )
  }

  // --- Paint -------------------------------------------------------------
  // Panels are installed during the body-panels scene and arrive in primer, so
  // the base coat lands in the scene immediately after. usePaintPass reads this
  // in the frame loop and repaints every panel off the one shared material.
  tl.set(paintState, { progress: 0 }, 0)
  tl.to(
    paintState,
    { progress: 1, duration: SCENE_DURATION },
    sceneTime('paint') - SCENE_DURATION,
  )

  // --- Parts -------------------------------------------------------------
  // Group by stage so the stagger index restarts per scene.
  const byStage = new Map<string, CarPart[]>()
  for (const part of CAR_PARTS) {
    const list = byStage.get(part.stage) ?? []
    list.push(part)
    byStage.set(part.stage, list)
  }

  for (const [stage, parts] of byStage) {
    const arrive = sceneTime(stage as (typeof SECTIONS)[number])
    const start = arrive - SCENE_DURATION

    parts.forEach((part, index) => {
      const object = getPart(part.id)
      if (!object) return

      const at = start + index * STAGGER
      // Compress so the last staggered part still lands by the time the camera
      // finishes arriving, instead of spilling into the next scene.
      const duration = Math.max(SCENE_DURATION - index * STAGGER, 0.3)

      const from = explodedPosition(part)
      const to = part.position
      const rotFrom = explodedRotation(part)
      const rotTo = assembledRotation(part)

      // Hidden until its scene begins. A zero-duration set reverses correctly
      // under scrub, so scrolling back up un-installs the part.
      tl.set(object, { visible: false }, 0)
      tl.set(object, { visible: true }, at)

      const isWheel = part.id.startsWith('wheel_')
      if (isWheel) {
        // Two phases: roll the length of the car outboard of the bodywork, then
        // tuck into the arch. Overlapped so the tuck starts before the roll ends.
        tl.fromTo(
          object.position,
          { x: from[0], y: from[1], z: from[2] },
          { z: to[2], duration: duration * 0.78 },
          at,
        )
        tl.fromTo(
          object.position,
          { x: from[0] },
          { x: to[0], duration: duration * 0.34 },
          at + duration * 0.66,
        )
        tl.fromTo(
          object.rotation,
          { x: rotFrom[0] },
          { x: rotTo[0], duration: duration * 0.78 },
          at,
        )
      } else {
        tl.fromTo(
          object.position,
          { x: from[0], y: from[1], z: from[2] },
          { x: to[0], y: to[1], z: to[2], duration },
          at,
        )
        tl.fromTo(
          object.rotation,
          { x: rotFrom[0], y: rotFrom[1], z: rotFrom[2] },
          { x: rotTo[0], y: rotTo[1], z: rotTo[2], duration },
          at,
        )
      }
    })
  }

  // Pin the total length even if the final scene animates nothing.
  tl.to({}, { duration: 0 }, SECTIONS.length - 1)

  return tl
}
