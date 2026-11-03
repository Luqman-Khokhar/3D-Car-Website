import { useEffect, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { useSceneStore } from '@/store/useSceneStore'

/** Unmount the overlay this long after 100%. Must outlast LoadingScreen's
 *  700 ms fade: at 400 ms it used to be pulled while still ~40% opaque, which
 *  read as a pop at the end of the reveal. */
const SETTLE_MS = 760
/** Reveal anyway this long after the rig is up, should calibration never report
 *  back. AdaptiveQuality caps itself well under this; it is a backstop. */
const SETTLED_BACKSTOP_MS = 7000

/**
 * Covers the canvas until all three conditions hold: drei's loading manager
 * reports every queued asset in, the car rig has mounted and registered its
 * parts, and AdaptiveQuality has settled on a render tier — so any tier change,
 * and the shader rebuild that comes with it, happens behind this overlay.
 *
 * The procedural rig queues nothing through the loading manager, so `active`
 * goes false immediately and `modelReady` is what actually gates the reveal.
 * Once a real GLB lands, `progress` starts carrying real bytes and both matter.
 */
export function LoadingGate() {
  const { active, progress } = useProgress()
  const modelReady = useSceneStore((s) => s.modelReady)
  const sceneSettled = useSceneStore((s) => s.sceneSettled)
  const setLoadProgress = useSceneStore((s) => s.setLoadProgress)
  const [dismissed, setDismissed] = useState(false)
  const [backstop, setBackstop] = useState(false)

  useEffect(() => {
    setLoadProgress(progress)
  }, [progress, setLoadProgress])

  useEffect(() => {
    if (!modelReady) return
    const timer = window.setTimeout(() => setBackstop(true), SETTLED_BACKSTOP_MS)
    return () => window.clearTimeout(timer)
  }, [modelReady])

  const complete = !active && modelReady && (sceneSettled || backstop)

  useEffect(() => {
    if (!complete) return
    const timer = window.setTimeout(() => setDismissed(true), SETTLE_MS)
    return () => window.clearTimeout(timer)
  }, [complete])

  // Fully unmount after the fade so the overlay stops costing a composite layer.
  if (dismissed) return null

  // With nothing queued, drei reports 0; show rig-mount as the real signal.
  // Calibration is the last step, so it gets the last stretch of the bar.
  const shown = active ? progress : complete ? 100 : modelReady ? 88 : 60

  return <LoadingScreen progress={shown} hidden={complete} />
}
