import { EffectComposer, N8AO, Bloom, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

/**
 * Post chain. Mounted only above the low-power tier — every pass here is a full
 * screen-space read, and the whole point of the low tier is to not pay for those.
 *
 * Order matters and is not cosmetic:
 *
 *   N8AO       darkens contact and crevice, in linear space, before anything
 *              adds light. The scene is lit by three lights and an environment
 *              map, none of which can occlude: without this pass the gap between
 *              a door and its shut line, the engine bay, and the inside of a
 *              wheel arch are all lit exactly as brightly as the surfaces facing
 *              open room. It is the single largest realism gain in the file.
 *   Bloom      spreads the emissive lamps past 1.0. Threshold sits just under
 *              the lamp emissives in useCarMaterials, so headlights bloom and
 *              painted bodywork never does.
 *   ToneMapping AgX, mapping HDR to display last. The renderer's own tone mapping
 *              is switched off in SceneCanvas so that the two passes above see
 *              real radiance instead of already-compressed values — bloom applied
 *              after tone mapping can only ever bloom what has already clipped.
 *   SMAA       antialiasing. `gl.antialias` does nothing once a composer owns
 *              the render target, so this replaces it rather than adding to it.
 *   Vignette   a stop of falloff at the corners. Every photograph of a car has it.
 */
export function PostFX() {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO
        // Roughly a wheel radius: large enough to darken an arch and a bay,
        // small enough that the car does not sit in a grey halo.
        aoRadius={0.75}
        distanceFalloff={0.6}
        intensity={2.4}
        quality="medium"
        halfRes
        depthAwareUpsampling
        color="#0a0e13"
      />
      <Bloom mipmapBlur luminanceThreshold={0.9} luminanceSmoothing={0.22} intensity={0.7} radius={0.62} />
      <ToneMapping mode={ToneMappingMode.AGX} />
      <SMAA />
      <Vignette offset={0.3} darkness={0.5} />
    </EffectComposer>
  )
}
