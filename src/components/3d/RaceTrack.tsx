import { memo, useEffect, useMemo } from 'react'
import { DoubleSide, MeshBasicMaterial } from 'three'
import { buildTrackGeometry } from '@/scenes/track'
import { TRACK_BORDER, TRACK_LINE, TRACK_SURFACE } from '@/scenes/palette'

/**
 * The circuit outside the door: white tarmac, dark kerbs, a broken lane line and
 * a start chequer. Geometry comes from src/scenes/track.ts — this file only
 * decides how it is shaded.
 *
 * Unlit MeshBasicMaterial throughout, same call as OutsideWorld: the outside is
 * standing in for open daylight, and it must not dim along with the garage when
 * the blackout driver runs (see Garage.tsx). Lit materials here would also drop
 * the track into near-black the moment the head-lamp scene kills the room.
 *
 * DoubleSide because the bands are generated from a polar sweep whose winding
 * flips through the pinch; the alternative is per-segment winding logic for
 * flat quads nobody can see the back of.
 */
export const RaceTrack = memo(function RaceTrack() {
  const geometry = useMemo(() => buildTrackGeometry(), [])

  const materials = useMemo(
    () => ({
      surface: new MeshBasicMaterial({ color: TRACK_SURFACE, side: DoubleSide, toneMapped: false }),
      border: new MeshBasicMaterial({ color: TRACK_BORDER, side: DoubleSide, toneMapped: false }),
      line: new MeshBasicMaterial({ color: TRACK_LINE, side: DoubleSide, toneMapped: false }),
    }),
    [],
  )

  useEffect(() => {
    return () => {
      for (const value of Object.values(geometry)) value.dispose()
      for (const material of Object.values(materials)) material.dispose()
    }
  }, [geometry, materials])

  return (
    <group name="raceTrack">
      <mesh geometry={geometry.surface} material={materials.surface} />
      <mesh geometry={geometry.apron} material={materials.surface} />
      <mesh geometry={geometry.innerBorder} material={materials.border} />
      <mesh geometry={geometry.outerBorder} material={materials.border} />
      <mesh geometry={geometry.apronBorders} material={materials.border} />
      <mesh geometry={geometry.dashes} material={materials.line} />
      <mesh geometry={geometry.startGrid} material={materials.border} />
    </group>
  )
})
