import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { RectAreaLight } from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { ROOM_HEIGHT } from '@/scenes/garage'
import { STRIP_INTENSITY, STRIP_X, STRIP_Z, stripRowLevel } from '@/animations/lightingState'

// RectAreaLight needs its BRDF lookup tables uploaded before first use or it
// renders black. Idempotent. This import is the reason the file is its own
// chunk: the LTC tables are 241 kB of minified float literals — a fifth of the
// whole 3D bundle — and only the high tier mounts an area light.
RectAreaLightUniformsLib.init()

/**
 * All six ceiling fluorescents, as actual area lights rather than emissive props.
 * A point or spot light can only ever put a round hotspot on a panel; a strip
 * puts a long streak down the flank, and that streak is the most recognisable
 * thing in any photograph of a car. Positions match ceilingLights() in
 * src/scenes/garage.ts, so every fixture the viewer can see overhead actually
 * throws light.
 *
 * Rotating -PI/2 about X aims the light down and lays its height axis along Z,
 * i.e. along the car. Area lights cannot cast shadows and are the most expensive
 * light type per fragment, so only the high tier mounts them (see
 * src/lib/quality.ts); the others still get the streak from the environment map,
 * which carries the same strips.
 *
 * Intensity is written from `stripRowLevel`, which GarageLights fills each frame
 * from the scroll atmosphere and the wall switches. This mounts after
 * GarageLights, so its frame callback runs after that one and reads the current
 * frame's levels rather than the previous frame's.
 */
export default function CeilingStrips() {
  const strips = useRef<(RectAreaLight | null)[]>([])

  useFrame(() => {
    // STRIP_Z is [back, mid, front] and the refs are flattened x-major, so each
    // ref's row is its flat index mod STRIP_Z.length.
    for (let i = 0; i < strips.current.length; i++) {
      const strip = strips.current[i]
      if (strip) strip.intensity = STRIP_INTENSITY * stripRowLevel[i % STRIP_Z.length]
    }
  })

  return (
    <>
      {STRIP_X.map((x, xi) =>
        STRIP_Z.map((z, zi) => (
          <rectAreaLight
            key={`${xi}-${zi}`}
            ref={(el) => {
              strips.current[xi * STRIP_Z.length + zi] = el
            }}
            position={[x, ROOM_HEIGHT - 0.24, z]}
            rotation={[-Math.PI / 2, 0, 0]}
            width={0.3}
            height={2.4}
            intensity={STRIP_INTENSITY}
            color="#fff4de"
          />
        )),
      )}
    </>
  )
}
