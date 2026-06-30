import {
  EffectComposer, RenderPass, EffectPass,
  BloomEffect, SMAAEffect, SMAAPreset, ToneMappingEffect, ToneMappingMode,
  BlendFunction, KernelSize,
} from 'postprocessing'
import type * as THREE from 'three'
import { PLANETARY_CONFIG } from './PlanetaryConfig'

export type PostQuality = 'low' | 'medium' | 'high'

export class PostProcessing {
  composer: EffectComposer | null = null

  private bloom: BloomEffect | null = null
  private smaa: SMAAEffect | null = null
  private tone: ToneMappingEffect | null = null
  private effectPass: EffectPass | null = null
  private currentPreset: PostQuality
  private camera: THREE.Camera

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    preset: PostQuality = PLANETARY_CONFIG.post.defaultPreset,
  ) {
    this.camera = camera
    this.currentPreset = preset
    try {
      this.composer = new EffectComposer(renderer)
      this.composer.addPass(new RenderPass(scene, camera))
      this.bloom = new BloomEffect({
        blendFunction: BlendFunction.SCREEN,
        kernelSize: KernelSize.MEDIUM,
        luminanceThreshold: PLANETARY_CONFIG.post.bloomThreshold,
        luminanceSmoothing: 0.1,
        intensity: PLANETARY_CONFIG.post.bloomIntensity,
      })
      this.smaa = new SMAAEffect({ preset: SMAAPreset.MEDIUM })
      this.tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })
      this.effectPass = this._buildEffectPass(preset)
      this.composer.addPass(this.effectPass)
    } catch {
      this.composer = null
    }
  }

  private _buildEffectPass(preset: PostQuality): EffectPass {
    const effects = preset === 'low'
      ? [this.tone!]
      : [this.bloom!, this.smaa!, this.tone!]
    return new EffectPass(this.camera, ...effects)
  }

  get active(): boolean {
    return this.composer !== null
  }

  render(dt: number): void {
    if (this.composer) this.composer.render(dt)
  }

  setSize(w: number, h: number): void {
    this.composer?.setSize(w, h)
  }

  setQuality(preset: PostQuality): void {
    if (preset === this.currentPreset || !this.composer) return
    if (this.effectPass) {
      this.composer.removePass(this.effectPass)
      this.effectPass.dispose()
    }
    this.currentPreset = preset
    this.effectPass = this._buildEffectPass(preset)
    this.composer.addPass(this.effectPass)
  }

  dispose(): void {
    this.bloom?.dispose()
    this.smaa?.dispose()
    this.tone?.dispose()
    this.composer?.dispose()
    this.composer = null
  }
}
