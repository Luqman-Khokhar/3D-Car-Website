import type Lenis from 'lenis'

/**
 * Imperative handle on the page scroller.
 *
 * Lives apart from useSmoothScroll so the DOM layer (the reveal button, the
 * chapter rail) can scroll without importing Lenis and GSAP into the entry chunk.
 * Type-only import above — this module costs nothing at runtime.
 */
let lenis: Lenis | null = null

export function setLenis(instance: Lenis | null) {
  lenis = instance
}

export function getLenis() {
  return lenis
}

function maxScroll() {
  return Math.max(document.documentElement.scrollHeight - window.innerHeight, 0)
}

/**
 * Scrolls to a 0..1 fraction of the page. Lenis eases it — and because the
 * assembly is scrubbed, the car builds or unbuilds along the way — with a
 * duration scaled to the distance so a one-chapter hop does not take as long as
 * the whole story. Falls back to native scrolling under reduced motion, where
 * Lenis never mounts.
 */
export function scrollToProgress(progress: number) {
  const top = Math.min(Math.max(progress, 0), 1) * maxScroll()
  if (lenis) {
    const distance = Math.abs(top - lenis.scroll) / Math.max(maxScroll(), 1)
    lenis.scrollTo(top, { duration: 0.9 + distance * 1.6 })
    return
  }
  window.scrollTo({ top, behavior: 'auto' })
}

/** Returns to the top, replaying the whole assembly in reverse on the way. */
export function scrollToTop() {
  scrollToProgress(0)
}
