import { useEffect } from 'react'
import { getLenis } from '@/hooks/useSmoothScroll'
import { useSceneStore } from '@/store/useSceneStore'

/**
 * Suspends page scrolling for the duration of free look, and wires Escape as the
 * exit.
 *
 * Scroll has to stop, not just be ignored: the assembly timeline is scrubbed by
 * ScrollTrigger, so a stray wheel event while the user is orbiting would rebuild
 * the car underneath them and move the scripted pose they get eased back to.
 *
 * Lenis.stop() already preventDefaults wheel and touch, so the overflow lock is
 * only needed on the reduced-motion path, where Lenis never mounts and the
 * browser owns scrolling.
 */
export function useFreeLookLock() {
  const freeLook = useSceneStore((s) => s.freeLook)

  useEffect(() => {
    if (!freeLook) return

    const lenis = getLenis()
    const root = document.documentElement
    const previousOverflow = root.style.overflow

    if (lenis) lenis.stop()
    else root.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') useSceneStore.getState().setFreeLook(false)
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (lenis) lenis.start()
      else root.style.overflow = previousOverflow
    }
  }, [freeLook])
}
