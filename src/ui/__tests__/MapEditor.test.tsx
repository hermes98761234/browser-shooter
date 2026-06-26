import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MapEditor } from '../MapEditor'
import { DAYLIGHT } from '../../zones/ZoneDef'
import type { SavedMap } from '../../zones/mapStore'

vi.mock('../MapEditorCanvas', () => ({
  MapEditorCanvas: () => <div data-testid="map-canvas" />,
}))

describe('MapEditor', () => {
  it('renders tool buttons and map name input', () => {
    render(<MapEditor onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByPlaceholderText('Map name')).toBeTruthy()
    expect(screen.getByText('Wall')).toBeTruthy()
    expect(screen.getByText('Eraser')).toBeTruthy()
    expect(screen.getByTestId('map-canvas')).toBeTruthy()
  })

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn()
    render(<MapEditor onSave={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('calls onSave when Save Map is clicked', () => {
    const onSave = vi.fn()
    render(<MapEditor onSave={onSave} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByText('Save Map'))
    expect(onSave).toHaveBeenCalled()
  })

  it('pre-fills name when initial map provided', () => {
    const initial: SavedMap = {
      id: 'x1', name: 'Old Map', createdAt: 0,
      zone: {
        id: 'z1', name: 'Old Map', description: '', arenaSize: 20, floorColor: 0x444444,
        lighting: DAYLIGHT, structures: [], ctSpawns: [[0,-10]], tSpawns: [[0,10]],
        bombsites: [{ id: 'A', center: [10,0] }, { id: 'B', center: [-10,0] }],
      },
    }
    render(<MapEditor initial={initial} onSave={vi.fn()} onCancel={vi.fn()} />)
    expect((screen.getByPlaceholderText('Map name') as HTMLInputElement).value).toBe('Old Map')
  })
})
