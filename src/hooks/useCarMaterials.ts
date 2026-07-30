import { useEffect, useMemo } from 'react'
import { MeshStandardMaterial, MeshPhysicalMaterial } from 'three'
import type { Material } from 'three'
import type { MaterialKey } from '@/scenes/carParts'
import { PRIMER } from '@/scenes/palette'
import { useEnvironmentMap } from '@/components/3d/environmentContext'
import { usePaintPass } from '@/hooks/usePaintPass'

/**
 * `bodyPaint` is narrowed past `Material` because the paint scene tweens
 * clearcoat, which only exists on MeshPhysicalMaterial. Keeping it in the type
 * means usePaintPass needs no cast.
 */
export type CarMaterials = Record<MaterialKey, Material> & {
  bodyPaint: MeshPhysicalMaterial
}

/**
 * One shared material instance per key, created once and disposed on unmount.
 * `bodyPaint` is deliberately unpainted here — the paint scene swaps its colour
 * and clearcoat, so it must not be shared with trim or raw metal.
 */
export function useCarMaterials(): CarMaterials {
  const envMap = useEnvironmentMap()

  const materials = useMemo<CarMaterials>(
    () => ({
      // Born in primer. usePaintPass below drives this to the metallic base coat
      // under full clearcoat across the paint scene — the clearcoat layer is what
      // separates "painted car" from "coloured plastic", adding a second, much
      // sharper specular lobe on top of the diffuse metallic flake.
      bodyPaint: new MeshPhysicalMaterial({
        color: PRIMER,
        metalness: 0.1,
        roughness: 0.72,
        clearcoat: 0.02,
        clearcoatRoughness: 0.4,
      }),
      rawMetal: new MeshStandardMaterial({
        color: '#8d939b',
        metalness: 0.92,
        roughness: 0.42,
      }),
      rubber: new MeshStandardMaterial({
        color: '#15171a',
        metalness: 0.05,
        roughness: 0.88,
      }),
      // No `transmission`: it makes the renderer re-render the whole scene into a
      // transmission target every frame, which measured at 2fps here. Plain alpha
      // plus a low roughness reads as glass once the HDRI env map lands.
      glass: new MeshPhysicalMaterial({
        color: '#a8c4d4',
        metalness: 0,
        roughness: 0.08,
        transparent: true,
        opacity: 0.28,
        ior: 1.45,
        reflectivity: 0.6,
      }),
      interior: new MeshStandardMaterial({
        color: '#2a2724',
        metalness: 0.02,
        roughness: 0.82,
      }),
      // Cast alloy, not polished steel: high metalness plus a dark base read as a
      // black hole even with IBL, so this trades metalness for a lighter base.
      engine: new MeshStandardMaterial({
        color: '#6d737b',
        metalness: 0.55,
        roughness: 0.55,
      }),
      trim: new MeshStandardMaterial({
        color: '#22252a',
        metalness: 0.4,
        roughness: 0.6,
      }),
      // Heat-stained header steel: warm-tinted and rougher than polished alloy,
      // which is what stops the exhaust reading as chrome.
      exhaust: new MeshStandardMaterial({
        color: '#8d7f72',
        metalness: 0.82,
        roughness: 0.44,
      }),
      // Machined alloy: brighter and sharper than the raw chassis steel so the
      // spokes read against the dark tyre.
      rim: new MeshStandardMaterial({
        color: '#b9bec6',
        metalness: 0.95,
        roughness: 0.19,
      }),
      // Lamps are emissive rather than lit: a headlight reads as a light source,
      // and a merely-white box in shadow reads as a sticker.
      // Tinted rather than pure white, and under 1.0: at 1.5 these clipped to flat
      // white rectangles with no form, which read as stickers.
      lampWhite: new MeshStandardMaterial({
        color: '#cdd3d8',
        emissive: '#ffeec9',
        emissiveIntensity: 0.62,
        metalness: 0.3,
        roughness: 0.16,
      }),
      lampRed: new MeshStandardMaterial({
        color: '#5e1114',
        emissive: '#e02318',
        // Under 1: at 1.15 these clipped to flat saturated orange with no lens form.
        emissiveIntensity: 0.6,
        metalness: 0,
        roughness: 0.28,
      }),
    }),
    [],
  )

  // The car is the one thing that must reflect its surroundings, so IBL is
  // applied here per material rather than scene-wide. See environmentContext.ts.
  useEffect(() => {
    for (const material of Object.values(materials)) {
      const reflective = material as { envMap?: unknown; envMapIntensity?: number; needsUpdate?: boolean }
      reflective.envMap = envMap
      reflective.envMapIntensity = 0.85
      reflective.needsUpdate = true
    }
  }, [materials, envMap])

  useEffect(() => {
    return () => {
      for (const material of Object.values(materials)) material.dispose()
    }
  }, [materials])

  // Lives here rather than in the car component so the swap to a real GLB cannot
  // silently lose the paint scene: whoever owns bodyPaint owns painting it.
  usePaintPass(materials.bodyPaint)

  return materials
}
