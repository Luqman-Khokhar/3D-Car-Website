import { Suspense, lazy, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AgXToneMapping, Color } from 'three'
import type { Group } from 'three'
import { CarModel } from './CarModel'
import { GroundPlane } from './GroundPlane'
import { Garage } from './Garage'
import { GarageDoor } from './GarageDoor'
import { GarageLights } from './GarageLights'
import { CameraRig } from './CameraRig'
import { FreeLookControls } from './FreeLookControls'
import { DriveControls } from './DriveControls'
import { DriveCamera } from './DriveCamera'
import { WheelMotion } from './WheelMotion'
import { GarageEnvironment } from './GarageEnvironment'
import { DebugBridge } from './DebugBridge'
import { CarContactShadow } from './CarContactShadow'
import { RenderDriver, ShadowMapGate } from './RenderDriver'
import { AdaptiveQuality } from './AdaptiveQuality'
import { debugEnabled } from '@/lib/debug'
import { QUALITY } from '@/lib/quality'
import { roomDim } from '@/animations/lightingState'
import { driveState, outsideBlend } from '@/animations/driveState'
import {
  GARAGE_WALL,
  FOG_NEAR,
  FOG_FAR,
  NIGHT_AIR,
  OUTSIDE_AIR,
  OUTSIDE_FOG_FAR,
  OUTSIDE_FOG_NEAR,
} from '@/scenes/palette'
import { useSceneStore } from '@/store/useSceneStore'

/** Post chain: postprocessing + N8AO, ~250 kB that only tiers with `post` load.
 *  useDeviceTier starts the fetch as soon as the tier is known. */
const PostFX = lazy(() => import('./PostFX'))

/**
 * Renderer tone mapping when no composer is mounted. AgX rather than R3F's ACES
 * default so the low tier holds the same look as the others — the lamp emissives
 * in useLampPass were tuned against AgX's hue handling, and under ACES the tail
 * lamp desaturates differently. PostFX turns this off while it is mounted and
 * runs AgX as its last effect instead; it mounts after this, so its layout
 * effect lands second.
 */
function ToneMappingPolicy() {
  const gl = useThree((s) => s.gl)

  useLayoutEffect(() => {
    gl.toneMapping = AgXToneMapping
  }, [gl])

  return null
}

/**
 * Carries the background and the fog from lit garage air to night air across the
 * two lighting scenes, and — on top of that — to plain white once the car is
 * driven out through the sectional door.
 *
 * All three have to move together. The background is the far wall in every
 * direction the room does not cover, and the fog is what the far end of the floor
 * dissolves into — dimming the lights while either stays at daylight value leaves
 * the car in a dark room punched out of a bright sky, which reads as a rendering
 * bug rather than as darkness. Same reasoning for the outside whiteout: it has to
 * take over the fog too, or the drive-out world dissolves into whatever the
 * garage's own atmosphere happened to be instead of an open white world.
 *
 * Runs every frame rather than only on change (the old dim-only version's
 * `applied` cache) because the outside blend now moves continuously with the
 * car's position while driving — the colour math itself is cheap enough that
 * gating it isn't worth the extra state.
 */
function NightPass() {
  const scene = useThree((s) => s.scene)
  const lit = useMemo(() => new Color(GARAGE_WALL), [])
  const night = useMemo(() => new Color(NIGHT_AIR), [])
  const outside = useMemo(() => new Color(OUTSIDE_AIR), [])
  const base = useMemo(() => new Color(), [])
  const final = useMemo(() => new Color(), [])

  useFrame(() => {
    base.lerpColors(lit, night, roomDim.value)
    const outsideT = outsideBlend()
    final.lerpColors(base, outside, outsideT)

    if (scene.background instanceof Color) scene.background.copy(final)
    if (!scene.fog) return
    scene.fog.color.copy(final)
    // The fog range has to open up with the colour, not just its hue: the
    // garage's 16–44 m range is set for a 19 m room and would swallow the far
    // side of the circuit ~80 m out while the car is still driving toward it.
    // Lerped on the same t, so the horizon pushes back as the car noses out
    // rather than popping the moment it crosses the door plane.
    if ('near' in scene.fog && 'far' in scene.fog) {
      scene.fog.near = FOG_NEAR + (OUTSIDE_FOG_NEAR - FOG_NEAR) * outsideT
      scene.fog.far = FOG_FAR + (OUTSIDE_FOG_FAR - FOG_FAR) * outsideT
    }
  })

  return null
}

/**
 * Follows the car with the contact shadow so it stays grounded once it is out on
 * the circuit. Previously pinned to the origin, which was fine while the car
 * never left the garage: driven out, the car kept its shadow parked in the empty
 * garage behind it.
 */
function CarShadow({ children }: { children: React.ReactNode }) {
  const group = useRef<Group>(null)

  useFrame(() => {
    if (group.current) group.current.position.set(driveState.x, 0, driveState.z)
  })

  return <group ref={group}>{children}</group>
}

/**
 * Fixed full-viewport canvas. The scrolling DOM sections sit above it and supply
 * scroll length + copy; the camera and parts are driven entirely by ScrollTrigger,
 * so the canvas itself never scrolls.
 */
