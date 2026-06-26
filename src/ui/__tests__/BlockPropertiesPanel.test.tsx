import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BlockPropertiesPanel } from '../BlockPropertiesPanel'
import type { ZoneStructure } from '../../zones/ZoneDef'

const wall: ZoneStructure = { center: [0, 1.5, 0], size: [4, 3, 2], material: 'wall' }

describe('BlockPropertiesPanel', () => {
  it('renders X/Y/Z and W/H/D inputs with current values', () => {
    render(<BlockPropertiesPanel structure={wall} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    // 6 number inputs: X=0, Y=1.5, Z=0, W=4, H=3, D=2
    const inputs = screen.getAllByRole('spinbutton')
    expect(inputs).toHaveLength(6)
    expect((inputs[0] as HTMLInputElement).value).toBe('0')   // X
    expect((inputs[1] as HTMLInputElement).value).toBe('1.5') // Y
    expect((inputs[3] as HTMLInputElement).value).toBe('4')   // W
    expect((inputs[4] as HTMLInputElement).value).toBe('3')   // H
    expect((inputs[2] as HTMLInputElement).value).toBe('0')   // Z
    expect((inputs[5] as HTMLInputElement).value).toBe('2')   // D
  })

  it('calls onUpdate with new center when X input changes', () => {
    const onUpdate = vi.fn()
    render(<BlockPropertiesPanel structure={wall} onUpdate={onUpdate} onDelete={vi.fn()} />)
    const xInput = screen.getAllByRole('spinbutton')[0]
    fireEvent.change(xInput, { target: { value: '5' } })
    fireEvent.blur(xInput)
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ center: [5, 1.5, 0] }))
  })

  it('calls onUpdate with new height when H input changes', () => {
    const onUpdate = vi.fn()
    render(<BlockPropertiesPanel structure={wall} onUpdate={onUpdate} onDelete={vi.fn()} />)
    const hInput = screen.getAllByRole('spinbutton')[4]
    fireEvent.change(hInput, { target: { value: '5' } })
    fireEvent.blur(hInput)
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ size: [4, 5, 2] }))
  })

  it('calls onDelete when Delete Block button clicked', () => {
    const onDelete = vi.fn()
    render(<BlockPropertiesPanel structure={wall} onUpdate={vi.fn()} onDelete={onDelete} />)
    fireEvent.click(screen.getByText('Delete Block'))
    expect(onDelete).toHaveBeenCalled()
  })

  it('calls onUpdate with new material when dropdown changes', () => {
    const onUpdate = vi.fn()
    render(<BlockPropertiesPanel structure={wall} onUpdate={onUpdate} onDelete={vi.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'crate' } })
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ material: 'crate' }))
  })
})
