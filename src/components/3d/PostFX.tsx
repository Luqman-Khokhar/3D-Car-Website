import { useLayoutEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { EffectComposer, N8AO, Bloom, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { AgXToneMapping, NoToneMapping } from 'three'

/**
 * Post chain. Mounted only on tiers with `post` (see src/lib/quality.ts) and
 * code-split: postprocessing and N8AO are ~250 kB of the 3D bundle that the low
 * tier never downloads. SceneCanvas mounts this inside the scene's own Suspense
 * boundary, so the first frame already renders through the composer and the
 * materials compile once, not once without the chain and again with it.
 *
 * Order matters and is not cosmetic:
 *
 *   N8AO       darkens contact and crevice, in linear space, before anything
 *              adds light. The scene is lit by three lights and an environment
 *              map, none of which can occlude: without this pass the gap between
 *              a door and its shut line, the engine bay, and the inside of a
 *              wheel arch are all lit exactly as brightly as the surfaces facing
 *              open room. It is the single largest realism gain in the file — and
 *              the single largest cost, which is why only the high tier runs it.
 *   Bloom      spreads the emissive lamps past 1.0. Threshold sits just under
 *              the lamp emissives in useCarMaterials, so headlights bloom and
 *              painted bodywork never does.
 *   ToneMapping AgX, mapping HDR to display last. The renderer's own tone mapping
 *              is switched off while this is mounted so that the two passes above
 *              see real radiance instead of already-compressed values — bloom
 *              applied after tone mapping can only ever bloom what has already
 *              clipped.
 *   Vignette   a stop of falloff at the corners. Every photograph of a car has it.
 *              Ahead of SMAA rather than after it: the composer merges adjacent
 *              non-convolution effects into one shader, so this rides along with
 *              bloom and tone mapping instead of costing its own full-screen pass.
 *   SMAA       antialiasing. `gl.antialias` does nothing once a composer owns
 *              the render target, so this replaces it rather than adding to it.
 */
export function PostFX({ ao }: { ao: boolean }) {
  const gl = useThree((s) => s.gl)

  useLayoutEffect(() => {
    gl.toneMapping = NoToneMapping
    return () => {
      gl.toneMapping = AgXToneMapping
    }
  }, [gl])

  const effects = [
    <Bloom key="bloom" mipmapBlur luminanceThreshold={0.9} luminanceSmoothing={0.22} intensity={0.7} radius={0.62} />,
    <ToneMapping key="tone" mode={ToneMappingMode.AGX} />,
    <Vignette key="vignette" offset={0.3} darkness={0.5} />,
    <SMAA key="smaa" />,
  ]
  if (ao) {
    effects.unshift(
      <N8AO
        key="ao"
        // Roughly a wheel radius: large enough to darken an arch and a bay,
        // small enough that the car does not sit in a grey halo.
        aoRadius={0.75}
        distanceFalloff={0.6}
        intensity={2.4}
        quality="medium"
        halfRes
        depthAwareUpsampling
        color="#0a0e13"
      />,
    )
  }

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      {effects}
    </EffectComposer>
  )
}

export default PostFX
