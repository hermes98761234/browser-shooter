import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

vi.mock('maplibre-gl', () => {
  const clickListeners: ((e: { lngLat: { lng: number; lat: number } }) => void)[] = []
  const MockMap = vi.fn().mockImplementation(() => ({
    on: vi.fn((event: string, cb: (e: { lngLat: { lng: number; lat: number } }) => void) => {
      if (event === 'click') clickListeners.push(cb)
    }),
    remove: vi.fn(),
    addControl: vi.fn(),
    _triggerClick: (lng: number, lat: number) => clickListeners.forEach(cb => cb({ lngLat: { lng, lat } })),
  }))
  return { default: { Map: MockMap, NavigationControl: vi.fn() } }
})

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

import { MapPicker } from '../MapPicker'

describe('MapPicker', () => {
  it('renders close button', () => {
    render(
      <MapPicker
        playerPositions={[]}
        onTeleport={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /close/i })).toBeDefined()
  })

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn()
    render(<MapPicker playerPositions={[]} onTeleport={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
