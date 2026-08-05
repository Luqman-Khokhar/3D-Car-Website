import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color } from 'three'
import type { MeshPhysicalMaterial } from 'three'
import { paintState } from '@/animations/paintState'
import { PRIMER } from '@/scenes/palette'

/**
 * Never let clearcoat reach exactly 0. three keys the USE_CLEARCOAT shader define
 * off `clearcoat > 0`, so crossing zero recompiles the program mid-scroll — a
 * visible hitch on the first frame of the paint scene. A floor this low is
 * indistinguishable from no clearcoat but keeps the define, and the program,
 * stable for the whole scrub.
 */
const CLEARCOAT_FLOOR = 0.02

/**
 * Endpoints of the paint scene. Primer is a flat, chalky, barely-metallic
 * surface; the base coat is metallic flake under clearcoat. Roughness has to
 * travel too — a colour-only swap reads as a texture change, not as paint.
 */
export const PRIMER_SURFACE = {
  metalness: 0.1,
  roughness: 0.72,
  clearcoat: CLEARCOAT_FLOOR,
  clearcoatRoughness: 0.4,
}
export const PAINTED_SURFACE = {
  metalness: 0.62,
  roughness: 0.34,
  clearcoat: 1,
  clearcoatRoughness: 0.06,
}

const PRIMER_COLOR = new Color(PRIMER)

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t
}

/**
 * Pure application of a 0..1 paint progress onto a material. Split out of the
 * hook so it can run without a renderer — and so a real-GLB path can paint its
 * own body material with the same curve.
 *
 * Lerps toward paintState.targetColor rather than a fixed constant so a swatch
 * pick repaints without touching the timeline.
 */
export function applyPaint(material: MeshPhysicalMaterial, t: number) {
  material.color.lerpColors(PRIMER_COLOR, paintState.targetColor, t)
  material.metalness = lerp(PRIMER_SURFACE.metalness, PAINTED_SURFACE.metalness, t)
  material.roughness = lerp(PRIMER_SURFACE.roughness, PAINTED_SURFACE.roughness, t)
  material.clearcoat = lerp(PRIMER_SURFACE.clearcoat, PAINTED_SURFACE.clearcoat, t)
  material.clearcoatRoughness = lerp(
    PRIMER_SURFACE.clearcoatRoughness,
    PAINTED_SURFACE.clearcoatRoughness,
    t,
  )
}

/**
 * Drives the `bodyPaint` material off the scrubbed timeline.
 *
 * The material is shared by every painted panel, so one lerp per frame repaints
 * the whole car. Skipped when neither progress nor the target colour has moved,
 * which is every frame outside the paint scene with the default swatch.
 *
 * colorGeneration is tracked separately from progress: after the scrub has
 * settled at t=1 (or is pinned there by reduced motion), picking a new swatch
 * does not change progress at all, so progress alone would never re-fire.
 */
export function usePaintPass(material: MeshPhysicalMaterial) {
  const applied = useRef(-1)
  const appliedGeneration = useRef(-1)

  useFrame(() => {
    const t = paintState.progress
    const generation = paintState.colorGeneration
    if (t === applied.current && generation === appliedGeneration.current) return
    applied.current = t
    appliedGeneration.current = generation
    applyPaint(material, t)
  })
}