export function SceneCanvas() {
  const quality = useSceneStore((s) => s.quality)
  const freeLook = useSceneStore((s) => s.freeLook)
  const robotMode = useSceneStore((s) => s.robotMode)
  const renderEnabled = useSceneStore((s) => s.renderEnabled)
  const settings = QUALITY[quality]
  /** A robot has no throttle and no axles. Unmounting both is also what hands the
   *  wheels' rotation.x back to the fold: WheelMotion restores whatever pose it
   *  captured on mount as it unmounts, and React runs that cleanup before the
   *  transform effect in App fires. */
  const driveable = freeLook && !robotMode
  /** Starting resolution only; AdaptiveQuality owns it from the first frame. A
   *  changing prop here would fight its setDpr calls. */
  const [initialDpr] = useState(() =>
    Math.max(settings.minDpr, Math.min(window.devicePixelRatio || 1, settings.maxDpr)),
  )

  return (
    // data-free-look switches the canvas cursor to grab/grabbing; see index.css.
    <div className="fixed inset-0 z-0" data-free-look={freeLook ? '' : undefined}>
      <Canvas
        dpr={initialDpr}
        // Draw only when something changed — see RenderDriver. A parked camera
        // costs nothing instead of the full chain sixty times a second. Held at
        // 'never' until AdaptiveQuality has compiled every shader in parallel, so
        // the first frame does not link forty programs one after another.
        frameloop={renderEnabled ? 'demand' : 'never'}
        onCreated={({ gl }) => {
          // Reading back compile logs forces each shader to finish synchronously,
          // the opposite of what the parallel precompile is for. Dev keeps them.
          gl.debug.checkShaderErrors = import.meta.env.DEV
        }}
        // 'variance' = VSMShadowMap. R3F's default (PCFSoftShadowMap) is deprecated
        // in three 0.185 and logs a warning; VSM is soft and current.
        shadows={settings.shadows ? 'variance' : false}
        // antialias is redundant once PostFX mounts a composer — SMAA in the chain
        // replaces it. It stays on so the low tier, which has no chain, is not
        // left with raw jaggies.
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        // Framed for the whole 4.3 m car; CameraRig drives it from here on. The
        // far plane has to clear OUTSIDE_FOG_FAR, or the back straight of the
        // circuit is clipped away instead of fading into haze.
        camera={{ position: [4.6, 2.1, 6.4], fov: 38, near: 0.1, far: 260 }}
      >
        <color attach="background" args={[GARAGE_WALL]} />
        {/* Dissolves the far floor into the wall. Without it the 60m plane ends on
            a hard horizon line and the space reads as a void, not a room. */}
        <fog attach="fog" args={[GARAGE_WALL, FOG_NEAR, FOG_FAR]} />
        <ToneMappingPolicy />
        <RenderDriver />
        {/* Everything below commits together — including the lazy post chain and
            area lights — so the first frame is the final one and every shader
            compiles once, behind the loading screen. */}
        <Suspense fallback={null}>
          <GarageEnvironment>
          <GarageLights shadows={settings.shadows} areaLights={settings.areaLights} />
          <NightPass />
          <GroundPlane pbr={settings.pbrFloor} />
          <Garage />
          <GarageDoor />
          <CarModel />
          {/* Soft occlusion where the car meets the floor. The spotlight shadow
              alone leaves a gap under the sills that reads as the car hovering.
              Still worth its pass even with N8AO in the chain: screen-space AO
              only knows about what is on screen, so it cannot darken under a car
              whose underside is facing away from the camera.
              After CarModel so it reads this frame's drive transform. Skipped on
              the low tier. */}
          {settings.contactResolution > 0 && (
            <CarShadow>
            <CarContactShadow
              position={[0, 0.012, 0]}
              scale={13}
              // Only needs to reach the sills, not the roof — a tighter far plane
              // keeps the contact tight instead of a vague grey pool.
              far={1.1}
              blur={2.6}
              opacity={0.62}
              resolution={settings.contactResolution}
              color="#1b1f24"
            />
            </CarShadow>
          )}
          {settings.shadows && <ShadowMapGate />}
          <CameraRig />
          {/* Arrow-key driving, same reachability rule as the door button. Ordered
              first so DriveCamera reads this frame's car position, not last frame's. */}
          {driveable && <DriveControls />}
          {/* Wheels roll and steer off the same state. Mounted here rather than
              inside ProceduralCar because it borrows rotation.x from the assembly
              timeline and has to hand it back — see WheelMotion. */}
          {driveable && <WheelMotion />}
          {/* Free-look orbit and the drive chase camera trade the view back and
              forth via isCarAway() — see FreeLookControls' `away` check. */}
          {freeLook && <FreeLookControls />}
          {driveable && <DriveCamera />}
          {debugEnabled() && <DebugBridge />}
          <AdaptiveQuality />
          {settings.post && <PostFX ao={settings.ao} />}
          </GarageEnvironment>
        </Suspense>
      </Canvas>
    </div>
  )
}
