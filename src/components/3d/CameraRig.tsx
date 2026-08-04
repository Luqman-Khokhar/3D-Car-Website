import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera, Vector3 } from 'three'
import { cameraState } from '@/animations/cameraPath'
import { useSceneStore } from '@/store/useSceneStore'

/**
 * Fraction of viewport width to bias the projection by, pushing the car into the
 * right of frame so it does not sit under the copy column. Only applied on wide
 * viewports — on mobile the copy sits over the scene by design.
 */
const FRAME_BIAS = 0.18
const BIAS_MIN_WIDTH = 768

/**
 * Per-second fraction of the remaining gap closed when easing back out of free
 * look. Framerate-independent via the pow() below.
 */
const RETURN_SMOOTHING = 0.0015
/** Below this the blend is done; snapping here avoids an infinite asymptote. */
const RETURN_EPSILON = 0.01

const desired = new Vector3()
const target = new Vector3()
const forward = new Vector3()

/**
 * Applies the GSAP-driven polar camera state every frame.
 *
 * Reading `cameraState` here (rather than passing it through props or state) is
 * what keeps scrolling off React's render path entirely: GSAP mutates the plain
 * object, this runs inside the render loop, and no component re-renders.
 *
 * While free look is on this stands down completely and FreeLookControls owns
 * the camera; on exit it eases back to the scripted pose instead of cutting.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const freeLook = useSceneStore((s) => s.freeLook)
  const returning = useRef(false)
  /** Look-at point actually used this frame; eased separately during the return. */
  const lookAt = useRef(new Vector3())
  const adoptLook = useRef(false)

  // Entering free look leaves the camera wherever the user parked it, so the
  // next non-free-look frame has a gap to close.
  useEffect(() => {
    if (!freeLook) return
    returning.current = true
    adoptLook.current = true
  }, [freeLook])

  // Composition, not animation — so it belongs in an effect keyed on viewport
  // size rather than in the frame loop. Free look drops the bias: with no copy
  // column to dodge, an off-centre subject just reads as a framing error.
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return
    const { width, height } = size

    if (freeLook || width < BIAS_MIN_WIDTH) {
      camera.clearViewOffset()
      return
    }

    // Shifting the view window left moves the subject right on screen. This is a
    // projection offset, so it reframes without rotating the camera — a lookAt
    // pan would swing the whole orbit and break the keyframed angles.
    camera.setViewOffset(width, height, -width * FRAME_BIAS, 0, width, height)

    return () => camera.clearViewOffset()
  }, [camera, size, freeLook])

  useFrame((_, delta) => {
    if (freeLook) return

    const { theta, radius, height, tx, ty, tz } = cameraState
    desired.set(tx + Math.sin(theta) * radius, height, tz + Math.cos(theta) * radius)
    target.set(tx, ty, tz)

    if (!returning.current) {
      camera.position.copy(desired)
      camera.lookAt(target)
      return
    }

    // First frame back: recover the point the user was looking at, so the
    // orientation eases across too instead of snapping to the scripted angle.
    if (adoptLook.current) {
      camera.getWorldDirection(forward)
      lookAt.current
        .copy(camera.position)
        .addScaledVector(forward, camera.position.distanceTo(target))
      adoptLook.current = false
    }

    // Exponential ease so the hand-off has no seam at either end.
    const t = 1 - Math.pow(RETURN_SMOOTHING, delta)
    camera.position.lerp(desired, t)
    lookAt.current.lerp(target, t)
    camera.lookAt(lookAt.current)

    if (camera.position.distanceTo(desired) < RETURN_EPSILON) returning.current = false
  })

  return null
}
