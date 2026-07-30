import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import { PMREMGenerator } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EnvironmentContext } from './environmentContext'

/**
 * Builds a procedural environment map and provides it to descendants.
 *
 * Without an env map, every material with metalness > 0 renders near-black: a
 * metal's colour comes almost entirely from what it reflects. RoomEnvironment is
 * generated in-memory from three's own geometry — no HDRI download, no CDN.
 *
 * Built in useMemo rather than useEffect so the texture exists on the first
 * render pass; materials read it at construction time and would otherwise be
 * created with a null envMap and never updated.
 */
export function GarageEnvironment({ children }: { children: ReactNode }) {
  const gl = useThree((s) => s.gl)

  const target = useMemo(() => {
    const pmrem = new PMREMGenerator(gl)
    const room = new RoomEnvironment()
    // Blur slightly: a sharp procedural room shows its box walls as hard bands
    // in the reflections on flat body panels.
    const result = pmrem.fromScene(room, 0.05)

    room.traverse((object) => {
      const mesh = object as { geometry?: { dispose(): void }; material?: { dispose(): void } }
      mesh.geometry?.dispose()
      mesh.material?.dispose()
    })
    pmrem.dispose()
    return result
  }, [gl])

  useEffect(() => {
    return () => {
      target.dispose()
    }
  }, [target])

  return (
    <EnvironmentContext.Provider value={target.texture}>{children}</EnvironmentContext.Provider>
  )
}
