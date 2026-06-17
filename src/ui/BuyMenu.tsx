import { useState, useEffect } from 'react'
import { catalogForTeam, canAffordItem } from '../weapons/StoreCatalog'
import { WeaponIcon } from './icons/weapons'
import type { ItemKind, Team } from '../types'

interface BuyMenuProps {
  team: Team
  money: number
  owned: string[]
  onBuy: (id: string) => void
  onClose: () => void
}

const SECTIONS: { title: string; kinds: ItemKind[]; slot?: 'primary' | 'secondary' }[] = [
  { title: 'Pistols', kinds: ['weapon'], slot: 'secondary' },
  { title: 'Primary', kinds: ['weapon'], slot: 'primary' },
  { title: 'Gear', kinds: ['armor', 'health', 'speed'] },
  { title: 'Upgrades', kinds: ['upgrade'] },
]

export function BuyMenu({ team, money, owned, onBuy, onClose }: BuyMenuProps) {
  const catalog = catalogForTeam(team)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', zIndex: 50, fontFamily: 'monospace', color: '#fff',
    }}>
      <div style={{
        background: '#15151f', border: '1px solid #3a3a55', padding: 24,
        minWidth: isMobile ? 320 : 600, maxHeight: '80vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>BUY MENU · {team === 'ct' ? 'CT' : 'T'}</h2>
          <span>${money}</span>
        </div>

        {SECTIONS.map((section) => {
          const items = catalog.filter(
            (i) => section.kinds.includes(i.kind) && (section.slot ? i.slot === section.slot : true),
          )
          if (items.length === 0) return null
          return (
            <div key={section.title} style={{ marginBottom: 12 }}>
              <div style={{ color: '#8a8aad', fontSize: 12, margin: '8px 0 4px' }}>{section.title}</div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(5, 1fr)',
                gap: 8,
              }}>
                {items.map((item) => {
                  const isOwned = owned.includes(item.id)
                  const affordable = canAffordItem(money, item.id)
                  const disabled = isOwned || !affordable
                  return (
                    <button
                      key={item.id}
                      disabled={disabled}
                      onClick={() => onBuy(item.id)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: '12px 8px', background: disabled ? '#1a1a24' : '#23233a',
                        color: disabled ? '#666' : '#fff', border: '1px solid #3a3a55',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {item.icon && <WeaponIcon name={item.icon} size={48} />}
                      <span style={{ fontSize: 12, marginTop: 8 }}>{item.name}</span>
                      <span style={{ fontSize: 11, opacity: 0.7 }}>
                        {isOwned ? 'OWNED' : item.price === 0 ? 'FREE' : `$${item.price}`}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        <button onClick={onClose} style={{ marginTop: 12, width: '100%', padding: 10, background: '#3a3a55', color: '#fff', border: 'none', cursor: 'pointer' }}>
          CLOSE (B)
        </button>
      </div>
    </div>
  )
}
