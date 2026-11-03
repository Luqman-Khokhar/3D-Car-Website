import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  Color,
  Mesh,
  MeshDepthMaterial,
  OrthographicCamera,
  PlaneGeometry,
  ShaderMaterial,
  WebGLRenderTarget,
} from 'three'
import type { Group } from 'three'
import { HorizontalBlurShader } from 'three/examples/jsm/shaders/HorizontalBlurShader.js'
import { VerticalBlurShader } from 'three/examples/jsm/shaders/VerticalBlurShader.js'
import { carMotion } from '@/lib/frame'

/** Layer the car's own meshes join (on top of layer 0) so this pass can draw the
 *  car and nothing else. */
export const CONTACT_LAYER = 1
export const CONTACT_LAYER_MASK = (1 << 0) | (1 << CONTACT_LAYER)

interface CarContactShadowProps {
  /** Width and depth of the shadow plane, metres. */
  scale: number
  /** How far above the plane geometry still darkens it. */
  far: number
  blur: number
  opacity: number
  resolution: number
  color: string
  position?: [number, number, number]
}

/**
 * Soft occlusion where the car meets the floor — drei's ContactShadows, cut down
 * to what this scene needs and fixed in the two places it cost the most.
 *
 * drei renders the *whole scene* into the shadow target every frame with an
 * override material. Here that meant the garage shell, every merged prop and the
 * entire race circuit outside went through a depth pass each frame to produce a
 * shadow only the car can cast. This pass sees only CONTACT_LAYER, which only the
 * car's part and bone meshes join.
 *
 * And it re-renders only when the car has moved (`carMotion`, bumped by
 * RenderDriver): a parked car orbited in free look, or a frame drawn because a
 * light faded, reuses the last shadow instead of rebuilding an identical one.
 */
export function CarContactShadow({
  scale,
  far,
  blur,
  opacity,
  resolution,
  color,
  position,
}: CarContactShadowProps) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const root = useRef<Group>(null)
  const rendered = useRef(-1)

  const kit = useMemo(() => {
    const target = new WebGLRenderTarget(resolution, resolution)
    const targetBlur = new WebGLRenderTarget(resolution, resolution)
    target.texture.generateMipmaps = targetBlur.texture.generateMipmaps = false

    const plane = new PlaneGeometry(scale, scale).rotateX(Math.PI / 2)
    // Blur runs as a plain full-target quad with its own camera. drei draws its
    // blur plane at the world origin through the shadow camera, so once the car
    // was driven more than half the plane's width away the quad no longer
    // covered the target and the shadow came out unblurred.
    const quad = new PlaneGeometry(2, 2)
    const blurPlane = new Mesh(quad)
    blurPlane.position.z = -1
    blurPlane.updateMatrixWorld()
    const blurCamera = new OrthographicCamera(-1, 1, 1, -1, 0.5, 1.5)

    const depth = new MeshDepthMaterial()
    depth.depthTest = depth.depthWrite = false
    const tint = new Color(color)
    depth.onBeforeCompile = (shader) => {
      shader.uniforms.ucolor = { value: tint }
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform vec3 ucolor;\nvoid main() {')
        // Colourise, and fade with height so the sills are darker than the roof.
        .replace(
          'vec4( vec3( 1.0 - fragCoordZ ), opacity );',
          'vec4( ucolor * fragCoordZ * 2.0, ( 1.0 - fragCoordZ ) * 1.0 );',
        )
    }

    const blurH = new ShaderMaterial(HorizontalBlurShader)
    const blurV = new ShaderMaterial(VerticalBlurShader)
    blurH.depthTest = blurV.depthTest = false

    const camera = new OrthographicCamera(-scale / 2, scale / 2, scale / 2, -scale / 2, 0, far)
    camera.layers.set(CONTACT_LAYER)

    return { target, targetBlur, plane, quad, blurPlane, blurCamera, depth, blurH, blurV, camera }
  }, [resolution, scale, far, color])

  useEffect(() => {
    rendered.current = -1
    return () => {
      kit.target.dispose()
      kit.targetBlur.dispose()
      kit.plane.dispose()
      kit.quad.dispose()
      kit.depth.dispose()
      kit.blurH.dispose()
      kit.blurV.dispose()
    }
  }, [kit])

  const blurPass = (amount: number) => {
    const { blurPlane, blurH, blurV, target, targetBlur, blurCamera: camera } = kit
    blurPlane.material = blurH
    blurH.uniforms.tDiffuse.value = target.texture
    blurH.uniforms.h.value = amount / 256
    gl.setRenderTarget(targetBlur)
    gl.render(blurPlane, camera)
    blurPlane.material = blurV
    blurV.uniforms.tDiffuse.value = targetBlur.texture
    blurV.uniforms.v.value = amount / 256
    gl.setRenderTarget(target)
    gl.render(blurPlane, camera)
  }

  useFrame(() => {
    if (rendered.current === carMotion.version) return
    rendered.current = carMotion.version

    // The camera is a child of `root` in the scene graph, so it follows the
    // CarShadow group around the circuit.
    const background = scene.background
    const override = scene.overrideMaterial
    const previousTarget = gl.getRenderTarget()
    scene.background = null
    scene.overrideMaterial = kit.depth
    gl.setRenderTarget(kit.target)
    gl.clear()
    gl.render(scene, kit.camera)
    blurPass(blur)
    blurPass(blur * 0.4)
    gl.setRenderTarget(previousTarget)
    scene.overrideMaterial = override
    scene.background = background
  })

  return (
    <group ref={root} position={position} rotation-x={Math.PI / 2}>
      <mesh geometry={kit.plane} scale={[1, -1, 1]} rotation={[-Math.PI / 2, 0, 0]}>
        <meshBasicMaterial transparent map={kit.target.texture} opacity={opacity} depthWrite={false} />
      </mesh>
      <primitive object={kit.camera} />
    </group>
  )
}
