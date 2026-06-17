import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HelpModal } from '../HelpModal'

describe('HelpModal', () => {
  it('renders the help heading', () => {
    render(<HelpModal onClose={vi.fn()} />)
    expect(screen.getByText('Help')).toBeInTheDocument()
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

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<HelpModal onClose={onClose} />)
    screen.getByText('CLOSE').click()
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
