import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { GameConsole, ChatFeed, parseChatCommand } from '../GameConsole'
import type { ChatMessage } from '../GameConsole'

afterEach(cleanup)

// ── parseChatCommand ──────────────────────────────────────────────────────────

describe('parseChatCommand', () => {
  it('returns null for unknown commands', () => {
    expect(parseChatCommand('hello', [])).toBeNull()
    expect(parseChatCommand('/foo bar', [])).toBeNull()
  })

  it('/msg <text> → all-scope', () => {
    expect(parseChatCommand('/msg hello world', [])).toEqual({ scope: 'all', text: 'hello world' })
  })

  it('/msg team <text> → team-scope', () => {
    expect(parseChatCommand('/msg team hello', [])).toEqual({ scope: 'team', text: 'hello' })
  })

  it('/msg <playerName> <text> → player-scope when name matches', () => {
    expect(parseChatCommand('/msg Alice hi there', ['Alice', 'Bob'])).toEqual({ scope: 'player', target: 'Alice', text: 'hi there' })
  })

  it('falls back to all-scope when first word is not a known player', () => {
    expect(parseChatCommand('/msg unknown hi', ['Alice'])).toEqual({ scope: 'all', text: 'unknown hi' })
  })
})

// ── GameConsole ───────────────────────────────────────────────────────────────

const msg = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 1, from: 'Alice', scope: 'all', text: 'hello', at: Date.now(), ...overrides,
})

describe('GameConsole', () => {
  const base = {
    open: true,
    prefill: '',
    messages: [],
    onSend: vi.fn(),
    onClose: vi.fn(),
    playerNames: [],
  }

  it('renders nothing when closed', () => {
    const { container } = render(<GameConsole {...base} open={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders input when open', () => {
    render(<GameConsole {...base} />)
    expect(screen.getByPlaceholderText('/msg hello')).toBeInTheDocument()
  })

  it('pre-fills input with prefill prop on open', () => {
    render(<GameConsole {...base} prefill="/msg " />)
    expect((screen.getByPlaceholderText('/msg hello') as HTMLInputElement).value).toBe('/msg ')
  })

  it('calls onSend with input value when Enter is pressed', () => {
    const onSend = vi.fn()
    render(<GameConsole {...base} onSend={onSend} prefill="/msg " />)
    const input = screen.getByPlaceholderText('/msg hello')
    fireEvent.change(input, { target: { value: '/msg hello' } })
    fireEvent.keyDown(input, { code: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('/msg hello')
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(<GameConsole {...base} onClose={onClose} />)
    const input = screen.getByPlaceholderText('/msg hello')
    fireEvent.keyDown(input, { code: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('renders message history', () => {
    render(<GameConsole {...base} messages={[msg({ text: 'hi there' })]} />)
    expect(screen.getByText('hi there')).toBeInTheDocument()
  })

  it('renders error lines (from === "") in a distinct element', () => {
    render(<GameConsole {...base} messages={[msg({ from: '', scope: 'all', text: 'Unknown command: foo' })]} />)
    expect(screen.getByText('Unknown command: foo')).toBeInTheDocument()
  })
})

// ── ChatFeed ─────────────────────────────────────────────────────────────────

describe('ChatFeed', () => {
  it('renders nothing with no messages', () => {
    const { container } = render(<ChatFeed messages={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders recent messages', () => {
    const messages = [msg({ id: 1, text: 'hi', at: Date.now() })]
    render(<ChatFeed messages={messages} />)
    expect(screen.getByText('hi')).toBeInTheDocument()
  })

  it('does not render expired messages (older than 8s)', () => {
    const messages = [msg({ id: 1, text: 'old', at: Date.now() - 9000 })]
    render(<ChatFeed messages={messages} />)
    expect(screen.queryByText('old')).toBeNull()
  })
})
