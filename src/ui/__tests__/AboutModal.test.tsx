import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AboutModal } from '../AboutModal'

describe('AboutModal', () => {
  it('renders the about heading', () => {
    render(<AboutModal onClose={vi.fn()} />)
    expect(screen.getByText('About')).toBeInTheDocument()
  })

  it('displays version info', () => {
    render(<AboutModal onClose={vi.fn()} />)
    expect(screen.getByText('VERSION')).toBeInTheDocument()
    expect(screen.getByText('0.1.0')).toBeInTheDocument()
  })

  it('displays build info', () => {
    render(<AboutModal onClose={vi.fn()} />)
    expect(screen.getByText('BUILD')).toBeInTheDocument()
    expect(screen.getByText('Browser Shooter')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<AboutModal onClose={onClose} />)
    screen.getByText('CLOSE').click()
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
