import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BuyMenu } from '../BuyMenu'

vi.mock('../BuyPreview', () => ({
  BuyPreview: ({ item }: { item: { name: string; price: number } | null }) => (
    <div data-testid="buy-preview">
      {item ? (
        <>
          <div>{item.name}</div>
          <div>{item.price === 0 ? 'FREE' : `$${item.price}`}</div>
        </>
      ) : (
        <div>Select an item</div>
      )}
    </div>
  ),
}))

describe('BuyMenu', () => {
  it('shows the team catalog and hides the other team', () => {
    render(<BuyMenu team="ct" money={16000} owned={[]} onBuy={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('M4')).toBeTruthy()       // CT weapon
    expect(screen.queryByText('AK-47')).toBeNull()    // T weapon hidden
    expect(screen.getByText('Kevlar')).toBeTruthy()   // shared gear
  })

  it('calls onBuy with the item id', () => {
    const onBuy = vi.fn()
    render(<BuyMenu team="t" money={16000} owned={[]} onBuy={onBuy} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('AK-47'))
    expect(onBuy).toHaveBeenCalledWith('ak')
  })

  it('disables items the player cannot afford', () => {
    render(<BuyMenu team="ct" money={100} owned={[]} onBuy={vi.fn()} onClose={vi.fn()} />)
    const m4 = screen.getByText('M4').closest('button') as HTMLButtonElement
    expect(m4.disabled).toBe(true)
  })

  it('marks owned items and does not fire onBuy for them', () => {
    const onBuy = vi.fn()
    render(<BuyMenu team="ct" money={16000} owned={['m4']} onBuy={onBuy} onClose={vi.fn()} />)
    const m4 = screen.getByText('M4').closest('button') as HTMLButtonElement
    expect(m4.disabled).toBe(true)
    fireEvent.click(m4)
    expect(onBuy).not.toHaveBeenCalled()
  })

  describe('buy preview', () => {
    it('shows Select an item text before hover', () => {
      render(<BuyMenu team="ct" money={16000} owned={[]} onBuy={vi.fn()} onClose={vi.fn()} />)
      expect(screen.getByText('Select an item')).toBeTruthy()
    })

    it('shows preview item name when hovered', () => {
      render(<BuyMenu team="ct" money={16000} owned={[]} onBuy={vi.fn()} onClose={vi.fn()} />)
      const m4 = screen.getByText('M4').closest('button') as HTMLButtonElement
      fireEvent.mouseEnter(m4)
      expect(screen.queryByText('Select an item')).toBeNull()
    })
  })

  describe('buy phase', () => {
    it('shows buy phase warning when not in buy phase', () => {
      render(<BuyMenu team="ct" money={800} owned={[]} onBuy={vi.fn()} onClose={vi.fn()} buyPhase={false} />)
      expect(screen.getByText(/BUY PHASE ENDED/)).toBeTruthy()
    })

    it('does not show warning when in buy phase', () => {
      render(<BuyMenu team="ct" money={800} owned={[]} onBuy={vi.fn()} onClose={vi.fn()} buyPhase={true} />)
      expect(screen.queryByText(/BUY PHASE ENDED/)).toBeNull()
    })

    it('shows buy phase timer when in buy phase', () => {
      render(<BuyMenu team="ct" money={800} owned={[]} onBuy={vi.fn()} onClose={vi.fn()} buyPhase={true} buyPhaseTimer={10} />)
      expect(screen.getByText(/10s/)).toBeTruthy()
    })
  })
})
