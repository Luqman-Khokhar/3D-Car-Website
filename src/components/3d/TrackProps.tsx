import { memo, useEffect, useMemo } from 'react'
import { MeshBasicMaterial } from 'three'
import { buildTrackProps } from '@/scenes/trackProps'

/**
 * Start gantry, hoardings, tyre barriers, grandstand, trees and cones — one
 * merged geometry, one material, one draw call.
 *
 * vertexColors on an unlit material: the props carry their own baked lighting in
 * the colour attribute (see trackProps.ts). Unlit is not a stylistic choice out
 * here, it is the same constraint the tarmac is under — the outside must not go
 * dark when the garage's blackout driver runs — and a flat unlit box has no
 * form at all, hence the bake.
 *
 * FrontSide, unlike the flat track ribbons: these are closed solids with
 * consistent winding, so half of every box can be culled.
 */
export const TrackProps = memo(function TrackProps() {
  const geometry = useMemo(() => buildTrackProps(), [])
  const material = useMemo(
    () => new MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    [],
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  return <mesh name="trackProps" geometry={geometry} material={material} />
})
