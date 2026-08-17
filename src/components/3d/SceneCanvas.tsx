import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import { ACESFilmicToneMapping, Color, NoToneMapping } from 'three'
import type { DirectionalLight, Group } from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
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
import { PostFX } from './PostFX'
import { DebugBridge } from './DebugBridge'
import { debugEnabled } from '@/lib/debug'
import { roomDim } from '@/animations/lightingState'
import { driveState } from '@/animations/driveState'
import { DOOR_Z } from '@/scenes/garage'
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

/** Depth past the door plane over which the world fades to white as the car
 *  drives out — see NightPass. Short enough that the whiteout reads as the
 *  car passing through the doorway, not a lingering cross-fade. */
const OUTSIDE_FADE_DEPTH = 4

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

/** How far past the door the car is before the sun is at full strength. Same
 *  ramp as the air colour, so the light and the haze arrive together. */
const outsideBlend = () =>
  Math.min(Math.max((driveState.z - DOOR_Z) / OUTSIDE_FADE_DEPTH, 0), 1)

/** Peak intensity of the drive-out sun. */
const SUN_INTENSITY = 1.35

/**
 * Sun for the circuit. Every light in GarageLights is a room fixture at a fixed
 * point in the garage — the gantry spot and the six ceiling strips fall off long
 * before the back straight, so a car 60 m out was lit by the hemisphere and two
 * bounce fills only, and read as a grey paper cut-out on white tarmac.
 *
 * Ramped off the car's own position rather than mounted permanently, because the
 * same light indoors would fight the fixtures it is meant to have nothing to do
 * with. Deliberately not dimmed by the blackout driver: outside is daylight, the
 * same reason OutsideWorld and RaceTrack are unlit.
 *
 * No shadow map — a second shadow-casting light is the most expensive thing that
 * could be added here, and the car's grounding outside comes from the contact
 * shadow following it instead.
 */
function OutsideSun() {
  const light = useRef<DirectionalLight>(null)

  useFrame(() => {
    if (light.current) light.current.intensity = SUN_INTENSITY * outsideBlend()
  })

  return <directionalLight ref={light} position={[16, 24, -9]} intensity={0} color="#fff4e4" />
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
        // Framed for the whole 4.3 m car; CameraRig drives it from here on. The
        // far plane has to clear OUTSIDE_FOG_FAR, or the back straight of the
        // circuit is clipped away instead of fading into haze.
        camera={{ position: [4.6, 2.1, 6.4], fov: 38, near: 0.1, far: 260 }}
      >
        <color attach="background" args={[GARAGE_WALL]} />
        {/* Dissolves the far floor into the wall. Without it the 60m plane ends on
            a hard horizon line and the space reads as a void, not a room. */}
        <fog attach="fog" args={[GARAGE_WALL, FOG_NEAR, FOG_FAR]} />
        <ToneMappingPolicy managed={!lowPower} />
        <Suspense fallback={null}>
          <GarageEnvironment>
          <GarageLights lowPower={lowPower} />
          <NightPass />
          <GroundPlane />
          <Garage />
          <GarageDoor />
          {/* Soft occlusion where the car meets the floor. The spotlight shadow
              alone leaves a gap under the sills that reads as the car hovering.
              Still worth its depth pass even with N8AO in the chain: screen-space
              AO only knows about what is on screen, so it cannot darken under a
              car whose underside is facing away from the camera.
              Skipped on low power: this is a full extra depth pass per frame. */}
          <OutsideSun />
          {!lowPower && (
            <CarShadow>
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
            </CarShadow>
          )}
          <CarModel />
          <CameraRig />
          {/* Arrow-key driving, same reachability rule as the door button. Ordered
              first so DriveCamera reads this frame's car position, not last frame's. */}
          {freeLook && <DriveControls />}
          {/* Wheels roll and steer off the same state. Mounted here rather than
              inside ProceduralCar because it borrows rotation.x from the assembly
              timeline and has to hand it back — see WheelMotion. */}
          {freeLook && <WheelMotion />}
          {/* Free-look orbit and the drive chase camera trade the view back and
              forth via isCarAway() — see FreeLookControls' `away` check. */}
          {freeLook && <FreeLookControls />}
          {freeLook && <DriveCamera />}
          {debugEnabled() && <DebugBridge />}
          {!lowPower && <PostFX />}
          </GarageEnvironment>
        </Suspense>
      </Canvas>
    </div>
  )
}
