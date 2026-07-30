import { useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera } from 'three'
import { cameraState } from '@/animations/cameraPath'

/**
 * Fraction of viewport width to bias the projection by, pushing the car into the
 * right of frame so it does not sit under the copy column. Only applied on wide
 * viewports — on mobile the copy sits over the scene by design.
 */
const FRAME_BIAS = 0.18
const BIAS_MIN_WIDTH = 768

/**
 * Applies the GSAP-driven polar camera state every frame.
 *
 * Reading `cameraState` here (rather than passing it through props or state) is
 * what keeps scrolling off React's render path entirely: GSAP mutates the plain
 * object, this runs inside the render loop, and no component re-renders.
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)

  // Composition, not animation — so it belongs in an effect keyed on viewport
  // size rather than in the frame loop.
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return
    const { width, height } = size

    if (width < BIAS_MIN_WIDTH) {
      camera.clearViewOffset()
      return
    }

    // Shifting the view window left moves the subject right on screen. This is a
    // projection offset, so it reframes without rotating the camera — a lookAt
    // pan would swing the whole orbit and break the keyframed angles.
    camera.setViewOffset(width, height, -width * FRAME_BIAS, 0, width, height)

    return () => camera.clearViewOffset()
  }, [camera, size])

  useFrame(() => {
    const { theta, radius, height, tx, ty, tz } = cameraState
    camera.position.set(
      tx + Math.sin(theta) * radius,
      height,
      tz + Math.cos(theta) * radius,
    )
    camera.lookAt(tx, ty, tz)
  })

  return null
}
