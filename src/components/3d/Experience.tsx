import { SceneCanvas } from './SceneCanvas'
import { LoadingGate } from './LoadingGate'
import { useSmoothScroll } from '@/hooks/useSmoothScroll'
import { useAssemblyTimeline } from '@/hooks/useAssemblyTimeline'
import { useFreeLookLock } from '@/hooks/useFreeLookLock'
import { useRobotTransform } from '@/hooks/useRobotTransform'
import { useSceneStore } from '@/store/useSceneStore'

/**
 * Lazy-loaded entry for everything WebGL. Keeping the gate in here (rather than
 * in App) means the loading UI ships in the same chunk as the thing it waits on,
 * so it can read drei's loading manager directly.
 *
 * The scroll rig lives here too. Lenis, GSAP and the timelines all pull in three
 * (directly or through the part data), and calling them from App put ~160 kB gzip
 * of three core and GSAP into the entry chunk — ahead of the loading screen's
 * first paint — for hooks that cannot do anything until the canvas is up anyway.
 */
export default function Experience() {
  const qualityKnown = useSceneStore((s) => s.qualityKnown)

  useSmoothScroll()
  // Builds itself once the rig reports modelReady; see the hook.
  useAssemblyTimeline()
  // After useSmoothScroll: it stops and starts the Lenis instance that one makes.
  useFreeLookLock()
  // Drives the car/robot fold off the store's robotMode flag.
  useRobotTransform()

  return (
    <>
      {/* Not before the tier is known, or the canvas would build once at a guess
          and again at the real tier. */}
      {qualityKnown && <SceneCanvas />}
      <LoadingGate />
    </>
  )
}
