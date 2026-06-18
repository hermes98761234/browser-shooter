import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import * as THREE from 'three'
import { BuyPreview } from '../BuyPreview'
import { findItem } from '../../weapons/StoreCatalog'

// Mock WebGLRenderer to avoid needing a real GL context
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof THREE>('three')
  return {
    ...actual,
    WebGLRenderer: vi.fn().mockImplementation(() => ({
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
      shadowMap: { enabled: false, type: 0 },
      domElement: document.createElement('canvas'),
    })),
  }
})

describe('BuyPreview', () => {
  it('renders with no item', () => {
    render(<BuyPreview item={null} />)
    expect(screen.getByText('Select an item')).toBeDefined()
  })

  it('renders with item selected', () => {
    const item = findItem('m4')
    render(<BuyPreview item={item!} />)
    expect(screen.getByText('M4')).toBeDefined()
  })
})