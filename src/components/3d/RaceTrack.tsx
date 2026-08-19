import { memo, useEffect, useMemo } from 'react'
import { DoubleSide, MeshBasicMaterial } from 'three'
import { buildTrackGeometry } from '@/scenes/track'
import {
  GRASS_DARK,
  GRASS_LIGHT,
  KERB_RED,
  KERB_WHITE,
  TRACK_BORDER,
  TRACK_LINE,
  TRACK_SURFACE,
} from '@/scenes/palette'
import { TrackProps } from './TrackProps'

/**
 * The circuit outside the door: asphalt, red/white kerbs, painted lines, a
 * striped grass verge and infield, and a start chequer under the gantry.
 * Geometry comes from src/scenes/track.ts and the furniture from
 * src/scenes/trackProps.ts — this file only decides how it is shaded.
 *
 * Unlit MeshBasicMaterial throughout, same call as OutsideWorld: the outside is
 * standing in for open daylight, and it must not dim along with the garage when
 * the blackout driver runs (see Garage.tsx). Lit materials here would also drop
 * the track into near-black the moment the head-lamp scene kills the room.
 *
 * DoubleSide because the bands are generated from a polar sweep whose winding
 * flips through the pinch; the alternative is per-segment winding logic for
 * flat quads nobody can see the back of.
 *
 * Ordering off the ground is by TRACK_Y, not by draw order — see that constant.
 */
export const RaceTrack = memo(function RaceTrack() {
  const geometry = useMemo(() => buildTrackGeometry(), [])

  const materials = useMemo(
    () => ({
      surface: new MeshBasicMaterial({ color: TRACK_SURFACE, side: DoubleSide, toneMapped: false }),
      kerbRed: new MeshBasicMaterial({ color: KERB_RED, side: DoubleSide, toneMapped: false }),
      kerbWhite: new MeshBasicMaterial({ color: KERB_WHITE, side: DoubleSide, toneMapped: false }),
      line: new MeshBasicMaterial({ color: TRACK_LINE, side: DoubleSide, toneMapped: false }),
      dark: new MeshBasicMaterial({ color: TRACK_BORDER, side: DoubleSide, toneMapped: false }),
      grassDark: new MeshBasicMaterial({ color: GRASS_DARK, side: DoubleSide, toneMapped: false }),
      grassLight: new MeshBasicMaterial({ color: GRASS_LIGHT, side: DoubleSide, toneMapped: false }),
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
      <mesh geometry={geometry.grassDark} material={materials.grassDark} />
      <mesh geometry={geometry.grassLight} material={materials.grassLight} />
      <mesh geometry={geometry.surface} material={materials.surface} />
      <mesh geometry={geometry.apron} material={materials.surface} />
      <mesh geometry={geometry.kerbRed} material={materials.kerbRed} />
      <mesh geometry={geometry.kerbWhite} material={materials.kerbWhite} />
      <mesh geometry={geometry.edgeLines} material={materials.line} />
      <mesh geometry={geometry.dashes} material={materials.line} />
      <mesh geometry={geometry.startBand} material={materials.dark} />
      <mesh geometry={geometry.startGrid} material={materials.line} />
      <TrackProps />
    </group>
  )
})
