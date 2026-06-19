import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PreJoinPrompt } from '../PreJoinPrompt'

describe('PreJoinPrompt', () => {
  it('submits the chosen team and password', () => {
    const onSubmit = vi.fn()
    render(<PreJoinPrompt protected error={null} onSubmit={onSubmit} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /^T$/ }))
    fireEvent.change(screen.getByPlaceholderText(/password/i), { target: { value: 'pw' } })
    fireEvent.click(screen.getByText(/join match/i))
    expect(onSubmit).toHaveBeenCalledWith('t', 'pw')
  })

  it('hides the password field for open games and shows errors', () => {
    render(<PreJoinPrompt error="Wrong password" onSubmit={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByPlaceholderText(/password/i)).toBeNull()
    expect(screen.getByText('Wrong password')).toBeInTheDocument()
  })
})
