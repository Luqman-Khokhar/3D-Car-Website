/**
 * Module handle on the live scroll-scrubbed timeline and its trigger.
 *
 * The transform sequence needs both: it seeks the assembly to its end (a robot
 * built out of half the panels is a pile) and it has to stop ScrollTrigger from
 * writing part transforms for as long as the robot owns them. Neither is
 * reachable through the store — they are imperative GSAP objects, not state — and
 * threading them through React would put the whole scroll rig on the render path,
 * which is precisely what the cameraState/paintState pattern exists to avoid.
 *
 * `gsap.core.Timeline` and `ScrollTrigger` are both global ambient types from
 * gsap's own declarations, so neither needs importing here.
 */
interface AssemblyHandle {
  timeline: gsap.core.Timeline | null
  trigger: ScrollTrigger | null
}

const handle: AssemblyHandle = { timeline: null, trigger: null }

export function setAssemblyHandle(
  timeline: gsap.core.Timeline | null,
  trigger: ScrollTrigger | null,
) {
  handle.timeline = timeline
  handle.trigger = trigger
}

export function getAssemblyHandle(): AssemblyHandle {
  return handle
}
