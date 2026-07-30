import { Suspense, lazy } from 'react'
import { ScrollSections } from '@/components/ui/ScrollSections'
import { SceneCopy } from '@/components/ui/SceneCopy'
import { ProgressRail } from '@/components/ui/ProgressRail'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { useSmoothScroll } from '@/hooks/useSmoothScroll'
import { useDeviceTier } from '@/hooks/useDeviceTier'
import { useAssemblyTimeline } from '@/hooks/useAssemblyTimeline'

// three + @react-three are ~240kB gzip. Splitting them out of the entry lets the
// copy layer and HUD paint immediately instead of waiting on the WebGL bundle.
const Experience = lazy(() => import('@/components/3d/Experience'))

function App() {
  useDeviceTier()
  useSmoothScroll()
  // Builds itself once the rig reports modelReady; see the hook.
  useAssemblyTimeline()

  return (
    <>
      {/* Chunk-download phase. Experience mounts its own asset-load gate. */}
      <Suspense fallback={<LoadingScreen progress={12} />}>
        <Experience />
      </Suspense>
      <SceneCopy />
      <ProgressRail />
      <ScrollSections />
    </>
  )
}

export default App
