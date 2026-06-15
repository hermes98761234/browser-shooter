import { STORE_CATALOG, canAfford } from '../weapons/StoreCatalog'
import type { WeaponType } from '../types'

interface BuyMenuProps {
  money: number
  onBuy: (type: WeaponType) => void
  onClose: () => void
}

export function BuyMenu({ money, onBuy, onClose }: BuyMenuProps) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', zIndex: 50, fontFamily: 'monospace', color: '#fff',
    }}>
      <div style={{ background: '#15151f', border: '1px solid #3a3a55', padding: 24, minWidth: 320 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>BUY MENU</h2>
          <span>${money}</span>
        </div>
        {STORE_CATALOG.map((item) => {
          const affordable = canAfford(money, item.type)
          return (
            <button
              key={item.type}
              disabled={!affordable}
              onClick={() => onBuy(item.type)}
              style={{
                display: 'flex', justifyContent: 'space-between', width: '100%', padding: '10px 14px',
                margin: '6px 0', background: affordable ? '#23233a' : '#1a1a24',
                color: affordable ? '#fff' : '#666', border: '1px solid #3a3a55', cursor: affordable ? 'pointer' : 'not-allowed',
              }}
            >
              <span>{item.name}</span>
              <span>${item.price}</span>
            </button>
          )
        })}
        <button onClick={onClose} style={{ marginTop: 16, width: '100%', padding: 10, background: '#3a3a55', color: '#fff', border: 'none', cursor: 'pointer' }}>
          CLOSE (B)
        </button>
      </div>
    </div>
  )
}
