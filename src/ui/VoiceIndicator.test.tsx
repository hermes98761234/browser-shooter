import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { VoiceIndicator } from './VoiceIndicator'

afterEach(cleanup)

describe('VoiceIndicator', () => {
  it('renders a row per active speaker', () => {
    render(<VoiceIndicator speakers={[
      { playerId: 'p1', name: 'Ann' },
      { playerId: 'p2', name: 'Bob' },
    ]} />)
    expect(screen.getByText('Ann')).toBeTruthy()
    expect(screen.getByText('Bob')).toBeTruthy()
  })

  it('renders nothing when no one is talking', () => {
    const { container } = render(<VoiceIndicator speakers={[]} />)
    expect(container.firstChild).toBeNull()
  })
})
