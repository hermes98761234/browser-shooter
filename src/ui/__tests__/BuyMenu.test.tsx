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

  describe('grenades and equipment', () => {
    it('shows the Grenades section with all three grenades', () => {
      render(<BuyMenu team="ct" money={16000} owned={[]} onBuy={vi.fn()} onClose={vi.fn()} />)
      expect(screen.getByText('Grenades')).toBeTruthy()
      expect(screen.getByText('HE Grenade')).toBeTruthy()
      expect(screen.getByText('Flashbang')).toBeTruthy()
      expect(screen.getByText('Smoke Grenade')).toBeTruthy()
    })

    it('shows the Defuse Kit in Equipment for CT only', () => {
      render(<BuyMenu team="ct" money={16000} owned={[]} onBuy={vi.fn()} onClose={vi.fn()} />)
      expect(screen.getByText('Equipment')).toBeTruthy()
      expect(screen.getByText('Defuse Kit')).toBeTruthy()
      expect(screen.queryByText('C4 Bomb')).toBeNull()
    })

    it('shows the C4 Bomb in Equipment for T only', () => {
      render(<BuyMenu team="t" money={16000} owned={[]} onBuy={vi.fn()} onClose={vi.fn()} />)
      expect(screen.getByText('C4 Bomb')).toBeTruthy()
      expect(screen.queryByText('Defuse Kit')).toBeNull()
    })

    it('keeps a grenade buyable until the carry limit is reached', () => {
      const onBuy = vi.fn()
      // flashbang carryLimit is 2: one owned should still be buyable
      render(
        <BuyMenu team="ct" money={16000} owned={['flashbang']} onBuy={onBuy}
          onClose={vi.fn()} grenadeInventory={{ he: 0, flash: 1, smoke: 0 }} />,
      )
      const flash = screen.getByText('Flashbang').closest('button') as HTMLButtonElement
      expect(flash.disabled).toBe(false)
      fireEvent.click(flash)
      expect(onBuy).toHaveBeenCalledWith('flashbang')
    })

    it('disables a grenade once the carry limit is reached', () => {
      render(
        <BuyMenu team="ct" money={16000} owned={['flashbang']} onBuy={vi.fn()}
          onClose={vi.fn()} grenadeInventory={{ he: 0, flash: 2, smoke: 0 }} />,
      )
      const flash = screen.getByText('Flashbang').closest('button') as HTMLButtonElement
      expect(flash.disabled).toBe(true)
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
