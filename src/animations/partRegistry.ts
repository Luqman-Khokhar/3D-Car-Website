import type { Object3D } from 'three'
import type { PartId } from '@/scenes/carParts'

/**
 * Bridge between the React tree and the GSAP timelines.
 *
 * Timelines live outside React (src/animations/) and need direct Object3D
 * handles to tween `.position` / `.rotation`. Looking parts up by name keeps the
 * timelines identical whether the part came from the procedural rig or from a
 * real GLB — the GLB loader populates this same map by traversing named nodes.
 */
const registry = new Map<PartId, Object3D>()

/** Bumped whenever the registry changes, so consumers can re-bind timelines. */
let generation = 0
const listeners = new Set<() => void>()

function notify() {
  generation++
  for (const listener of listeners) listener()
}

export function registerPart(id: PartId, object: Object3D | null) {
  if (object) registry.set(id, object)
  else registry.delete(id)
  notify()
}

export function getPart(id: PartId): Object3D | undefined {
  return registry.get(id)
}

/** Throws on a missing part: a typo'd id in a timeline should fail loudly. */
export function requirePart(id: PartId): Object3D {
  const object = registry.get(id)
  if (!object) throw new Error(`[partRegistry] part "${id}" is not registered`)
  return object
}

export function getRegisteredIds(): PartId[] {
  return [...registry.keys()]
}

export function clearRegistry() {
  registry.clear()
  notify()
}

export function subscribeRegistry(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getRegistryGeneration() {
  return generation
}
