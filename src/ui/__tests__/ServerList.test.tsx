import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ServerList, type ServerRow } from '../ServerList'

const row: ServerRow = {
  roomCode: 'ROOM1', hostName: 'Alice', players: 2, maxPlayers: 8, status: 'lobby', ping: 42,
}

describe('ServerList', () => {
  it('renders a row with host, players, status and ping, and joins on click', () => {
    const onJoin = vi.fn()
    render(<ServerList servers={[row]} onJoin={onJoin} onRefresh={vi.fn()} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('2/8')).toBeInTheDocument()
    expect(screen.getByText(/lobby/i)).toBeInTheDocument()
    expect(screen.getByText('42 ms')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^join$/i }))
    expect(onJoin).toHaveBeenCalledWith('ROOM1')
  })

  it('shows a dash when ping is unknown', () => {
    render(<ServerList servers={[{ ...row, ping: null }]} onJoin={vi.fn()} onRefresh={vi.fn()} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows an empty state and a working refresh button when there are no servers', () => {
    const onRefresh = vi.fn()
    render(<ServerList servers={[]} onJoin={vi.fn()} onRefresh={onRefresh} />)
    expect(screen.getByText(/no games found/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))
    expect(onRefresh).toHaveBeenCalled()
  })
})
