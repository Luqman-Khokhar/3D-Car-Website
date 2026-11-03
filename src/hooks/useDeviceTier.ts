import { useEffect } from 'react'
import { useSceneStore } from '@/store/useSceneStore'
import { QUALITY, detectInitialQuality } from '@/lib/quality'

/**
 * Picks the starting render tier once on mount — see src/lib/quality.ts — and
 * starts fetching the tier's optional chunks right away, in parallel with the
 * main 3D bundle, rather than after the canvas mounts and asks for them.
 *
 * Runs in an effect rather than at store creation: probing the GPU means creating
 * a WebGL context, which is not free, and the loading screen should paint first.
 */
export function useDeviceTier() {
  useEffect(() => {
    const { tier, trusted } = detectInitialQuality()
    useSceneStore.getState().setQuality(tier, trusted)

    const settings = QUALITY[tier]
    if (settings.post) void import('@/components/3d/PostFX')
    if (settings.areaLights) void import('@/components/3d/CeilingStrips')
  }, [])
}
