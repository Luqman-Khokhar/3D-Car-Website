import { Suspense, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import { ACESFilmicToneMapping, NoToneMapping } from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { CarModel } from './CarModel'
import { GroundPlane } from './GroundPlane'
import { Garage } from './Garage'
import { CameraRig } from './CameraRig'
import { FreeLookControls } from './FreeLookControls'
import { GarageEnvironment } from './GarageEnvironment'
import { PostFX } from './PostFX'
import { DebugBridge } from './DebugBridge'
import { debugEnabled } from '@/lib/debug'
import { GARAGE_WALL, GARAGE_FLOOR, FOG_NEAR, FOG_FAR } from '@/scenes/palette'
import { ROOM_HEIGHT } from '@/scenes/garage'
import { useSceneStore } from '@/store/useSceneStore'

/** Retina is enough; 3x DPR on a phone quadruples fill cost for no visible gain. */
const DPR: [number, number] = [1, 2]

// RectAreaLight needs its BRDF lookup tables uploaded before first use or it
// renders black. Idempotent, and cheap enough to call at module scope.
RectAreaLightUniformsLib.init()

/**
 * Tone mapping is owned here rather than by the `gl` prop, because it depends on
 * whether the post chain is mounted and that is only known after the device tier
 * resolves. With the composer up, AgX runs as the last effect on HDR values; with
 * it down, the renderer has to do it or everything clips to white.
 */
function ToneMappingPolicy({ managed }: { managed: boolean }) {
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    gl.toneMapping = managed ? NoToneMapping : ACESFilmicToneMapping
  }, [gl, managed])

  return null
}

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
        // antialias is redundant once PostFX mounts a composer — SMAA in the chain
        // replaces it. It stays on so the low-power path, which has no chain, is
        // not left with raw jaggies.
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        // Framed for the whole 4.3 m car; CameraRig drives it from here on.
        camera={{ position: [4.6, 2.1, 6.4], fov: 38, near: 0.1, far: 120 }}
      >
        <color attach="background" args={[GARAGE_WALL]} />
        {/* Dissolves the far floor into the wall. Without it the 60m plane ends on
            a hard horizon line and the space reads as a void, not a room. */}
        <fog attach="fog" args={[GARAGE_WALL, FOG_NEAR, FOG_FAR]} />
        <ToneMappingPolicy managed={!lowPower} />
        <Suspense fallback={null}>
          <GarageEnvironment>
          {/* Room fill. This was a flat ambientLight at 0.62, which is the most
              effective way to destroy form there is: it adds the same value to
              every fragment regardless of which way it faces, so shading loses its
              gradient and the whole scene goes papery. A hemisphere light costs
              the same and carries a direction — sky above, bounced floor below.
              The garage shell is Lambert with no IBL, so this is all it gets, and
              the values are picked to hold the room at its previous exposure. */}
          <hemisphereLight args={[GARAGE_WALL, GARAGE_FLOOR, 1.15]} />
          {/* What is left of the old ambient: just enough to keep deep corners off
              pure black, low enough not to flatten anything. */}
          <ambientLight intensity={0.14} />
          {/* Overhead work light, roughly where a garage gantry lamp would sit. */}
          <spotLight
            position={[3.2, 7.5, 4.2]}
            angle={0.62}
            penumbra={0.85}
            intensity={150}
            castShadow={!lowPower}
            // 1024 rather than the old 512: with ambient no longer washing the
            // scene out, the car's own shadows onto itself — hood onto bay, roof
            // onto side glass — actually read, and at 512 they were mush.
            shadow-mapSize={1024}
            // Default near/far spans the whole 120-unit camera range, which wastes
            // almost all depth precision on empty air above and below the car.
            shadow-camera-near={4}
            shadow-camera-far={14}
            shadow-bias={-0.0008}
          />
          {/* Warm bounce off the concrete, filling the shaded side of the body. */}
          <directionalLight position={[-5, 3, -6]} intensity={0.42} color="#cfc6b4" />
          {/* Fill from the door/window side. Required, not decorative: the tool
              wall faces +Z, and neither the -Z directional above nor the tight
              spotlight cone reaches it, so without this it renders ambient-only
              and every prop on it reads as a dark smudge. */}
          <directionalLight position={[2, 4, 9]} intensity={0.5} color="#e8e2d0" />
          {/* The two ceiling fluorescents nearest the car, as actual area lights
              rather than emissive props. A point or spot light can only ever put a
              round hotspot on a panel; a strip puts a long streak down the flank,
              and that streak is the most recognisable thing in any photograph of a
              car. Positions match ceilingLights() in src/scenes/garage.ts, so the
              highlight belongs to a fixture that is visibly overhead.

              Rotating -PI/2 about X aims the light down and lays its height axis
              along Z, i.e. along the car. Area lights cannot cast shadows and are
              the most expensive light type per fragment, so there are exactly two
              and they are skipped entirely on low power. */}
          {!lowPower && (
            <>
              <rectAreaLight
                position={[-3.4, ROOM_HEIGHT - 0.24, 1.4]}
                rotation={[-Math.PI / 2, 0, 0]}
                width={0.3}
                height={2.4}
                intensity={22}
                color="#fff4de"
              />
              <rectAreaLight
                position={[1.6, ROOM_HEIGHT - 0.24, 1.4]}
                rotation={[-Math.PI / 2, 0, 0]}
                width={0.3}
                height={2.4}
                intensity={22}
                color="#fff4de"
              />
            </>
          )}
          <GroundPlane />
          <Garage />
          {/* Soft occlusion where the car meets the floor. The spotlight shadow
              alone leaves a gap under the sills that reads as the car hovering.
              Still worth its depth pass even with N8AO in the chain: screen-space
              AO only knows about what is on screen, so it cannot darken under a
              car whose underside is facing away from the camera.
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
          {!lowPower && <PostFX />}
          </GarageEnvironment>
        </Suspense>
      </Canvas>
    </div>
  )
}
