import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MatchSetup } from '../MatchSetup'

describe('MatchSetup join policy', () => {
  it('defaults to lobby and confirms with joinPolicy lobby', () => {
    const onConfirm = vi.fn()
    render(<MatchSetup onConfirm={onConfirm} onBack={vi.fn()} />)
    fireEvent.click(screen.getByText('Create Room'))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ joinPolicy: 'lobby' }))
  })

  it('free + password is passed through on confirm', () => {
    const onConfirm = vi.fn()
    render(<MatchSetup onConfirm={onConfirm} onBack={vi.fn()} />)
    fireEvent.click(screen.getByText('Free'))
    fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: 's3cret' } })
    fireEvent.click(screen.getByText('Create Room'))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ joinPolicy: 'free', password: 's3cret' }))
  })

  it('lobby + password is passed through on confirm', () => {
    const onConfirm = vi.fn()
    render(<MatchSetup onConfirm={onConfirm} onBack={vi.fn()} />)
    // joinPolicy defaults to 'lobby' — password field should now be visible
    fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: 'secret' } })
    fireEvent.click(screen.getByText('Create Room'))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ joinPolicy: 'lobby', password: 'secret' }))
  })
})
