import { describe, it, expect } from 'vitest'
import { PostProcessing } from '../PostProcessing'

// jsdom has no WebGL context; EffectComposer construction will throw,
// so the try/catch should swallow it and leave composer === null.
describe('PostProcessing (jsdom / no WebGL)', () => {
  const stubRenderer = {} as never
  const stubScene = {} as never
  const stubCamera = {} as never

  it('does not throw when constructed without WebGL context', () => {
    expect(() => new PostProcessing(stubRenderer, stubScene, stubCamera)).not.toThrow()
  })

  it('active is false when composer could not be created', () => {
    const pp = new PostProcessing(stubRenderer, stubScene, stubCamera)
    expect(pp.active).toBe(false)
  })

  it('render() is a safe no-op when composer is null', () => {
    const pp = new PostProcessing(stubRenderer, stubScene, stubCamera)
    expect(() => pp.render(0.016)).not.toThrow()
  })

  it('setSize() is a safe no-op when composer is null', () => {
    const pp = new PostProcessing(stubRenderer, stubScene, stubCamera)
    expect(() => pp.setSize(800, 600)).not.toThrow()
  })

  it('setQuality() is a safe no-op when composer is null', () => {
    const pp = new PostProcessing(stubRenderer, stubScene, stubCamera)
    expect(() => pp.setQuality('high')).not.toThrow()
  })

  it('dispose() is a safe no-op when composer is null', () => {
    const pp = new PostProcessing(stubRenderer, stubScene, stubCamera)
    expect(() => pp.dispose()).not.toThrow()
  })
})
