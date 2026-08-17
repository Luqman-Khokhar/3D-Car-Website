import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { CylinderGeometry } from 'three'
import type { Mesh } from 'three'
import { DOOR_Z } from '@/scenes/garage'
import { buildGeometry, createMaterial, MATERIAL_SPECS } from './Garage'
import { useEnvironmentMap } from './environmentContext'
import { useSceneStore, LIGHT_SWITCH_GROUPS } from '@/store/useSceneStore'
import type { LightSwitchGroup, LightSwitchState } from '@/store/useSceneStore'

/** Lit colour per circuit, matched to what each one actually throws — see
 *  GarageLights.tsx. Off is unlit metal; auto is a dim neutral cap, since
 *  nobody has thrown that switch yet. */
const ON_COLOR: Record<LightSwitchGroup, string> = {
  ceiling: '#fff4de',
  spot: '#dce8ff',
  headlamps: '#ff2a18',
}
const AUTO_COLOR = '#5a564e'
const OFF_COLOR = '#141414'

function capColor(group: LightSwitchGroup, state: LightSwitchState): string {
  if (state === 'on') return ON_COLOR[group]
  if (state === 'off') return OFF_COLOR
  return AUTO_COLOR
}

/** One gang box per circuit, in a row on the same jamb as the door's push
 *  button and just beyond it — a switch bank belongs beside the door it
 *  lights, not in a screen corner. Row runs along +x, clear of the 5 m-wide
 *  opening (see DOOR_WIDTH) and the push button at x = 3.05. */
const ROW_Y = 1.3
const ROW_Z = DOOR_Z + 0.1
const ROW_START_X = 3.35
const ROW_SPACING = 0.3

/**
 * Wall-mounted light switches beside the garage door button. Each cap glows in
 * the colour of the circuit it drives once thrown, so the bank reads at a
 * glance even with the room lights off — the same reason a real breaker panel
 * carries indicator LEDs. Clicking cycles auto -> on -> off -> auto, mirroring
 * DoorButton's press-and-decay feel for the same tactile, physical read.
 *
 * Only reachable in free-look, same as DoorButton and for the same reason: the
 * scroll spacers over the canvas swallow pointer events outside it.
 */
export const WallLightSwitches = memo(function WallLightSwitches() {
  return (
    <>
      {LIGHT_SWITCH_GROUPS.map((group, i) => (
        <WallSwitch key={group} group={group} position={[ROW_START_X + i * ROW_SPACING, ROW_Y, ROW_Z]} />
      ))}
    </>
  )
})

const WallSwitch = memo(function WallSwitch({
  group,
  position,
}: {
  group: LightSwitchGroup
  position: [number, number, number]
}) {
  const envMap = useEnvironmentMap()
  const state = useSceneStore((s) => s.lightSwitches[group])
  const cycleLightSwitch = useSceneStore((s) => s.cycleLightSwitch)

  const capRef = useRef<Mesh>(null)
  const press = useRef(0)
  const [hovered, setHovered] = useState(false)

  const parts = useMemo(() => {
    const housing = createMaterial(MATERIAL_SPECS.darkMetal, envMap)
    return {
      housing,
      housingGeo: buildGeometry({ kind: 'box', args: [0.13, 0.13, 0.035], position: [0, 0, 0], material: 'darkMetal' }),
      capGeo: new CylinderGeometry(0.04, 0.04, 0.025, 16),
    }
  }, [envMap])

  useEffect(() => {
    return () => {
      parts.housing.dispose()
      parts.housingGeo.dispose()
      parts.capGeo.dispose()
    }
  }, [parts])

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto'
    return () => {
      document.body.style.cursor = 'auto'
    }
  }, [hovered])

  useFrame((_, delta) => {
    press.current *= Math.pow(0.0008, delta)
    if (capRef.current) capRef.current.position.z = -0.045 + press.current * 0.02
  })

  return (
    <group position={position}>
      <mesh geometry={parts.housingGeo} material={parts.housing} />
      <mesh
        ref={capRef}
        geometry={parts.capGeo}
        position={[0, 0, -0.045]}
        rotation={[Math.PI / 2, 0, 0]}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => {
          e.stopPropagation()
          press.current = 1
          cycleLightSwitch(group)
        }}
      >
        <meshBasicMaterial color={capColor(group, state)} toneMapped={false} />
      </mesh>
    </group>
  )
})
