import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Material } from 'three'
import { lightingState } from '@/animations/lightingState'

/**
 * Environment contribution in a fully lit garage. Must match the value the
 * envMap effect in useCarMaterials applies, or the first dim tick jumps.
 */
export const ENV_INTENSITY = 1.15
/** Fraction of that removed at full blackout. */
const ENV_DIM = 0.95

/** Always-on emissive levels, from useCarMaterials. */
const LAMP_WHITE_BASE = 2.4
const LAMP_RED_BASE = 0.45
/** Multiplier added on top at full glow. Chosen so the headlights clear the bloom
 *  threshold (0.9 in PostFX) by a wide margin rather than by a hair. */
const LAMP_WHITE_GAIN = 3.6
/**
 * The red side runs an order of magnitude lower, and deliberately below the bloom
 * threshold: it is a broad lit panel, not a point source, so it does not need a
 * halo to read as switched on.
 *
 * The ceiling is set by AgX, not by taste. AgX mixes channels before its curve, so
 * a pure red climbs in green and blue as it brightens and slides toward white.
 * Measured off the rendered frame, the lit panel comes out:
 *
 *   emissive 0.70 -> rgb(203, 75, 57)   red
 *   emissive 0.96 -> rgb(217, 90, 71)   red-orange
 *   emissive 4.65 -> rgb(255, 175, 153) salmon
 *
 * Base times (1 + gain) lands on 0.70. Fourteen points of brightness is a cheap
 * price for the difference between a tail lamp and a sunburn.
 */
const LAMP_RED_GAIN = 0.55

interface Emissive {
  emissiveIntensity: number
}

interface Reflective {
  envMapIntensity: number
}

/**
 * Applies `lightingState` to the car's materials each frame.
 *
 * Two separate jobs, both of which have to happen here rather than in the light
 * rig:
 *
 * The car is lit mostly by its environment map, not by the room's lights. Turning
 * the lights down without also pulling envMapIntensity leaves a fully lit car
 * standing in a dark garage — the single most common way a "night" scene in a
 * three.js project ends up looking wrong.
 *
 * And the lamps have to be driven above their baseline, not merely left on.
 * Bloom keys off luminance, so a lamp that looks lit in a bright room barely
 * blooms at all; the glow that reads as a headlight in the dark needs the
 * emissive itself to climb.
 *
 * Guarded on the state actually changing, so this is a no-op on all but two of
 * the eleven scenes.
 */
export function useLampPass(materials: Record<string, Material>) {
  const appliedDim = useRef(-1)
  const appliedFront = useRef(-1)
  const appliedRear = useRef(-1)

  useFrame(() => {
    const { dim, rearGlow, frontGlow } = lightingState

    if (dim !== appliedDim.current) {
      appliedDim.current = dim
      const intensity = ENV_INTENSITY * (1 - ENV_DIM * dim)
      for (const material of Object.values(materials)) {
        ;(material as unknown as Reflective).envMapIntensity = intensity
      }
    }

    if (frontGlow !== appliedFront.current) {
      appliedFront.current = frontGlow
      ;(materials.lampWhite as unknown as Emissive).emissiveIntensity =
        LAMP_WHITE_BASE * (1 + LAMP_WHITE_GAIN * frontGlow)
    }

    if (rearGlow !== appliedRear.current) {
      appliedRear.current = rearGlow
      ;(materials.lampRed as unknown as Emissive).emissiveIntensity =
        LAMP_RED_BASE * (1 + LAMP_RED_GAIN * rearGlow)
    }
  })
}
