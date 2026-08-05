import { useEffect } from 'react'
import { gsap, ScrollTrigger } from '@/lib/gsap'
import { buildAssemblyTimeline } from '@/animations/buildAssemblyTimeline'
import { resetCameraState } from '@/animations/cameraPath'
import { resetPaintState } from '@/animations/paintState'
import { resetLightingState } from '@/animations/lightingState'
import { SECTIONS, useSceneStore } from '@/store/useSceneStore'
import { SCROLL_ROOT_ID } from '@/scenes/sections'

/**
 * Creates the scrubbed master timeline once the car rig has registered its parts,
 * and binds it to document scroll.
 *
 * Waits on `modelReady` because buildAssemblyTimeline resolves Object3D handles
 * out of the part registry — building before the rig mounts would silently skip
 * every part.
 */
export function useAssemblyTimeline() {
  const modelReady = useSceneStore((s) => s.modelReady)
  const prefersReducedMotion = useSceneStore((s) => s.prefersReducedMotion)

  useEffect(() => {
    if (!modelReady) return

    resetCameraState()
    resetPaintState()
    resetLightingState()
    const timeline = buildAssemblyTimeline()

    // Reduced motion: no scrubbing. Snap to the assembled end state so the car
    // is shown finished rather than animating on scroll.
    if (prefersReducedMotion) {
      timeline.progress(1).pause()
      return () => {
        timeline.kill()
      }
    }

    const trigger = ScrollTrigger.create({
      trigger: `#${SCROLL_ROOT_ID}`,
      start: 'top top',
      end: 'bottom bottom',
      // Slight smoothing on the scrub so a flicked wheel does not snap the camera.
      scrub: 0.6,
      animation: timeline,
      onUpdate: (self) => {
        // Map 0..1 onto scene index. Store writes are cheap here because
        // activeSection only changes 11 times over the whole page.
        const index = Math.min(
          SECTIONS.length - 1,
          Math.round(self.progress * (SECTIONS.length - 1)),
        )
        const next = SECTIONS[index]
        const store = useSceneStore.getState()
        if (store.activeSection !== next) store.setActiveSection(next)
      },
    })

    // Sections are sized in vh, so a mobile URL-bar resize changes the mapping.
    ScrollTrigger.refresh()

    return () => {
      trigger.kill()
      timeline.kill()
      // Drop tweens still holding references to unmounted Object3Ds.
      gsap.killTweensOf(timeline)
    }
  }, [modelReady, prefersReducedMotion])
}
