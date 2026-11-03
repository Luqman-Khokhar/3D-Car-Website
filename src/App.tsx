import { Suspense, lazy } from 'react'
import { ScrollSections } from '@/components/ui/ScrollSections'
import { SceneCopy } from '@/components/ui/SceneCopy'
import { ProgressRail } from '@/components/ui/ProgressRail'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { HudControls } from '@/components/ui/HudControls'
import { FreeLookLegend } from '@/components/ui/FreeLookLegend'
import { TouchDrivePad } from '@/components/ui/TouchDrivePad'
import { PaintPicker } from '@/components/ui/PaintPicker'
import { useDeviceTier } from '@/hooks/useDeviceTier'

// three + @react-three are ~240kB gzip. Splitting them out of the entry lets the
// copy layer and HUD paint immediately instead of waiting on the WebGL bundle.
// The scroll rig (Lenis, GSAP, the timelines) is inside it too; see Experience.
const Experience = lazy(() => import('@/components/3d/Experience'))

function App() {
  useDeviceTier()

  return (
    <>
      {/* Chunk-download phase. Experience mounts its own asset-load gate. */}
      <Suspense fallback={<LoadingScreen progress={12} />}>
        <Experience />
      </Suspense>
      <SceneCopy />
      <HudControls />
      <FreeLookLegend />
      <TouchDrivePad />
      <PaintPicker />
      <ProgressRail />
      <ScrollSections />
    </>
  )
}

export default App
