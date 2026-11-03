import { lazy, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, Object3D, Vector3 } from 'three'
import type { AmbientLight, DirectionalLight, HemisphereLight, PointLight, SpotLight } from 'three'
import { lightingState, roomDim, stripRowLevel } from '@/animations/lightingState'
import { outsideBlend } from '@/animations/driveState'
import { GARAGE_WALL, GARAGE_FLOOR } from '@/scenes/palette'
import { useSceneStore } from '@/store/useSceneStore'
import type { LightSwitchState } from '@/store/useSceneStore'
import { requestFrame } from '@/lib/frame'

/** The six area lights and their 241 kB LTC tables, only fetched by the high
 *  tier. Mounted inside the canvas' scene Suspense, so the first frame waits for
 *  it and shaders compile once with the final light count. */
const CeilingStrips = lazy(() => import('./CeilingStrips'))

/**
 * How much of each light survives a full blackout (`dim === 1`).
 *
 * The fixtures go almost all the way out — that is the effect. The hemisphere
 * and ambient terms keep a little more, because at literal zero the car stops
 * having a silhouette and the headlight scene turns into two glowing rings
 * floating in a void. 8% is enough to keep an edge without competing with the
 * lamps.
 */
const FIXTURE_FLOOR = 0.03
const FILL_FLOOR = 0.05

/** Peak candela of the headlight beam at `frontGlow === 1`. One spot on the car's
 *  centreline rather than one per lamp: the two cones overlapped into a single
 *  pool by the time they reached the floor, and every light in the scene is paid
 *  for by every lit fragment on screen whether it is switched on or not — at zero
 *  intensity included. Wider and brighter than either of the old pair so the
 *  pool keeps its width and its centre. */
const BEAM_INTENSITY = 130
/**
 * Peak intensity of the red wash the tail lamp throws behind the car — one light
 * on the centreline now, for the same light-count reason as the beam above, so
 * this is a little over one old half's worth rather than two.
 *
 * Very low. The lens is a large emissive panel and carries the shot on its own;
 * this only has to put a hint of red on the bumper and the floor. Every value
 * tried above this washed the whole tail — deck lid, quarters, roof — in flat
 * red, which turns the shot into a colour filter over a car rather than a car
 * with its lights on.
 */
const TAIL_WASH_INTENSITY = 0.3

/** Baseline intensities, so the dim driver has something to scale against
 *  without re-reading JSX defaults. Must stay in step with the elements below. */
const BASE = {
  hemisphere: 1.15,
  ambient: 0.14,
  spot: 150,
  bounce: 0.42,
  doorFill: 0.5,
  ceilingBounce: 0.38,
}

/**
 * The door-side fill doubles as the sun on the circuit. It used to be a separate
 * directional light that sat at zero intensity for the whole scroll story and
 * was still paid for by every lit pixel; the fill's own job ends where the sun's
 * begins (once the car is through the door the room fixtures are behind it), so
 * one light now slides from one role to the other on the same ramp as the
 * outside air. Deliberately not dimmed by the blackout once outside: outside is
 * daylight, the same reason OutsideWorld and RaceTrack are unlit.
 */
const DOOR_FILL_POSITION = new Vector3(2, 4, 9)
const DOOR_FILL_COLOR = new Color('#e8e2d0')
const SUN_POSITION = new Vector3(16, 24, -9)
const SUN_COLOR = new Color('#fff4e4')
const SUN_INTENSITY = 1.35

function level(dim: number, floor: number) {
  return 1 - (1 - floor) * dim
}

/**
 * Time constant (seconds) each switched circuit takes to reach a thrown switch's
 * target, as an exponential approach rather than a snap — a tube visibly ramps
 * rather than popping to full output.
 */
export const CEILING_FADE = 0.35

/** Below this the approach snaps, so a fade has a last frame instead of an
 *  asymptote — the demand-driven render loop stops asking for frames there. */
const APPROACH_EPSILON = 0.001

export function approach(current: number, target: number, dt: number, tau: number) {
  const next = current + (target - current) * (1 - Math.exp(-dt / tau))
  return Math.abs(target - next) < APPROACH_EPSILON ? target : next
}

/** null = follow the scroll-scrubbed atmosphere untouched; 0/1 = a thrown switch. */
export function switchTarget(state: LightSwitchState): number | null {
  if (state === 'off') return 0
  if (state === 'on') return 1
  return null
}

/**
 * Every light in the room, plus the car's own lamps, driven off `lightingState`.
 *
 * These are grouped in one component rather than left inline in SceneCanvas
 * because the two lighting scenes scale all of them together: dimming the ceiling
 * strips but not the spotlight, or the fixtures but not the fill, gives a room
 * that changes colour rather than one that gets dark. One frame loop over one set
 * of refs is also the only way to do this without re-rendering the canvas tree on
 * every scroll tick.
 *
 * The car's headlight and tail-lamp sources are mounted unconditionally and
 * animated from zero intensity, never mounted and unmounted. three keys its
 * shader programs off the light counts in the scene, so adding a spotlight
 * mid-scroll recompiles every material in the frame it appears — a visible hitch
 * at exactly the moment the scene is meant to be at its most dramatic.
 */
