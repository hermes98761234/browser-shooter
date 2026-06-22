import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HelpModal } from '../HelpModal'

describe('HelpModal', () => {
  it('renders the help heading', () => {
    render(<HelpModal onClose={vi.fn()} />)
    expect(screen.getAllByText('Help').length).toBeGreaterThanOrEqual(1)
  })

  it('displays controls section', () => {
    render(<HelpModal onClose={vi.fn()} />)
    expect(screen.getByText('CONTROLS')).toBeInTheDocument()
  })

  it('displays key bindings', () => {
    render(<HelpModal onClose={vi.fn()} />)
    expect(screen.getByText('WASD')).toBeInTheDocument()
    expect(screen.getByText('Move')).toBeInTheDocument()
    expect(screen.getByText('Mouse')).toBeInTheDocument()
    expect(screen.getByText('Look')).toBeInTheDocument()
  })

  it('displays bots section', () => {
    render(<HelpModal onClose={vi.fn()} />)
    expect(screen.getByText('HOW TO WORK WITH BOTS')).toBeInTheDocument()
    expect(screen.getByText('Add CT Bot')).toBeInTheDocument()
    expect(screen.getByText('Add T Bot')).toBeInTheDocument()
    expect(screen.getByText('Remove Last Bot')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<HelpModal onClose={onClose} />)
    screen.getByText('CLOSE').click()
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
