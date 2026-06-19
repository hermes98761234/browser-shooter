import { useState, useEffect } from 'react'
import { catalogForTeam, canAffordItem } from '../weapons/StoreCatalog'
import { GRENADE_DEFS } from '../weapons/GrenadeDefs'
import { WeaponIcon } from './icons/weapons'
import { BuyPreview } from './BuyPreview'
import type { GrenadeType, ItemKind, StoreItem, Team } from '../types'

export interface GrenadeInventory {
  he: number
  flash: number
  smoke: number
}

interface BuyMenuProps {
  team: Team
  money: number
  owned: string[]
  onBuy: (id: string) => void
  onClose: () => void
  buyPhase?: boolean
  buyPhaseTimer?: number
  grenadeInventory?: GrenadeInventory
}

const SECTIONS: { title: string; kinds: ItemKind[]; slot?: 'primary' | 'secondary' }[] = [
  { title: 'Pistols', kinds: ['weapon'], slot: 'secondary' },
  { title: 'Primary', kinds: ['weapon'], slot: 'primary' },
  { title: 'Gear', kinds: ['armor', 'health', 'speed'] },
  { title: 'Grenades', kinds: ['grenade'] },
  { title: 'Equipment', kinds: ['objective', 'gear'] },
  { title: 'Upgrades', kinds: ['upgrade'] },
]

/** Maps a grenade store item id to its inventory/def key. */
const GRENADE_KEY: Record<string, GrenadeType> = {
  he_grenade: 'he',
  flashbang: 'flash',
  smoke_grenade: 'smoke',
}

export function BuyMenu({ team, money, owned, onBuy, onClose, buyPhase, buyPhaseTimer, grenadeInventory }: BuyMenuProps) {
  const catalog = catalogForTeam(team)
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null)

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
        background: '#15151f', border: '1px solid #3a3a55', padding: isMobile ? 16 : 24,
        width: isMobile ? 'calc(100vw - 16px)' : 600,
        maxWidth: 'calc(100vw - 16px)', maxHeight: '85vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>BUY MENU · {team === 'ct' ? 'CT' : 'T'}</h2>
          <span>${money}</span>
        </div>

        {buyPhase === false && (
          <div style={{ padding: 16, color: '#ffcc00', textAlign: 'center' }}>
            BUY PHASE ENDED - Wait for next round
          </div>
        )}

        {buyPhase === true && buyPhaseTimer !== undefined && (
          <div style={{ padding: 8, color: '#ffcc00', textAlign: 'center', fontSize: 14 }}>
            Buy phase: {Math.ceil(buyPhaseTimer)}s remaining
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
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
                    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)',
                    gap: 8,
                  }}>
                    {items.map((item) => {
                      const grenadeKey = GRENADE_KEY[item.id]
                      const affordable = canAffordItem(money, item.id)
                      let disabled: boolean
                      let label: string
                      if (grenadeKey) {
                        // Grenades are stackable up to a per-type carry limit.
                        const count = grenadeInventory?.[grenadeKey] ?? 0
                        const limit = GRENADE_DEFS[grenadeKey].carryLimit
                        const atLimit = count >= limit
                        disabled = atLimit || !affordable
                        label = atLimit ? `${count}/${limit}` : `$${item.price} · ${count}/${limit}`
                      } else {
                        const isOwned = owned.includes(item.id)
                        disabled = isOwned || !affordable
                        label = isOwned ? 'OWNED' : item.price === 0 ? 'FREE' : `$${item.price}`
                      }
                      return (
                        <button
                          key={item.id}
                          disabled={disabled}
                          onClick={() => onBuy(item.id)}
                          onPointerEnter={() => setSelectedItem(item)}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            padding: '14px 8px', minHeight: 96, background: disabled ? '#1a1a24' : '#23233a',
                            color: disabled ? '#666' : '#fff', border: '1px solid #3a3a55',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {item.icon && <WeaponIcon name={item.icon} size={48} />}
                          <span style={{ fontSize: 12, marginTop: 8 }}>{item.name}</span>
                          <span style={{ fontSize: 11, opacity: 0.7 }}>
                            {label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{
            width: isMobile ? '100%' : 220,
            borderLeft: isMobile ? 'none' : '1px solid #3a3a55',
            borderTop: isMobile ? '1px solid #3a3a55' : 'none',
            paddingLeft: isMobile ? 0 : 16, paddingTop: isMobile ? 16 : 0,
          }}>
            <BuyPreview item={selectedItem} />
          </div>
        </div>

        <button onClick={onClose} style={{ marginTop: 12, width: '100%', padding: 10, background: '#3a3a55', color: '#fff', border: 'none', cursor: 'pointer' }}>
          CLOSE (B)
        </button>
      </div>
    </div>
  )
}