export function GarageLights({ shadows, areaLights }: { shadows: boolean; areaLights: boolean }) {
  const tubeBackSwitch = useSceneStore((s) => s.lightSwitches.tubeBack)
  const tubeMidSwitch = useSceneStore((s) => s.lightSwitches.tubeMid)
  const tubeFrontSwitch = useSceneStore((s) => s.lightSwitches.tubeFront)

  // Current position of each switched circuit's exponential approach, 0..1.
  // Seeded at 1 (fully on) to match the hero scene's baseline so a stored 'off'
  // from a previous visit fades down on mount instead of jump-cutting dark.
  const backLevel = useRef(1)
  const midLevel = useRef(1)
  const frontLevel = useRef(1)

  const hemisphere = useRef<HemisphereLight>(null)
  const ambient = useRef<AmbientLight>(null)
  const spot = useRef<SpotLight>(null)
  const bounce = useRef<DirectionalLight>(null)
  const doorFill = useRef<DirectionalLight>(null)
  const ceilingBounce = useRef<DirectionalLight>(null)
  const beam = useRef<SpotLight>(null)
  const tail = useRef<PointLight>(null)

  // A spotlight aims at its `target`, which defaults to an Object3D at the world
  // origin — i.e. straight back into the car it is mounted on. This sits well
  // ahead of the nose so the beam throws down the bay, and it is mounted via
  // <primitive> below because a target only tracks if it is in the scene graph.
  const beamTarget = useMemo(() => new Object3D(), [])

  useEffect(() => {
    if (beam.current) beam.current.target = beamTarget
  }, [beamTarget])

  useFrame((_state, dt) => {
    const { dim, rearGlow, frontGlow } = lightingState
    const fixtureAuto = level(dim, FIXTURE_FLOOR)
    const fillAuto = level(dim, FILL_FLOOR)

    // A thrown switch (`on`/`off`) wins over the scroll-scrubbed atmosphere and
    // free look both — it eases toward 0 or 1 and stays there regardless of what
    // scene the camera is in. `auto` leaves the circuit on the timeline, exactly
    // as before this existed.
    const backTarget = switchTarget(tubeBackSwitch)
    const midTarget = switchTarget(tubeMidSwitch)
    const frontTarget = switchTarget(tubeFrontSwitch)

    if (backTarget !== null) backLevel.current = approach(backLevel.current, backTarget, dt, CEILING_FADE)
    if (midTarget !== null) midLevel.current = approach(midLevel.current, midTarget, dt, CEILING_FADE)
    if (frontTarget !== null) frontLevel.current = approach(frontLevel.current, frontTarget, dt, CEILING_FADE)
    // Still fading toward a thrown switch: keep the demand loop drawing.
    if (
      (backTarget !== null && backLevel.current !== backTarget) ||
      (midTarget !== null && midLevel.current !== midTarget) ||
      (frontTarget !== null && frontLevel.current !== frontTarget)
    ) {
      requestFrame()
    }

    // Each row lights its own pair of strips independently...
    const backFixture = backTarget !== null ? backLevel.current : fixtureAuto
    const midFixture = midTarget !== null ? midLevel.current : fixtureAuto
    const frontFixture = frontTarget !== null ? frontLevel.current : fixtureAuto

    // ...but the room's general ambience (hemisphere/ambient/bounce/fill) isn't
    // tied to any one row, so it tracks the average of whichever rows are
    // thrown, falling back to the scroll-scrubbed atmosphere when none are.
    const anyTubeThrown = backTarget !== null || midTarget !== null || frontTarget !== null
    const tubeAvg = (backFixture + midFixture + frontFixture) / 3
    const fixture = anyTubeThrown ? tubeAvg : fixtureAuto
    const fill = anyTubeThrown ? tubeAvg : fillAuto

    // Background/fog have to darken in step with the room, same reasoning as
    // NightPass's own comment: a switch that blacks out the fixtures but leaves
    // the wall at daylight colour reads as a rendering bug, not a dark garage.
    roomDim.value = anyTubeThrown ? 1 - tubeAvg : dim

    if (hemisphere.current) hemisphere.current.intensity = BASE.hemisphere * fill
    if (ambient.current) ambient.current.intensity = BASE.ambient * fill
    // Was fixtureAuto (scroll-only) — the gantry lamp sat at full brightness
    // through a manual blackout while every other fixture obeyed the switches.
    if (spot.current) spot.current.intensity = BASE.spot * fixture
    if (bounce.current) bounce.current.intensity = BASE.bounce * fixture
    if (doorFill.current) {
      const sun = outsideBlend()
      const light = doorFill.current
      light.intensity = BASE.doorFill * fixture * (1 - sun) + SUN_INTENSITY * sun
      light.position.lerpVectors(DOOR_FILL_POSITION, SUN_POSITION, sun)
      light.color.lerpColors(DOOR_FILL_COLOR, SUN_COLOR, sun)
    }
    if (ceilingBounce.current) ceilingBounce.current.intensity = BASE.ceilingBounce * fixture
    // Area lights read this from their own chunk; see CeilingStrips.
    stripRowLevel[0] = backFixture
    stripRowLevel[1] = midFixture
    stripRowLevel[2] = frontFixture

    // The car's own lamps run the other way: they are worth nothing in a lit room
    // and everything in a dark one, so the drive is the glow channel scaled by how
    // dark it has got. Without the `dim` term the beams wash out the garage during
    // the scenes either side, where the lamps are installed but the lights are on.
    if (beam.current) beam.current.intensity = BEAM_INTENSITY * frontGlow * dim
    if (tail.current) tail.current.intensity = TAIL_WASH_INTENSITY * rearGlow * dim
  })

  return (
    <>
      {/* Room fill. This was a flat ambientLight at 0.62, which is the most
          effective way to destroy form there is: it adds the same value to
          every fragment regardless of which way it faces, so shading loses its
          gradient and the whole scene goes papery. A hemisphere light costs
          the same and carries a direction — sky above, bounced floor below.
          The garage shell is Lambert with no IBL, so this is all it gets, and
          the values are picked to hold the room at its previous exposure. */}
      <hemisphereLight ref={hemisphere} args={[GARAGE_WALL, GARAGE_FLOOR, BASE.hemisphere]} />
      {/* What is left of the old ambient: just enough to keep deep corners off
          pure black, low enough not to flatten anything. */}
      <ambientLight ref={ambient} intensity={BASE.ambient} />
      {/* Overhead work light, roughly where a garage gantry lamp would sit. */}
      <spotLight
        ref={spot}
        position={[3.2, 7.5, 4.2]}
        angle={0.62}
        penumbra={0.85}
        intensity={BASE.spot}
        castShadow={shadows}
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
      <directionalLight ref={bounce} position={[-5, 3, -6]} intensity={BASE.bounce} color="#cfc6b4" />
      {/* Fill from the door/window side. Required, not decorative: the tool
          wall faces +Z, and neither the -Z directional above nor the tight
          spotlight cone reaches it, so without this it renders ambient-only
          and every prop on it reads as a dark smudge. */}
      <directionalLight ref={doorFill} position={DOOR_FILL_POSITION.toArray()} intensity={BASE.doorFill} color={DOOR_FILL_COLOR} />
      {/* Light travelling upward, standing in for the floor bounce.
          Everything facing down — the ceiling deck, the underside of every joist,
          the shelf soffits, the flange of the door track — is lit by nothing
          otherwise: the hemisphere gives downward normals the dark floor colour,
          the area lights point away, and the spotlight is above the roof. The
          result was a black band across the top of every wide shot, which is
          also where all the new structure lives. */}
      <directionalLight
        ref={ceilingBounce}
        position={[0, -3, 0]}
        intensity={BASE.ceilingBounce}
        color="#d8d0c0"
      />
      {/* Six ceiling strips as RectAreaLights — high tier only, and in their own
          chunk; see CeilingStrips for why they exist and what they cost. */}
      {areaLights && <CeilingStrips />}
      {/* --- The car's headlights as a real light source. Emissive geometry plus
          bloom makes a lamp look lit; only an actual beam makes the room look lit
          *by* it, and the second is what sells the blackout — a pool on the
          floor ahead of the nose, and the far wall picking it up.

          Mounted on the car's centreline at lens height from `lamps_front` in
          carParts.ts and aimed at a target 14 m down the bay, which is past the
          +Z wall at 9.6 so the cone stays wide open across the whole throw. No
          shadows: a shadow-casting spotlight is the most expensive light in the
          scene and there is nothing between this and the floor to occlude. */}
      <primitive object={beamTarget} position={[0, 0.1, 14]} />
      <spotLight
        ref={beam}
        position={[0, 0.75, 2.06]}
        angle={0.5}
        penumbra={0.7}
        intensity={0}
        distance={26}
        decay={1.5}
        color="#fff0d2"
      />
      {/* Tail lamp spill. A point light rather than a spot: the lamp's job here is
          to stain the bumper, the plate and the floor immediately behind the car
          red, not to throw a beam. Short `distance` keeps that wash local so it
          never tints the back wall — at anything longer the inverse-square falloff
          still reaches the roof and the whole car turns pink. One on the
          centreline rather than one per side, for the same light-count reason as
          the beam above.

          Kept well clear of the lens — below it and behind the bumper face.
          A lamp must not light its own lens, and with decay 2 a light sitting
          100 mm off the panel puts an irradiance of ~45 on it: the lens then reads
          as a lit surface rather than a glowing one, and no change to its emissive
          moves it at all, because the emissive stopped being what you were looking
          at. That bug cost an afternoon; the distance is the fix. */}
      <pointLight ref={tail} position={[0, 0.7, -2.6]} intensity={0} distance={3.2} decay={2} color="#ff2a18" />
    </>
  )
}
