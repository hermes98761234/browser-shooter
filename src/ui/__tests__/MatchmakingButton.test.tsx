import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MatchmakingButton } from '../MatchmakingButton'

describe('MatchmakingButton', () => {
  it('renders quick match button', () => {
    const onFind = vi.fn()
    render(<MatchmakingButton onFind={onFind} queuing={false} />)
    expect(screen.getByText('Quick Match')).toBeDefined()
  })

  it('shows queuing state', () => {
    const onCancel = vi.fn()
    render(<MatchmakingButton onCancel={onCancel} queuing={true} />)
    expect(screen.getByText('Searching...')).toBeDefined()
    expect(screen.getByText('Cancel')).toBeDefined()
  })

  it('calls onFind when clicked while not queuing', () => {
    const onFind = vi.fn()
    render(<MatchmakingButton onFind={onFind} queuing={false} />)
    fireEvent.click(screen.getByText('Quick Match'))
    expect(onFind).toHaveBeenCalled()
  })

  it('calls onCancel when clicked while queuing', () => {
    const onCancel = vi.fn()
    render(<MatchmakingButton onCancel={onCancel} queuing={true} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalled()
  })
})
