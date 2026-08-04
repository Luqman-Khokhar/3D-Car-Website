import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import { CarModel } from './CarModel'
import { GroundPlane } from './GroundPlane'
import { Garage } from './Garage'
import { CameraRig } from './CameraRig'
import { FreeLookControls } from './FreeLookControls'
import { GarageEnvironment } from './GarageEnvironment'
import { DebugBridge } from './DebugBridge'
import { debugEnabled } from '@/lib/debug'
import { GARAGE_WALL, FOG_NEAR, FOG_FAR } from '@/scenes/palette'
import { useSceneStore } from '@/store/useSceneStore'

/** Retina is enough; 3x DPR on a phone quadruples fill cost for no visible gain. */
const DPR: [number, number] = [1, 2]

/**
 * Fixed full-viewport canvas. The scrolling DOM sections sit above it and supply
 * scroll length + copy; the camera and parts are driven entirely by ScrollTrigger,
 * so the canvas itself never scrolls.
 */
export function SceneCanvas() {
  const lowPower = useSceneStore((s) => s.lowPower)
  const freeLook = useSceneStore((s) => s.freeLook)

  return (
    <div className="fixed inset-0 z-0">
      <Canvas
        dpr={DPR}
        // 'variance' = VSMShadowMap. R3F's default (PCFSoftShadowMap) is deprecated
        // in three 0.185 and logs a warning; VSM is soft and current.
        shadows={lowPower ? false : 'variance'}
        gl={{ antialias: !lowPower, powerPreference: 'high-performance' }}
        // Framed for the whole 4.3 m car; CameraRig drives it from here on.
        camera={{ position: [4.6, 2.1, 6.4], fov: 38, near: 0.1, far: 120 }}
      >
        <color attach="background" args={[GARAGE_WALL]} />
        {/* Dissolves the far floor into the wall. Without it the 60m plane ends on
            a hard horizon line and the space reads as a void, not a room. */}
        <fog attach="fog" args={[GARAGE_WALL, FOG_NEAR, FOG_FAR]} />
        <Suspense fallback={null}>
          <GarageEnvironment>
          {/* Carries most of the room's exposure. The garage shell is Lambert with
              no IBL, so ambient plus the directional fill is all it gets. */}
          <ambientLight intensity={0.62} />
          {/* Overhead work light, roughly where a garage gantry lamp would sit. */}
          <spotLight
            position={[3.2, 7.5, 4.2]}
            angle={0.62}
            penumbra={0.85}
            intensity={130}
            castShadow={!lowPower}
            // 512 rather than 1024: the shadow camera below is clamped tightly
            // around the car, so texel density is high despite the small map, and
            // VSM blurs the result anyway. Costs ~6fps less than 1024 on an iGPU.
            shadow-mapSize={512}
            // Default near/far spans the whole 120-unit camera range, which wastes
            // almost all depth precision on empty air above and below the car.
            shadow-camera-near={4}
            shadow-camera-far={14}
            shadow-bias={-0.0008}
          />
          {/* Warm bounce off the concrete, filling the shaded side of the body. */}
          <directionalLight position={[-5, 3, -6]} intensity={0.55} color="#cfc6b4" />
          {/* Fill from the door/window side. Required, not decorative: the tool
              wall faces +Z, and neither the -Z directional above nor the tight
              spotlight cone reaches it, so without this it renders ambient-only
              and every prop on it reads as a dark smudge. */}
          <directionalLight position={[2, 4, 9]} intensity={0.62} color="#e8e2d0" />
          <GroundPlane />
          <Garage />
          {/* Soft occlusion where the car meets the floor. The spotlight shadow
              alone leaves a gap under the sills that reads as the car hovering.
              Skipped on low power: this is a full extra depth pass per frame. */}
          {!lowPower && (
            <ContactShadows
              position={[0, 0.012, 0]}
              scale={13}
              // Only needs to reach the sills, not the roof — a tighter far plane
              // keeps the contact tight instead of a vague grey pool.
              far={1.1}
              blur={2.6}
              opacity={0.62}
              resolution={512}
              color="#1b1f24"
            />
          )}
          <CarModel />
          <CameraRig />
          {/* Mounted only in free look so exactly one system writes the camera. */}
          {freeLook && <FreeLookControls />}
          {debugEnabled() && <DebugBridge />}
          </GarageEnvironment>
        </Suspense>
      </Canvas>
    </div>
  )
}
