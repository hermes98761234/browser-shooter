import {
  EffectComposer,
  RenderPass,
  EffectPass,
  BloomEffect,
  SSAOEffect,
  SMAAEffect,
  ToneMappingEffect,
  NormalPass,
  BlendFunction,
  KernelSize,
  EdgeDetectionMode,
} from 'postprocessing'
import * as THREE from 'three'
import { PLANETARY_CONFIG } from './PlanetaryConfig'

export type PostQuality = 'low' | 'medium' | 'high'

export class PostProcessing {
  composer: EffectComposer | null = null
  private preset: PostQuality
  private bloom: BloomEffect | null = null
  private ssao: SSAOEffect | null = null
  private smaa: SMAAEffect | null = null
  private toneMapping: ToneMappingEffect | null = null
  private normalPass: NormalPass | null = null
  private effectPass: EffectPass | null = null
  private disposed = false
  private camera: THREE.Camera

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.camera = camera
    this.preset = PLANETARY_CONFIG.post.defaultPreset as PostQuality
    try {
      this.composer = new EffectComposer(renderer)
      const renderPass = new RenderPass(scene, camera)
      this.composer.addPass(renderPass)

      this.normalPass = new NormalPass(scene, camera, {})
      this.bloom = new BloomEffect({
        blendFunction: BlendFunction.SCREEN,
        kernelSize: KernelSize.MEDIUM,
        luminanceThreshold: PLANETARY_CONFIG.post.bloomThreshold,
        luminanceSmoothing: 0.1,
        intensity: PLANETARY_CONFIG.post.bloomStrength,
      })
      this.smaa = new SMAAEffect({
        edgeDetectionMode: EdgeDetectionMode.COLOR,
      })
      this.toneMapping = new ToneMappingEffect({ mode: 2 /* ACES_FILMIC */ })

      this.buildSSAO()
      this.rebuildEffectPass()
    } catch {
      this.composer = null
    }
  }

  private buildSSAO(): void {
    if (this.ssao) {
      this.ssao.dispose()
      this.ssao = null
    }
    const resScale = this.preset === 'low' ? 0.25 : this.preset === 'high' ? 1.0 : 0.5
    const samples = this.preset === 'low' ? 8 : this.preset === 'high' ? 32 : 16
    this.ssao = new SSAOEffect(this.camera, this.normalPass!.texture, {
      blendFunction: BlendFunction.MULTIPLY,
      samples,
      rings: 4,
      radius: PLANETARY_CONFIG.post.ssaoRadius,
      intensity: 1.0,
      resolutionScale: resScale,
    })
  }

  private rebuildEffectPass(): void {
    if (!this.composer || !this.bloom || !this.ssao || !this.smaa || !this.toneMapping) return
    // Remove old EffectPass if present
    const passes = this.composer.passes
    for (let i = passes.length - 1; i >= 0; i--) {
      if (passes[i] instanceof EffectPass) {
        this.composer.removePass(passes[i])
      }
    }

    const effects: unknown[] = [this.toneMapping]
    if (this.preset !== 'low') {
      effects.unshift(this.smaa)
      effects.unshift(this.bloom)
    }
    effects.unshift(this.ssao)

    this.effectPass = new EffectPass(undefined as never, ...effects as never[])
    this.composer.addPass(this.effectPass)
  }

  setQuality(preset: PostQuality): void {
    if (preset === this.preset) return
    this.preset = preset
    this.buildSSAO()
    this.rebuildEffectPass()
  }

  render(dt: number): void {
    if (this.disposed || !this.composer) return
    this.composer.render(dt)
  }

  dispose(): void {
    this.disposed = true
    this.composer?.dispose()
    this.composer = null
    this.bloom?.dispose()
    this.ssao?.dispose()
    this.smaa?.dispose()
    this.toneMapping?.dispose()
    this.normalPass?.dispose()
  }
}
