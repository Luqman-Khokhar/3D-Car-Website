import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Object3D } from 'three'
import type { AmbientLight, DirectionalLight, HemisphereLight, PointLight, RectAreaLight, SpotLight } from 'three'
import { lightingState } from '@/animations/lightingState'
import { GARAGE_WALL, GARAGE_FLOOR } from '@/scenes/palette'
import { ROOM_HEIGHT } from '@/scenes/garage'

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

/** Peak candela of one headlight beam at `frontGlow === 1`. */
const BEAM_INTENSITY = 78
/** Peak intensity of the red wash one tail cluster throws behind the car. Kept
 *  deliberately low: at anything higher the inverse-square falloff still reaches
 *  the roof and the whole car turns pink, which reads as a tinted render rather
 *  than as lamps lighting what is near them. */
const TAIL_WASH_INTENSITY = 2.2

/** Baseline intensities, so the dim driver has something to scale against
 *  without re-reading JSX defaults. Must stay in step with the elements below. */
const BASE = {
  hemisphere: 1.15,
  ambient: 0.14,
  spot: 150,
  bounce: 0.42,
  doorFill: 0.5,
  strip: 22,
}

function level(dim: number, floor: number) {
  return 1 - (1 - floor) * dim
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
export function GarageLights({ lowPower }: { lowPower: boolean }) {
  const hemisphere = useRef<HemisphereLight>(null)
  const ambient = useRef<AmbientLight>(null)
  const spot = useRef<SpotLight>(null)
  const bounce = useRef<DirectionalLight>(null)
  const doorFill = useRef<DirectionalLight>(null)
  const stripL = useRef<RectAreaLight>(null)
  const stripR = useRef<RectAreaLight>(null)
  const beamL = useRef<SpotLight>(null)
  const beamR = useRef<SpotLight>(null)
  const tailL = useRef<PointLight>(null)
  const tailR = useRef<PointLight>(null)

  // A spotlight aims at its `target`, which defaults to an Object3D at the world
  // origin — i.e. straight back into the car it is mounted on. These sit well
  // ahead of the nose so the beams throw down the bay, and they are mounted via
  // <primitive> below because a target only tracks if it is in the scene graph.
  const beamTargets = useMemo(() => [new Object3D(), new Object3D()], [])

  useEffect(() => {
    if (beamL.current) beamL.current.target = beamTargets[0]
    if (beamR.current) beamR.current.target = beamTargets[1]
  }, [beamTargets])

  useFrame(() => {
    const { dim, rearGlow, frontGlow } = lightingState
    const fixture = level(dim, FIXTURE_FLOOR)
    const fill = level(dim, FILL_FLOOR)

    if (hemisphere.current) hemisphere.current.intensity = BASE.hemisphere * fill
    if (ambient.current) ambient.current.intensity = BASE.ambient * fill
    if (spot.current) spot.current.intensity = BASE.spot * fixture
    if (bounce.current) bounce.current.intensity = BASE.bounce * fixture
    if (doorFill.current) doorFill.current.intensity = BASE.doorFill * fixture
    if (stripL.current) stripL.current.intensity = BASE.strip * fixture
    if (stripR.current) stripR.current.intensity = BASE.strip * fixture

    // The car's own lamps run the other way: they are worth nothing in a lit room
    // and everything in a dark one, so the drive is the glow channel scaled by how
    // dark it has got. Without the `dim` term the beams wash out the garage during
    // the scenes either side, where the lamps are installed but the lights are on.
    const beam = BEAM_INTENSITY * frontGlow * dim
    if (beamL.current) beamL.current.intensity = beam
    if (beamR.current) beamR.current.intensity = beam

    const wash = TAIL_WASH_INTENSITY * rearGlow * dim
    if (tailL.current) tailL.current.intensity = wash
    if (tailR.current) tailR.current.intensity = wash
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
      <directionalLight ref={bounce} position={[-5, 3, -6]} intensity={BASE.bounce} color="#cfc6b4" />
      {/* Fill from the door/window side. Required, not decorative: the tool
          wall faces +Z, and neither the -Z directional above nor the tight
          spotlight cone reaches it, so without this it renders ambient-only
          and every prop on it reads as a dark smudge. */}
      <directionalLight ref={doorFill} position={[2, 4, 9]} intensity={BASE.doorFill} color="#e8e2d0" />
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
            ref={stripL}
            position={[-3.4, ROOM_HEIGHT - 0.24, 1.4]}
            rotation={[-Math.PI / 2, 0, 0]}
            width={0.3}
            height={2.4}
            intensity={BASE.strip}
            color="#fff4de"
          />
          <rectAreaLight
            ref={stripR}
            position={[1.6, ROOM_HEIGHT - 0.24, 1.4]}
            rotation={[-Math.PI / 2, 0, 0]}
            width={0.3}
            height={2.4}
            intensity={BASE.strip}
            color="#fff4de"
          />
        </>
      )}
      {/* --- The car's headlights as real light sources. Emissive geometry plus
          bloom makes a lamp look lit; only an actual beam makes the room look lit
          *by* it, and the second is what sells the blackout — two cones on the
          floor ahead of the nose, and the far wall picking up a pool.

          Mounted at the lens positions from `lamps_front` in carParts.ts and aimed
          at targets 14 m down the bay, which is past the +Z wall at 9.6 so the
          cones stay wide open across the whole throw. No shadows: a shadow-casting
          spotlight is the most expensive light in the scene and there is nothing
          between these and the floor to occlude. */}
      <primitive object={beamTargets[0]} position={[-0.9, 0.1, 14]} />
      <primitive object={beamTargets[1]} position={[0.9, 0.1, 14]} />
      <spotLight
        ref={beamL}
        position={[-0.58, 0.75, 2.06]}
        angle={0.42}
        penumbra={0.65}
        intensity={0}
        distance={26}
        decay={1.5}
        color="#fff0d2"
      />
      <spotLight
        ref={beamR}
        position={[0.58, 0.75, 2.06]}
        angle={0.42}
        penumbra={0.65}
        intensity={0}
        distance={26}
        decay={1.5}
        color="#fff0d2"
      />
      {/* Tail clusters. Point lights rather than spots: a tail lamp's job here is
          to stain the bumper, the diffuser and the floor immediately behind the
          car red, not to throw a beam. Short `distance` keeps that wash local so
          it never tints the back wall. */}
      <pointLight ref={tailL} position={[-0.6, 0.79, -2.02]} intensity={0} distance={2.6} decay={2} color="#ff2a18" />
      <pointLight ref={tailR} position={[0.6, 0.79, -2.02]} intensity={0} distance={2.6} decay={2} color="#ff2a18" />
    </>
  )
}
