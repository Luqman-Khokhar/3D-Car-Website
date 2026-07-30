import { SceneCanvas } from './SceneCanvas'
import { LoadingGate } from './LoadingGate'

/**
 * Lazy-loaded entry for everything WebGL. Keeping the gate in here (rather than
 * in App) means the loading UI ships in the same chunk as the thing it waits on,
 * so it can read drei's loading manager directly.
 */
export default function Experience() {
  return (
    <>
      <SceneCanvas />
      <LoadingGate />
    </>
  )
}
