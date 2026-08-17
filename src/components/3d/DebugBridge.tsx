import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import type { Scene, Camera, WebGLRenderer } from 'three'
import { cameraState } from '@/animations/cameraPath'
import type { CameraKey } from '@/animations/cameraPath'
import { garageDoorState } from '@/animations/garageDoorState'
import type { GarageDoorState } from '@/animations/garageDoorState'

export interface SceneDebugHandle {
  scene: Scene
  camera: Camera
  gl: WebGLRenderer
  /**
   * Live polar camera state. Mutate this to reframe — writing camera.position
   * directly does nothing, because CameraRig recomputes it from here every frame.
   */
  cameraState: CameraKey
  /** Live door state. Flip `.open` to drive the sectional door without the
   *  in-scene button — GarageDoor.tsx eases toward it either way. */
  garageDoorState: GarageDoorState
}

declare global {
  interface Window {
    __carScene?: SceneDebugHandle
  }
}

/**
 * Publishes the renderer, scene and camera on `window.__carScene` so draw calls,
 * triangle counts and part transforms can be inspected from the console or from
 * an automated perf check. Only mounted under ?debug=1 (see lib/debug.ts), so it
 * costs nothing in a normal session.
 */
export function DebugBridge() {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    window.__carScene = { scene, camera, gl, cameraState, garageDoorState }
    return () => {
      delete window.__carScene
    }
  }, [scene, camera, gl])

  return null
}
