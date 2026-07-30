import { ProceduralCar } from './ProceduralCar'

/**
 * Single swap point between the procedural rig and a real model.
 *
 * To use a real GLB, drop it at public/models/car.glb following the naming and
 * scale contract in public/models/README.md, then replace the body of this
 * component with:
 *
 *   const { scene } = useGLTF('/models/car.glb')
 *   // register each named node so the timelines can find it
 *   useEffect(() => {
 *     for (const id of PART_IDS) {
 *       registerPart(id, scene.getObjectByName(id) ?? null)
 *     }
 *     return clearRegistry
 *   }, [scene])
 *   return <primitive object={scene} />
 *
 * plus `useGLTF.preload('/models/car.glb')` at module scope. Nothing in
 * src/animations/ needs to change, because both paths populate partRegistry
 * with the same ids.
 */
export function CarModel() {
  return <ProceduralCar />
}
