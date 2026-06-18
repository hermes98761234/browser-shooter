import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MultiplayerMenu } from '../MultiplayerMenu'
import type { ServerRow } from '../ServerList'

const baseProps = {
  roomCode: null as string | null,
  players: [] as string[],
  isHost: false,
  servers: [] as ServerRow[],
  onHost: vi.fn(), onJoin: vi.fn(), onStart: vi.fn(), onBack: vi.fn(), onRefresh: vi.fn(),
}

describe('MultiplayerMenu', () => {
  it('host flow shows the room code + player list in the lobby', () => {
    const onStart = vi.fn()
    render(<MultiplayerMenu {...baseProps} roomCode="ROOM42" players={['You', 'Bob']} isHost onStart={onStart} />)
    expect(screen.getByText('ROOM42')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    fireEvent.click(screen.getByText(/start/i))
    expect(onStart).toHaveBeenCalled()
  })

  it('join flow submits an entered code', () => {
    const onJoin = vi.fn()
    render(<MultiplayerMenu {...baseProps} onJoin={onJoin} />)
    fireEvent.change(screen.getByPlaceholderText(/room code/i), { target: { value: 'ABC123' } })
    fireEvent.click(screen.getByText(/^join$/i))
    expect(onJoin).toHaveBeenCalledWith('ABC123')
  })

  it('renders the server list and joins a listed game', () => {
    const onJoin = vi.fn()
    const servers: ServerRow[] = [
      { roomCode: 'ROOM1', hostName: 'Alice', players: 1, maxPlayers: 8, status: 'lobby', ping: 30 },
    ]
    render(<MultiplayerMenu {...baseProps} servers={servers} onJoin={onJoin} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /^join$/i })[0])
    expect(onJoin).toHaveBeenCalledWith('ROOM1')
  })

  it('shows three connection options on the main menu', () => {
    render(<MultiplayerMenu {...baseProps} />)
    expect(screen.getByText('Quick Match')).toBeInTheDocument()
    expect(screen.getByText('Create Room')).toBeInTheDocument()
  })

  it('shows server filters on the main menu', () => {
    render(<MultiplayerMenu {...baseProps} />)
    expect(screen.getByText('Mode')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })
})
