import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TeamSelect } from '../TeamSelect'
import { DEFAULT_ZONE_ID, ZONES } from '../../zones/registry'

describe('TeamSelect', () => {
  it('calls onSelect with the team and the default map id', () => {
    const onSelect = vi.fn()
    render(<TeamSelect onSelect={onSelect} />)
    fireEvent.click(screen.getByText(/Counter-Terrorist/i))
    expect(onSelect).toHaveBeenCalledWith('ct', DEFAULT_ZONE_ID)
    fireEvent.click(screen.getByText(/^Terrorist/i))
    expect(onSelect).toHaveBeenCalledWith('t', DEFAULT_ZONE_ID)
  })

  it('lets the player choose a map before picking a side', () => {
    const onSelect = vi.fn()
    render(<TeamSelect onSelect={onSelect} />)
    const haze = ZONES.find((z) => z.id === 'haze')!
    fireEvent.click(screen.getByText(haze.name))
    fireEvent.click(screen.getByText(/Counter-Terrorist/i))
    expect(onSelect).toHaveBeenCalledWith('ct', 'haze')
  })

  it('renders every selectable map', () => {
    render(<TeamSelect onSelect={vi.fn()} />)
    for (const z of ZONES) expect(screen.getByText(z.name)).toBeTruthy()
  })
})
