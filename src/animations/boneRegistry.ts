import type { Object3D } from 'three'

/**
 * Same bridge as partRegistry, for the robot's internal structure.
 *
 * Kept separate rather than folded into partRegistry because that map is typed on
 * PartId and its contents are what buildAssemblyTimeline walks — a limb in there
 * would either need a scroll scene to install it or would be silently skipped,
 * and `requirePart` throwing on a typo is worth keeping narrow.
 */
const registry = new Map<string, Object3D>()

export function registerBone(id: string, object: Object3D | null) {
  if (object) registry.set(id, object)
  else registry.delete(id)
}

export function getBone(id: string): Object3D | undefined {
  return registry.get(id)
}

export function clearBoneRegistry() {
  registry.clear()
}
