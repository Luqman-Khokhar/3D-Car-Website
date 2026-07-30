import { createContext, useContext } from 'react'
import type { Texture } from 'three'

/**
 * The PMREM environment map, shared with whatever needs reflections.
 *
 * Deliberately NOT assigned to `scene.environment`. That applies IBL to every
 * fragment in the scene, and the garage shell covers the whole screen — measured
 * at a 7fps cost on an iGPU for walls that are matte concrete and reflect
 * nothing. Consumers opt in per material instead.
 */
export const EnvironmentContext = createContext<Texture | null>(null)

export function useEnvironmentMap() {
  return useContext(EnvironmentContext)
}
