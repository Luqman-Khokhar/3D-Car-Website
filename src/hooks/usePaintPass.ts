import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color } from 'three'
import type { MeshPhysicalMaterial } from 'three'
import { paintState } from '@/animations/paintState'
import { PRIMER, BODY } from '@/scenes/palette'

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
const BODY_COLOR = new Color(BODY)

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t
}

/**
 * Pure application of a 0..1 paint progress onto a material. Split out of the
 * hook so it can run without a renderer — and so a real-GLB path can paint its
 * own body material with the same curve.
 */
export function applyPaint(material: MeshPhysicalMaterial, t: number) {
  material.color.lerpColors(PRIMER_COLOR, BODY_COLOR, t)
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
 * the whole car. Skipped entirely when progress has not moved, which is every
 * frame outside the paint scene.
 */
export function usePaintPass(material: MeshPhysicalMaterial) {
  const applied = useRef(-1)

  useFrame(() => {
    const t = paintState.progress
    if (t === applied.current) return
    applied.current = t
    applyPaint(material, t)
  })
}
