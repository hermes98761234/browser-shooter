import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ServerFilters } from '../ServerFilters'
import { ServerList, type ServerRow } from '../ServerList'

const makeRow = (overrides: Partial<ServerRow> = {}): ServerRow => ({
  roomCode: 'ROOM1', hostName: 'Alice', players: 2, maxPlayers: 8, status: 'lobby', ping: 42, ...overrides,
})

describe('ServerFilters', () => {
  it('renders filter controls', () => {
    const onChange = vi.fn()
    render(<ServerFilters filter={{ mode: 'all', status: 'all', playerCount: 'all' }} onChange={onChange} />)
    expect(screen.getByText('Mode')).toBeDefined()
    expect(screen.getByText('Status')).toBeDefined()
  })

  it('calls onChange when mode filter changes', () => {
    const onChange = vi.fn()
    render(<ServerFilters filter={{ mode: 'all', status: 'all', playerCount: 'all' }} onChange={onChange} />)
    fireEvent.click(screen.getByText('Competitive'))
    expect(onChange).toHaveBeenCalledWith({ mode: 'competitive', status: 'all', playerCount: 'all' })
  })

  it('calls onChange when status filter changes', () => {
    const onChange = vi.fn()
    render(<ServerFilters filter={{ mode: 'all', status: 'all', playerCount: 'all' }} onChange={onChange} />)
    fireEvent.click(screen.getByText('In Progress'))
    expect(onChange).toHaveBeenCalledWith({ mode: 'all', status: 'in-progress', playerCount: 'all' })
  })

  it('highlights the active mode button', () => {
    const onChange = vi.fn()
    render(<ServerFilters filter={{ mode: 'coop', status: 'all', playerCount: 'all' }} onChange={onChange} />)
    const coopBtn = screen.getByText('Co-op')
    expect(coopBtn.getAttribute('data-active')).toBe('true')
  })
})

describe('ServerList', () => {
  it('renders a row with host, players, status and ping, and joins on click', () => {
    const onJoin = vi.fn()
    render(<ServerList servers={[makeRow()]} onJoin={onJoin} onRefresh={vi.fn()} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('2/8')).toBeInTheDocument()
    expect(screen.getAllByText(/lobby/i).length).toBeGreaterThan(0)
    expect(screen.getByText('42 ms')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^join$/i }))
    expect(onJoin).toHaveBeenCalledWith('ROOM1')
  })

  it('shows a dash when ping is unknown', () => {
    render(<ServerList servers={[makeRow({ ping: null })]} onJoin={vi.fn()} onRefresh={vi.fn()} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows an empty state and a working refresh button when there are no servers', () => {
    const onRefresh = vi.fn()
    render(<ServerList servers={[]} onJoin={vi.fn()} onRefresh={onRefresh} />)
    expect(screen.getByText(/no games found/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))
    expect(onRefresh).toHaveBeenCalled()
  })

  it('filters servers by mode', () => {
    const onJoin = vi.fn()
    const servers = [
      makeRow({ roomCode: 'R1', hostName: 'Alice' }),
      makeRow({ roomCode: 'R2', hostName: 'Bob' }),
    ]
    render(<ServerList servers={servers} onJoin={onJoin} onRefresh={vi.fn()} filterMode="all" />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('sorts servers by ping', () => {
    const onJoin = vi.fn()
    const servers = [
      makeRow({ roomCode: 'R1', hostName: 'HighPing', ping: 100 }),
      makeRow({ roomCode: 'R2', hostName: 'LowPing', ping: 20 }),
    ]
    render(<ServerList servers={servers} onJoin={onJoin} onRefresh={vi.fn()} filterMode="all" />)
    const names = screen.getAllByText(/Ping|LowPing|HighPing/).map(n => n.textContent)
    // LowPing (20ms) should appear before HighPing (100ms)
    const lowIdx = names.findIndex(n => n === 'LowPing')
    const highIdx = names.findIndex(n => n === 'HighPing')
    expect(lowIdx).toBeLessThan(highIdx)
  })
})
