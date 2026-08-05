import { useEffect, useMemo } from 'react'
import { MeshStandardMaterial, MeshPhysicalMaterial, Vector2 } from 'three'
import type { Material } from 'three'
import type { MaterialKey } from '@/scenes/carParts'
import { PRIMER } from '@/scenes/palette'
import { useEnvironmentMap } from '@/components/3d/environmentContext'
import { usePaintPass } from '@/hooks/usePaintPass'
import { useLampPass, ENV_INTENSITY } from '@/hooks/useLampPass'
import { createOrangePeelNormalMap } from '@/lib/surfaceTextures'

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

  // Orange peel. Built once and shared by the one material that wants it; see
  // src/lib/surfaceTextures.ts for why it goes on the clear layer only.
  const orangePeel = useMemo(() => createOrangePeelNormalMap(), [])
  useEffect(() => () => orangePeel.dispose(), [orangePeel])

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
        clearcoatNormalMap: orangePeel,
        // Deliberately tiny. Above ~0.1 the panels start to look hammered; the
        // point is to make the highlight ripple, not to add visible texture.
        clearcoatNormalScale: new Vector2(0.055, 0.055),
      }),
      rawMetal: new MeshStandardMaterial({
        color: '#8d939b',
        metalness: 0.92,
        roughness: 0.42,
      }),
      // Hoses and drive belts. Moulded rubber, which is glossier than anything on
      // a tyre — that is why the tyre no longer shares this.
      rubber: new MeshStandardMaterial({
        color: '#1b1d20',
        metalness: 0.05,
        roughness: 0.72,
      }),
      // A tyre is two different surfaces. Tread is matte and slightly dusty;
      // sidewall is satin, because it is moulded rather than worn. One material
      // for both is what makes a wheel read as a solid black doughnut.
      tyreTread: new MeshStandardMaterial({
        color: '#131519',
        metalness: 0.02,
        roughness: 0.96,
      }),
      tyreSidewall: new MeshStandardMaterial({
        color: '#191b1f',
        metalness: 0.03,
        roughness: 0.66,
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
      // Polished, mirror-grade. Reserved for the exhaust tips, which are the only
      // chromed things on the car and want a much sharper reflection than a rim.
      chrome: new MeshStandardMaterial({
        color: '#e2e6ea',
        metalness: 1,
        roughness: 0.06,
      }),
      // Painted caliper. The one saturated accent behind an open wheel.
      caliper: new MeshStandardMaterial({
        color: '#8f2019',
        metalness: 0.2,
        roughness: 0.44,
      }),
      // Near-black, almost matte, near-dielectric. Grille apertures, lamp
      // housings, glass frit, and the plate behind every closure panel. It has to
      // stay genuinely dark under IBL or shut lines stop reading as gaps, which
      // is why metalness is 0 — a metal here would pick up the environment and
      // glow grey.
      shadow: new MeshStandardMaterial({
        color: '#0b0d10',
        metalness: 0,
        roughness: 0.68,
      }),
      // Reflective sheeting, as number plates actually are.
      plate: new MeshStandardMaterial({
        color: '#d8d4c6',
        metalness: 0.05,
        roughness: 0.36,
      }),
      // Lamps are emissive rather than lit: a headlight reads as a light source,
      // and a merely-white box in shadow reads as a sticker.
      //
      // These now run well above 1. Previously they had to be held under 1 or
      // they clipped to flat rectangles, because the only thing downstream was
      // the tone map. With bloom in the chain the overflow goes somewhere — it
      // becomes glow around the lens instead of a blown-out plateau on it — and
      // an emissive under 1 no longer crosses the bloom threshold at all.
      lampWhite: new MeshStandardMaterial({
        color: '#cdd3d8',
        emissive: '#ffeec9',
        emissiveIntensity: 2.4,
        metalness: 0.3,
        roughness: 0.16,
      }),
      // Driven much harder than the headlights by useLampPass, so the emissive is
      // near-primary rather than the softer '#e02318' it used to be. A partly
      // desaturated red desaturates further as it climbs — by the time it is
      // bright enough to bloom it has gone pink, then white, and a white tail lamp
      // is not a tail lamp. Keeping green and blue almost at zero means the extra
      // radiance can only ever make it a brighter red.
      lampRed: new MeshStandardMaterial({
        color: '#5e1114',
        emissive: '#ff1405',
        emissiveIntensity: 1.9,
        metalness: 0,
        roughness: 0.28,
      }),
    }),
    [orangePeel],
  )

  // The car is the one thing that must reflect its surroundings, so IBL is
  // applied here per material rather than scene-wide. See environmentContext.ts.
  useEffect(() => {
    for (const material of Object.values(materials)) {
      const reflective = material as { envMap?: unknown; envMapIntensity?: number; needsUpdate?: boolean }
      reflective.envMap = envMap
      // Raised from 0.85 now that the flat ambient light is gone: with the fill
      // coming from the image-based lighting instead, this is what carries the
      // car's exposure, and it is the term that gives shading actual gradient.
      // useLampPass owns it from here, pulling it down for the blackout scene.
      reflective.envMapIntensity = ENV_INTENSITY
      reflective.needsUpdate = true
    }
  }, [materials, envMap])

  useEffect(() => {
    return () => {
      for (const material of Object.values(materials)) material.dispose()
    }
  }, [materials])

  // Lives here rather than in the car component so the swap to a real GLB cannot
  // silently lose the paint scene: whoever owns bodyPaint owns painting it. Same
  // argument for the lamp/atmosphere pass below.
  usePaintPass(materials.bodyPaint)
  useLampPass(materials)

  return materials
}
