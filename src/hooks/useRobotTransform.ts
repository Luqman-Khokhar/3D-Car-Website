import { useEffect, useRef } from 'react'
import { gsap } from '@/lib/gsap'
import { getAssemblyHandle } from '@/animations/assemblyHandle'
import { addRobotFold } from '@/animations/buildRobotFold'
import { useSceneStore } from '@/store/useSceneStore'

/** How long the car takes to finish assembling itself if the transform is asked
 *  for part-way down the page. Long enough to read as the build completing, short
 *  enough that it does not feel like a loading bar. */
const CATCH_UP = 0.8
/** Progress above which the car counts as already built and no catch-up runs. */
const ASSEMBLED = 0.999

/**
 * Runs the car/robot fold in response to `robotMode`.
 *
 * One master timeline for the whole thing, kept in a ref and *reversed* to change
 * back rather than rebuilt in the opposite direction. That is what makes the
 * change-back exact: GSAP recorded the live car pose as each tween's start value,
 * so reversing lands on it to the last decimal — including the scroll progress the
 * catch-up tween moved, and including the `visible: false` the limbs started from.
 *
 * Ordering the preconditions matters, so they are spelled out rather than left to
 * the reader:
 *
 *   1. The assembly ScrollTrigger is disabled first. It writes the same
 *      `position`/`rotation` objects the fold does, and its `scrub: 0.6` smoothing
 *      tween can still be in flight from the last wheel event.
 *   2. Then the assembly is seeked to its end, because a robot assembled out of a
 *      chassis and two wheels is a pile of parts.
 *   3. Only then does the fold play. It is built up-front all the same — GSAP
 *      records a `to` tween's start value when the tween first runs, not when it is
 *      created, so the panels' start values are read after the catch-up has landed.
 *
 * `trigger.disable(false)` passes revert = false on purpose: the default reverts
 * the trigger's own start state, which here would mean putting every part back
 * where scroll says it should be, in the same frame the fold is trying to leave.
 */
export function useRobotTransform() {
  const robotMode = useSceneStore((s) => s.robotMode)
  const modelReady = useSceneStore((s) => s.modelReady)
  const prefersReducedMotion = useSceneStore((s) => s.prefersReducedMotion)
  const master = useRef<gsap.core.Timeline | null>(null)

  useEffect(() => {
    if (!modelReady || !robotMode) return

    const { timeline, trigger } = getAssemblyHandle()
    const store = useSceneStore.getState()

    store.setTransforming(true)
    trigger?.disable(false)

    const tl = gsap.timeline({
      onComplete: () => useSceneStore.getState().setTransforming(false),
    })

    // Tweening a timeline's own `progress` — GSAP treats a method that exists on
    // the target as its own getter/setter, which is why this reads and writes the
    // scrub position rather than assigning a dead property. The fold is then laid
    // down after it, so the panels' recorded start values are the assembled pose.
    let foldAt = 0
    if (timeline && timeline.progress() < ASSEMBLED) {
      tl.to(timeline, { progress: 1, duration: CATCH_UP, ease: 'power2.inOut' }, 0)
      foldAt = CATCH_UP
    }
    addRobotFold(tl, foldAt)

    // Reduced motion gets the end state, not the fold — the same call
    // useAssemblyTimeline makes for the scroll story. Seeking rather than skipping
    // keeps one code path: the reverse below still walks it back to the car.
    if (prefersReducedMotion) tl.progress(1)

    master.current = tl

    return () => {
      const active = master.current
      master.current = null
      if (!active) return

      // The rig itself is going away (route change, hot reload): there is nothing
      // left to unfold onto, so drop the tweens instead of playing them backwards
      // against detached Object3Ds.
      if (!useSceneStore.getState().modelReady) {
        active.kill()
        trigger?.enable()
        useSceneStore.getState().setTransforming(false)
        return
      }

      active.eventCallback('onComplete', null)

      if (prefersReducedMotion) {
        active.progress(0).kill()
        trigger?.enable()
        useSceneStore.getState().setTransforming(false)
        return
      }

      useSceneStore.getState().setTransforming(true)
      active.eventCallback('onReverseComplete', () => {
        active.kill()
        // Re-enabling re-reads the scroll position and re-applies the assembly at
        // it, which is the same pose the reverse just restored — so the hand-back
        // has nothing to correct.
        trigger?.enable()
        useSceneStore.getState().setTransforming(false)
      })
      active.reverse()
    }
  }, [robotMode, modelReady, prefersReducedMotion])
}
