import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// Lenis drives the scroll position via rAF. GSAP's own ticker also runs on rAF.
// If both run their own loops, ScrollTrigger reads a scroll value that Lenis has
// not committed yet for the current frame, which shows up as one-frame jitter.
// The fix (wired in useSmoothScroll) is to make Lenis a slave of GSAP's ticker,
// so ordering is: gsap tick -> lenis.raf -> ScrollTrigger.update -> render.
// lagSmoothing(0) stops GSAP from clamping delta after a long frame, which would
// otherwise desync scrubbed timelines from the real scroll offset.
gsap.ticker.lagSmoothing(0)

export { gsap, ScrollTrigger }
