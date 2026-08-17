import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import type { Scene, Camera, WebGLRenderer } from 'three'
import { cameraState } from '@/animations/cameraPath'
import type { CameraKey } from '@/animations/cameraPath'
import { garageDoorState } from '@/animations/garageDoorState'
import type { GarageDoorState } from '@/animations/garageDoorState'
import { driveState } from '@/animations/driveState'
import type { DriveState } from '@/animations/driveState'
import { useSceneStore } from '@/store/useSceneStore'

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
  /** Live drive state. Write `.x`/`.z`/`.yaw` to teleport the car anywhere on
   *  the circuit without holding a key down — the fastest way to check a corner
   *  or the chase framing from a screenshot. Needs free look on for the drive
   *  camera to be mounted at all. */
  driveState: DriveState
  /** Free look, which is what mounts DriveControls and DriveCamera. */
  setFreeLook: (value: boolean) => void
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
  const setFreeLook = useSceneStore((s) => s.setFreeLook)

  useEffect(() => {
    window.__carScene = {
      scene,
      camera,
      gl,
      cameraState,
      garageDoorState,
      driveState,
      setFreeLook,
    }
    return () => {
      delete window.__carScene
    }
  }, [scene, camera, gl, setFreeLook])

  return null
}
