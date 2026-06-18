import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import * as THREE from 'three'
import { Minimap } from '../Minimap'

const defaultProps = {
  playerPosition: new THREE.Vector3(0, 0, 0),
  playerRotation: 0,
  enemies: [],
  arenaSize: 50,
}

const mockFillRect = vi.fn()
const mockStrokeRect = vi.fn()
const mockFillText = vi.fn()
const mockArc = vi.fn()
const mockFill = vi.fn()
const mockSave = vi.fn()
const mockRestore = vi.fn()
const mockTranslate = vi.fn()
const mockRotate = vi.fn()
const mockBeginPath = vi.fn()
const mockMoveTo = vi.fn()
const mockLineTo = vi.fn()
const mockClosePath = vi.fn()

const mockCtx = {
  fillStyle: '',
  strokeStyle: '',
  font: '',
  textAlign: '',
  textBaseline: '',
  fillRect: mockFillRect,
  strokeRect: mockStrokeRect,
  fillText: mockFillText,
  arc: mockArc,
  fill: mockFill,
  save: mockSave,
  restore: mockRestore,
  translate: mockTranslate,
  rotate: mockRotate,
  beginPath: mockBeginPath,
  moveTo: mockMoveTo,
  lineTo: mockLineTo,
  closePath: mockClosePath,
}

beforeEach(() => {
  vi.clearAllMocks()
  HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx) as any
})

describe('Minimap', () => {
  it('renders a canvas element', () => {
    const { container } = render(<Minimap {...defaultProps} />)
    expect(container.querySelector('canvas')).toBeTruthy()
  })

  it('draws player indicator on canvas', () => {
    render(<Minimap {...defaultProps} />)
    expect(mockSave).toHaveBeenCalled()
    expect(mockTranslate).toHaveBeenCalled()
    expect(mockRotate).toHaveBeenCalledWith(expect.any(Number))
    expect(mockFill).toHaveBeenCalled()
  })

  it('draws enemy markers on canvas when enemies are present', () => {
    const enemies = [new THREE.Vector3(10, 0, 10)]
    render(<Minimap {...defaultProps} enemies={enemies} />)
    expect(mockArc).toHaveBeenCalled()
  })

  it('does not draw enemy markers when enemies list is empty', () => {
    render(<Minimap {...defaultProps} enemies={[]} />)
    expect(mockArc).not.toHaveBeenCalled()
  })
})

describe('bombsite markers', () => {
  it('renders with bombsites prop without errors', () => {
    const bombsites = [
      { id: 'A', position: { x: 0, z: -25 } },
      { id: 'B', position: { x: 0, z: 25 } },
    ]
    const { container } = render(
      <Minimap {...defaultProps} bombsites={bombsites} />
    )
    expect(container.querySelector('canvas')).toBeTruthy()
  })

  it('draws bombsite markers on canvas when bombsites are in range', () => {
    const bombsites = [
      { id: 'A', position: { x: 0, z: -10 } },
      { id: 'B', position: { x: 0, z: 10 } },
    ]
    render(<Minimap {...defaultProps} bombsites={bombsites} />)
    expect(mockFillText).toHaveBeenCalledTimes(2)
    expect(mockFillText).toHaveBeenCalledWith('A', expect.any(Number), expect.any(Number))
    expect(mockFillText).toHaveBeenCalledWith('B', expect.any(Number), expect.any(Number))
  })

  it('does not draw bombsite markers outside bounds', () => {
    const bombsites = [
      { id: 'A', position: { x: 0, z: -200 } },
    ]
    render(<Minimap {...defaultProps} bombsites={bombsites} />)
    expect(mockFillText).not.toHaveBeenCalled()
  })

  it('draws bomb position marker on canvas when in range', () => {
    const bombPosition = { x: 5, z: 5 }
    render(<Minimap {...defaultProps} bombPosition={bombPosition} />)
    expect(mockArc).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      3,
      0,
      Math.PI * 2
    )
  })

  it('does not draw bomb position marker outside bounds', () => {
    const bombPosition = { x: 0, z: -200 }
    render(<Minimap {...defaultProps} bombPosition={bombPosition} />)
    expect(mockArc).not.toHaveBeenCalled()
  })

  it('renders with bombPosition prop without errors', () => {
    const bombPosition = { x: 5, z: 10 }
    const { container } = render(
      <Minimap {...defaultProps} bombPosition={bombPosition} />
    )
    expect(container.querySelector('canvas')).toBeTruthy()
  })

  it('renders without bombsites or bombPosition', () => {
    const { container } = render(<Minimap {...defaultProps} />)
    expect(container.querySelector('canvas')).toBeTruthy()
  })

  it('accepts bombsites with different ids', () => {
    const bombsites = [
      { id: 'A', position: { x: -10, z: -20 } },
      { id: 'B', position: { x: 10, z: 20 } },
    ]
    const { container } = render(
      <Minimap {...defaultProps} bombsites={bombsites} />
    )
    expect(container.querySelector('canvas')).toBeTruthy()
  })
})
