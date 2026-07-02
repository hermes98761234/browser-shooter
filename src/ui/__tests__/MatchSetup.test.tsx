import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MatchSetup } from '../MatchSetup'
import type { SavedMap } from '../../zones/mapStore'
import { DAYLIGHT } from '../../zones/ZoneDef'

describe('MatchSetup edit map', () => {
  const mockMap: SavedMap = {
    id: 'test1', name: 'Test Map', createdAt: 0,
    zone: {
      id: 'z1', name: 'Test Map', description: '', arenaSize: 20,
      floorColor: 0x444444, lighting: DAYLIGHT,
      structures: [], ctSpawns: [[0, -10]], tSpawns: [[0, 10]],
      bombsites: [{ id: 'A', center: [10, 0] }, { id: 'B', center: [-10, 0] }],
    },
  }

  it('calls onEditMap with the map when Edit is clicked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify([mockMap]))
    const onEditMap = vi.fn()
    render(<MatchSetup onConfirm={vi.fn()} onBack={vi.fn()} onCreateMap={vi.fn()} onEditMap={onEditMap} />)
    fireEvent.click(screen.getByText('Edit'))
    expect(onEditMap).toHaveBeenCalledWith(mockMap)
    vi.restoreAllMocks()
  })
})

describe('MatchSetup join policy', () => {
  it('defaults to lobby and confirms with joinPolicy lobby', () => {
    const onConfirm = vi.fn()
    render(<MatchSetup onConfirm={onConfirm} onBack={vi.fn()} onCreateMap={vi.fn()} onEditMap={vi.fn()} />)
    fireEvent.click(screen.getByText('Create Room'))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ joinPolicy: 'lobby' }))
  })

  it('free + password is passed through on confirm', () => {
    const onConfirm = vi.fn()
    render(<MatchSetup onConfirm={onConfirm} onBack={vi.fn()} onCreateMap={vi.fn()} onEditMap={vi.fn()} />)
    fireEvent.click(screen.getByText('Free'))
    fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: 's3cret' } })
    fireEvent.click(screen.getByText('Create Room'))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ joinPolicy: 'free', password: 's3cret' }))
  })

  it('lobby + password is passed through on confirm', () => {
    const onConfirm = vi.fn()
    render(<MatchSetup onConfirm={onConfirm} onBack={vi.fn()} onCreateMap={vi.fn()} onEditMap={vi.fn()} />)
    // joinPolicy defaults to 'lobby' — password field should now be visible
    fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: 'secret' } })
    fireEvent.click(screen.getByText('Create Room'))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ joinPolicy: 'lobby', password: 'secret' }))
  })
})

describe('MatchSetup planetary zone', () => {
  it('emits zoneId planetary when the planetary card is selected', () => {
    const onConfirm = vi.fn()
    render(<MatchSetup onConfirm={onConfirm} onBack={vi.fn()} onCreateMap={vi.fn()} onEditMap={vi.fn()} />)
    fireEvent.click(screen.getByText(/Planetary/i))
    fireEvent.click(screen.getByText('Create Room'))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ zoneId: 'planetary' }))
  })
})
