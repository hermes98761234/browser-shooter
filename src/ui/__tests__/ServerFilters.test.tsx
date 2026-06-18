import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ServerFilters } from '../ServerFilters'

describe('ServerFilters', () => {
  it('renders filter controls', () => {
    const onChange = vi.fn()
    render(<ServerFilters filter={{ mode: 'all', status: 'all', playerCount: 'all' }} onChange={onChange} />)
    expect(screen.getByText('Mode')).toBeDefined()
    expect(screen.getByText('Status')).toBeDefined()
  })

  it('calls onChange when mode filter changes', () => {
    const onChange = vi.fn()
    render(<ServerFilters filter={{ mode: 'all', status: 'all', playerCount: 'all' }} onChange={onChange} />)
    fireEvent.click(screen.getByText('Competitive'))
    expect(onChange).toHaveBeenCalledWith({ mode: 'competitive', status: 'all', playerCount: 'all' })
  })

  it('calls onChange when status filter changes', () => {
    const onChange = vi.fn()
    render(<ServerFilters filter={{ mode: 'all', status: 'all', playerCount: 'all' }} onChange={onChange} />)
    fireEvent.click(screen.getByText('In Progress'))
    expect(onChange).toHaveBeenCalledWith({ mode: 'all', status: 'in-progress', playerCount: 'all' })
  })

  it('highlights the active mode button', () => {
    const onChange = vi.fn()
    render(<ServerFilters filter={{ mode: 'coop', status: 'all', playerCount: 'all' }} onChange={onChange} />)
    const coopBtn = screen.getByText('Co-op')
    expect(coopBtn.getAttribute('data-active')).toBe('true')
  })
})
