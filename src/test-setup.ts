import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

// jsdom does not implement matchMedia; stub it so responsive hooks work in tests.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  })
}

// jsdom does not implement canvas getContext; stub it so Three.js CanvasTexture
// and any name-tag / minimap drawing code can run in unit tests without errors.
// We use a Proxy so every method call is a silent no-op and every property
// assignment is accepted without crashing.
const canvasCtxStub = new Proxy({} as CanvasRenderingContext2D, {
  get(_t, prop) {
    if (prop === Symbol.toPrimitive || prop === 'valueOf') return () => ''
    return () => {} // any method call → noop
  },
  set() { return true }, // any property assignment → accepted
})
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(HTMLCanvasElement.prototype as any).getContext = () => canvasCtxStub
