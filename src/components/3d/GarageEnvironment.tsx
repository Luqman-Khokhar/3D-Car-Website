import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import {
  BoxGeometry,
  BackSide,
  Color,
  LinearSRGBColorSpace,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  PlaneGeometry,
  Scene,
} from 'three'
import { ROOM_HALF_X, ROOM_HALF_Z, ROOM_HEIGHT } from '@/scenes/garage'
import { GARAGE_WALL, GARAGE_FLOOR } from '@/scenes/palette'
import { EnvironmentContext } from './environmentContext'

/** Ceiling strip positions, mirroring `ceilingLights()` in src/scenes/garage.ts.
 *  These have to stay in step: the whole point is that the streak sliding along
 *  the car's flank belongs to a lamp the viewer can actually see overhead. */
const LAMP_X = [-3.4, 1.6]
const LAMP_Z = [-4.6, 1.4, 6.2]
const LAMP_Y = ROOM_HEIGHT - 0.22

/**
 * Linear radiance of the fluorescent tubes. Values above 1 are the entire reason
 * this is built by hand: a light source clamped to white gives a dull, even
 * reflection, and only a genuinely bright one produces the hard specular streak
 * that reads as a photographed car.
 */
const LAMP_RADIANCE: [number, number, number] = [7.5, 7.0, 6.2]

/** Daylight spilling through the sectional door on the +Z wall. */
const DOOR_RADIANCE: [number, number, number] = [1.9, 2.0, 2.15]

function basic(color: Color | string) {
  const material = new MeshBasicMaterial({ toneMapped: false })
  if (color instanceof Color) material.color.copy(color)
  else material.color.set(color)
  return material
}

function radiance([r, g, b]: [number, number, number]) {
  return new Color().setRGB(r, g, b, LinearSRGBColorSpace)
}

/**
 * Builds the environment map the car reflects, and provides it to descendants.
 *
 * Without an env map every material with metalness > 0 renders near-black: a
 * metal's colour comes almost entirely from what it reflects.
 *
 * This used to be three's RoomEnvironment — a generic white studio box. It lit
 * the metals, but everything reflective on the car mirrored a room that was not
 * the room on screen: no floor colour, no tool wall, and lamps in the wrong
 * places. Reflections that disagree with the visible scene are the single
 * loudest "this is CG" cue, because the eye checks them without being asked.
 *
 * So the map is generated from a coarse stand-in for the actual garage: correct
 * dimensions, correct wall and floor colours, and emissive strips at the same
 * coordinates as the real ceiling fixtures. Unlit MeshBasicMaterial throughout,
 * because PMREM only needs radiance — lighting a scene to then capture it is
 * work with no visible result. It stays a stand-in rather than the live scene:
 * ~250 merged garage props would cost six cube faces of real geometry at startup
 * to change a reflection nobody can resolve.
 *
 * Built in useMemo rather than useEffect so the texture exists on the first
 * render pass; materials read it at construction time and would otherwise be
 * created with a null envMap and never updated.
 */
export function GarageEnvironment({ children }: { children: ReactNode }) {
  const gl = useThree((s) => s.gl)

  const target = useMemo(() => {
    const scene = new Scene()
    const disposables: Array<{ dispose(): void }> = []

    const add = (
      geometry: BoxGeometry | PlaneGeometry,
      material: MeshBasicMaterial,
      position: [number, number, number],
      rotation?: [number, number, number],
    ) => {
      const mesh = new Mesh(geometry, material)
      mesh.position.set(...position)
      if (rotation) mesh.rotation.set(...rotation)
      scene.add(mesh)
      disposables.push(geometry, material)
    }

    // Shell, seen from the inside.
    const shell = new BoxGeometry(ROOM_HALF_X * 2, ROOM_HEIGHT, ROOM_HALF_Z * 2)
    const shellMaterial = basic(GARAGE_WALL)
    shellMaterial.side = BackSide
    add(shell, shellMaterial, [0, ROOM_HEIGHT / 2, 0])

    // Floor. Cool slate, and the largest single thing in the lower hemisphere —
    // it is what tints the underside of every panel.
    add(new PlaneGeometry(ROOM_HALF_X * 2, ROOM_HALF_Z * 2), basic(GARAGE_FLOOR), [0, 0.01, 0], [-Math.PI / 2, 0, 0])

    // Sectional door wall, bright and cool.
    add(new PlaneGeometry(5.2, 3.4), basic(radiance(DOOR_RADIANCE)), [0, 1.8, ROOM_HALF_Z - 0.3], [0, Math.PI, 0])

    // Warm pegboard on the back wall, and the masses either side. These are what
    // give the reflections direction — a uniform box reflects the same grey from
    // every angle, so the paint never changes as the camera orbits.
    add(new PlaneGeometry(6.4, 1.9), basic('#b58f64'), [-1.2, 2.15, -ROOM_HALF_Z + 0.3])
    add(new BoxGeometry(1.1, 3.0, 4.2), basic('#4a4f55'), [-ROOM_HALF_X + 0.6, 1.5, -3.4])
    add(new BoxGeometry(0.95, 1.1, 1.5), basic('#8e2b26'), [ROOM_HALF_X - 0.6, 0.6, -1.4])
    add(new BoxGeometry(3.4, 0.1, 0.9), basic('#c08f5c'), [-2.4, 0.92, -ROOM_HALF_Z + 0.8])

    // Ceiling strips.
    const lampMaterial = basic(radiance(LAMP_RADIANCE))
    for (const x of LAMP_X) {
      for (const z of LAMP_Z) {
        const geometry = new BoxGeometry(0.26, 0.07, 2.36)
        const mesh = new Mesh(geometry, lampMaterial)
        mesh.position.set(x, LAMP_Y, z)
        scene.add(mesh)
        disposables.push(geometry)
      }
    }
    disposables.push(lampMaterial)

    const pmrem = new PMREMGenerator(gl)
    // Barely any blur. A sharp procedural room used to band its box walls across
    // flat panels, which is why the old value was 0.05 — but the same blur also
    // smears the strip lights into a wash, and the strips are the point.
    const result = pmrem.fromScene(scene, 0.018, 0.1, 60)

    for (const disposable of disposables) disposable.dispose()
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
