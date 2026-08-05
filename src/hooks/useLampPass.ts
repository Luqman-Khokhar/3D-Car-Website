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
const LAMP_RED_BASE = 1.9
/** Multiplier added on top at full glow. Chosen so the lamps clear the bloom
 *  threshold (0.9 in PostFX) by a wide margin rather than by a hair. */
const LAMP_WHITE_GAIN = 3.6
// Lower than the white side on purpose. Red's luminance coefficient is a fifth of
// green's, so a red emissive has to run much hotter than a white one to cross the
// same bloom threshold — and pushed that far it stops looking red.
const LAMP_RED_GAIN = 1.15

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
