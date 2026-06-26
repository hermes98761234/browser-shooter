import React, { useEffect, useRef, useState } from 'react'

export interface ChatMessage {
  id: number
  from: string        // '' for system/error lines
  scope: 'all' | 'team' | 'player'
  target?: string     // defined when scope === 'player'
  text: string
  at: number          // Date.now() — used by ChatFeed for expiry
}

export function parseChatCommand(
  text: string,
  playerNames: string[]
): { scope: 'all' | 'team' | 'player'; target?: string; text: string } | null {
  if (!text.startsWith('/msg ')) return null
  const rest = text.slice(5)
  if (rest.startsWith('team ')) return { scope: 'team', text: rest.slice(5) }
  const first = rest.split(' ')[0]
  if (playerNames.includes(first)) return { scope: 'player', target: first, text: rest.slice(first.length + 1) }
  return { scope: 'all', text: rest }
}

const SCOPE_COLOR: Record<string, string> = { all: '#ffffff', team: '#7bc87b', player: '#f0c060' }

function lineColor(msg: ChatMessage): string {
  return msg.from ? SCOPE_COLOR[msg.scope] ?? '#ffffff' : '#ff6060'
}

function linePrefix(msg: ChatMessage): string {
  if (msg.scope === 'team') return '[TEAM] '
  if (msg.scope === 'player') return `[DM→${msg.target}] `
  return ''
}

function MsgLine({ msg }: { msg: ChatMessage }) {
  const color = lineColor(msg)
  if (!msg.from) return <div style={{ color, opacity: 0.8 }}>{msg.text}</div>
  return (
    <div style={{ color, wordBreak: 'break-word' }}>
      <span style={{ opacity: 0.7 }}>{linePrefix(msg)}</span>
      <span style={{ color: '#aaa' }}>{msg.from}: </span>
      {msg.text}
    </div>
  )
}

interface GameConsoleProps {
  open: boolean
  prefill: string
  messages: ChatMessage[]
  onSend: (text: string) => void
  onClose: () => void
  playerNames: string[]
}

export const GameConsole: React.FC<GameConsoleProps> = ({
  open, prefill, messages, onSend, onClose,
}) => {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setInput(prefill)
    document.exitPointerLock?.()
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [open, prefill])

  useEffect(() => {
    if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight
  }, [messages.length, open])

  if (!open) return null

  function onKeyDown(e: React.KeyboardEvent) {
    e.stopPropagation()   // prevents game hotkeys firing while console is open
    if (e.code === 'Escape' || e.code === 'Backquote') { e.preventDefault(); onClose(); return }
    if (e.code === 'Enter') { e.preventDefault(); onSend(input); setInput('') }
  }

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0,
      width: '40%', maxHeight: '50%',
      display: 'flex', flexDirection: 'column',
      background: 'rgba(0,0,0,0.78)',
      fontFamily: 'monospace', fontSize: 13,
      zIndex: 80, pointerEvents: 'auto',
    }}>
      <div ref={historyRef} style={{
        overflowY: 'auto', flex: 1, padding: '8px 10px',
        display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0,
      }}>
        {messages.map(msg => <MsgLine key={msg.id} msg={msg} />)}
      </div>
      <input
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="/msg hello"
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: 'none', borderTop: '1px solid rgba(255,255,255,0.15)',
          color: '#fff', fontFamily: 'monospace', fontSize: 13,
          padding: '6px 10px', outline: 'none', flexShrink: 0,
        }}
      />
    </div>
  )
}

export const ChatFeed: React.FC<{ messages: ChatMessage[] }> = ({ messages }) => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const visible = messages.filter(m => now - m.at < 8000).slice(-6)
  if (!visible.length) return null

  return (
    <div style={{
      position: 'absolute', bottom: 40, left: 0,
      display: 'flex', flexDirection: 'column', gap: 2,
      fontFamily: 'monospace', fontSize: 13,
      zIndex: 55, pointerEvents: 'none', padding: '0 10px',
    }}>
      {visible.map(msg => (
        <div key={msg.id} style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
          <MsgLine msg={msg} />
        </div>
      ))}
    </div>
  )
}
