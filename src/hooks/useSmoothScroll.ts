import { useEffect } from 'react'
import Lenis from 'lenis'
import { gsap, ScrollTrigger } from '@/lib/gsap'
import { useSceneStore } from '@/store/useSceneStore'

let lenisInstance: Lenis | null = null

/** Escape hatch for imperative scrolling (e.g. the hero "scroll to begin" cue). */
export function getLenis() {
  return lenisInstance
}

/**
 * Returns to the top, replaying the whole assembly in reverse on the way.
 * Falls back to native scrolling under reduced motion, where Lenis never mounts.
 */
export function scrollToTop() {
  const lenis = lenisInstance
  if (lenis) {
    lenis.scrollTo(0, { duration: 2.4 })
    return
  }
  window.scrollTo({ top: 0, behavior: 'auto' })
}

/**
 * Mounts Lenis once and hands frame control to GSAP's ticker so ScrollTrigger
 * and Lenis never disagree about the current scroll offset. See src/lib/gsap.ts.
 */
export function useSmoothScroll() {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    useSceneStore.getState().setPrefersReducedMotion(prefersReducedMotion)

    // Quantize to 0.5% steps so a full-page scroll triggers ~200 React renders
    // instead of one per frame.
    let lastReported = -1
    const report = (progress: number) => {
      const quantized = Math.round(progress * 200) / 200
      if (quantized === lastReported) return
      lastReported = quantized
      useSceneStore.getState().setScrollProgress(quantized)
    }

    // Reduced motion: let the browser own scrolling entirely. No inertia, no
    // smoothing. Progress still has to be published or the scene would freeze,
    // so read it off the native scroll position instead of off Lenis.
    if (prefersReducedMotion) {
      const onNativeScroll = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight
        report(max > 0 ? window.scrollY / max : 0)
      }
      onNativeScroll()
      window.addEventListener('scroll', onNativeScroll, { passive: true })
      window.addEventListener('resize', onNativeScroll)
      return () => {
        window.removeEventListener('scroll', onNativeScroll)
        window.removeEventListener('resize', onNativeScroll)
      }
    }

    const lenis = new Lenis({
      // ~1s to settle. Higher feels laggy under scrubbed 3D, lower feels notchy.
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      // Touch smoothing fights native momentum on iOS; leave it to the OS.
      syncTouch: false,
    })
    lenisInstance = lenis

    // ScrollTrigger must recompute on every Lenis frame, not on native scroll events
    // (Lenis uses transforms/scrollTo, so native scroll fires at the wrong time).
    lenis.on('scroll', ScrollTrigger.update)

    // GSAP ticker time is seconds, Lenis.raf expects milliseconds.
    const raf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)

    const onScroll = ({ progress }: { progress: number }) => report(progress)
    lenis.on('scroll', onScroll)

    return () => {
      lenis.off('scroll', ScrollTrigger.update)
      lenis.off('scroll', onScroll)
      gsap.ticker.remove(raf)
      lenis.destroy()
      lenisInstance = null
    }
  }, [])
}
