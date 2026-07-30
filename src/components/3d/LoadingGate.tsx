import { useEffect, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { useSceneStore } from '@/store/useSceneStore'

/** Hold the overlay this long after 100% so the fade does not stutter. */
const SETTLE_MS = 400

/**
 * Covers the canvas until both conditions hold: drei's loading manager reports
 * every queued asset in, and the car rig has mounted and registered its parts.
 *
 * The procedural rig queues nothing through the loading manager, so `active`
 * goes false immediately and `modelReady` is what actually gates the reveal.
 * Once a real GLB lands, `progress` starts carrying real bytes and both matter.
 */
export function LoadingGate() {
  const { active, progress } = useProgress()
  const modelReady = useSceneStore((s) => s.modelReady)
  const setLoadProgress = useSceneStore((s) => s.setLoadProgress)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setLoadProgress(progress)
  }, [progress, setLoadProgress])

  const complete = !active && modelReady

  useEffect(() => {
    if (!complete) return
    const timer = window.setTimeout(() => setDismissed(true), SETTLE_MS)
    return () => window.clearTimeout(timer)
  }, [complete])

  // Fully unmount after the fade so the overlay stops costing a composite layer.
  if (dismissed) return null

  // With nothing queued, drei reports 0; show rig-mount as the real signal.
  const shown = active ? progress : modelReady ? 100 : 60

  return <LoadingScreen progress={shown} hidden={complete} />
}
