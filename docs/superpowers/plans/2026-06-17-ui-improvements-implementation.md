# UI Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 404 sound errors, add weapon icons to buy menu, redesign main menu with About/Help, and fix cursor disappearing on menu screens.

**Architecture:** Four independent improvements that can be implemented in sequence. Sound files move to public directory. Buy menu gets SVG icons and responsive grid. Main menu switches to vertical layout with new modal components. Controls class receives gameState parameter to prevent pointer lock on menus.

**Tech Stack:** TypeScript, React, Vite, SVG

## Global Constraints

- Sound files must be in `public/sounds/` for Vite to serve them correctly
- Icons are SVG components in `src/ui/icons/`
- Menu modals follow existing UI patterns (absolute positioning, dark backgrounds)
- Controls class must receive gameState getter function

---

### Task 1: Move Sound Files to Public Directory

**Files:**
- Move: `src/audio/sounds/*.mp3` → `public/sounds/*.mp3`
- Delete: `src/audio/sounds/` directory

**Interfaces:**
- Consumes: None
- Produces: Sound files at correct path for AudioManager

- [ ] **Step 1: Create public/sounds directory**

```bash
mkdir -p public/sounds
```

- [ ] **Step 2: Move sound files**

```bash
mv src/audio/sounds/*.mp3 public/sounds/
```

- [ ] **Step 3: Remove empty directory**

```bash
rmdir src/audio/sounds
```

- [ ] **Step 4: Verify files exist**

```bash
ls public/sounds/
```

Expected output:
```
enemy_death.mp3  enemy_hit.mp3  pickup.mp3  pistol.mp3  player_death.mp3
player_hit.mp3  rifle.mp3  shotgun.mp3  wave_start.mp3
```

- [ ] **Step 5: Commit**

```bash
git add public/sounds/ src/audio/sounds/
git commit -m "fix: move sound files to public directory for correct serving"
```

---

### Task 2: Add Icon Field to StoreItem Type

**Files:**
- Modify: `src/types.ts:44-53`

**Interfaces:**
- Consumes: None
- Produces: `icon` field on `StoreItem` type

- [ ] **Step 1: Add icon field to StoreItem**

Open `src/types.ts` and update StoreItem interface:

```typescript
export interface StoreItem {
  id: string
  name: string
  price: number
  kind: ItemKind
  team?: Team
  slot?: 'primary' | 'secondary'
  weaponType?: WeaponType
  effects?: StatEffect
  icon?: string  // SVG icon component name
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add icon field to StoreItem type"
```

---

### Task 3: Create SVG Icon Components

**Files:**
- Create: `src/ui/icons/weapons.tsx`

**Interfaces:**
- Consumes: None
- Produces: `WeaponIcon` component that renders SVG based on icon name

- [ ] **Step 1: Create icons directory**

```bash
mkdir -p src/ui/icons
```

- [ ] **Step 2: Create weapons.tsx with SVG icons**

```tsx
import React from 'react'

interface IconProps {
  name: string
  size?: number
}

const icons: Record<string, React.FC<{ size: number }>> = {
  pistol: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M8 28h32v8H8z M36 28h12l8 8v4h-8V28z M12 36h20v4H12z M16 40h12v8H16z"/>
    </svg>
  ),
  usp: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M10 26h30v6H10z M38 26h10l6 6v4h-8V26z M14 32h22v4H14z M18 36h10v8H18z"/>
    </svg>
  ),
  glock: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M8 28h28v6H8z M34 28h14l6 6v4h-10V28z M12 34h20v4H12z M16 38h12v8H16z"/>
    </svg>
  ),
  deagle: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M6 24h36v10H6z M40 24h14l8 10v4h-12V24z M10 34h28v4H10z M14 38h16v10H14z"/>
    </svg>
  ),
  m4: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M4 26h48v6H4z M4 32h20v4H4z M40 32h16v4H40z M24 32h12v8H24z M8 36h12v8H8z"/>
    </svg>
  ),
  aug: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M4 24h50v6H4z M4 30h22v4H4z M42 30h14v4H42z M24 30h14v10H24z M8 34h10v8H8z"/>
    </svg>
  ),
  ak: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M4 26h48v6H4z M4 32h18v4H4z M38 32h18v4H38z M20 32h14v10H20z M8 36h8v8H8z"/>
    </svg>
  ),
  galil: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M4 26h46v6H4z M4 32h20v4H4z M40 32h16v4H40z M22 32h14v10H22z M8 36h10v8H8z"/>
    </svg>
  ),
  mp5: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M8 28h32v6H8z M38 28h12l6 6v4H44V28z M12 34h24v4H12z M16 38h14v8H16z"/>
    </svg>
  ),
  shotgun: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M4 24h52v4H4z M4 28h24v4H4z M44 28h16v4H44z M26 28h14v12H26z M8 32h14v8H8z"/>
    </svg>
  ),
  awp: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M2 26h56v4H2z M2 30h26v4H2z M46 30h16v4H46z M26 30l4 14h8l4-14z M6 34h16v6H6z"/>
    </svg>
  ),
  kevlar: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M16 12h32v40H16z M20 16h24v32H20z M28 20h8v8h-8z"/>
    </svg>
  ),
  kevlar_helmet: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M16 8h32v24H16z M20 32h24v8H20z M28 40h8v12h-8z M24 16h16v4H24z"/>
    </svg>
  ),
  medkit: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M16 16h32v32H16z M28 20h8v24h-8z M20 28h24v8H20z"/>
    </svg>
  ),
  boots: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M16 12h12v36H16z M36 12h12v28H36z M12 48h40v8H12z"/>
    </svg>
  ),
}

export const WeaponIcon: React.FC<IconProps> = ({ name, size = 64 }) => {
  const IconComponent = icons[name]
  if (!IconComponent) return <div style={{ width: size, height: size, background: '#333' }} />
  return <IconComponent size={size} />
}

export const iconNames = Object.keys(icons)
```

- [ ] **Step 3: Commit**

```bash
git add src/ui/icons/weapons.tsx
git commit -m "feat: add SVG weapon icon components"
```

---

### Task 4: Update StoreCatalog with Icons

**Files:**
- Modify: `src/weapons/StoreCatalog.ts:3-28`

**Interfaces:**
- Consumes: `icon` field from StoreItem type
- Produces: Store items with icon references

- [ ] **Step 1: Add icons to StoreCatalog**

```typescript
import type { StoreItem, Team } from '../types'

export const STORE_CATALOG: StoreItem[] = [
  // --- secondary (pistols) ---
  { id: 'pistol', name: 'Pistol', price: 0,   kind: 'weapon', slot: 'secondary', weaponType: 'pistol', icon: 'pistol' },
  { id: 'usp',    name: 'USP',    price: 200, kind: 'weapon', slot: 'secondary', weaponType: 'usp',   team: 'ct', icon: 'usp' },
  { id: 'glock',  name: 'Glock',  price: 200, kind: 'weapon', slot: 'secondary', weaponType: 'glock', team: 't', icon: 'glock' },
  { id: 'deagle', name: 'Deagle', price: 700, kind: 'weapon', slot: 'secondary', weaponType: 'deagle', icon: 'deagle' },

  // --- primary ---
  { id: 'm4',      name: 'M4',      price: 2700, kind: 'weapon', slot: 'primary', weaponType: 'm4',    team: 'ct', icon: 'm4' },
  { id: 'aug',     name: 'AUG',     price: 3300, kind: 'weapon', slot: 'primary', weaponType: 'aug',   team: 'ct', icon: 'aug' },
  { id: 'ak',      name: 'AK-47',   price: 2500, kind: 'weapon', slot: 'primary', weaponType: 'ak',    team: 't', icon: 'ak' },
  { id: 'galil',   name: 'Galil',   price: 2000, kind: 'weapon', slot: 'primary', weaponType: 'galil', team: 't', icon: 'galil' },
  { id: 'mp5',     name: 'MP5',     price: 1500, kind: 'weapon', slot: 'primary', weaponType: 'mp5', icon: 'mp5' },
  { id: 'shotgun', name: 'Shotgun', price: 1200, kind: 'weapon', slot: 'primary', weaponType: 'shotgun', icon: 'shotgun' },
  { id: 'awp',     name: 'AWP',     price: 4750, kind: 'weapon', slot: 'primary', weaponType: 'awp', icon: 'awp' },

  // --- gear (shared) ---
  { id: 'kevlar',        name: 'Kevlar',          price: 650,  kind: 'armor',  effects: { armor: 50 }, icon: 'kevlar' },
  { id: 'kevlar_helmet', name: 'Kevlar + Helmet',  price: 1000, kind: 'armor',  effects: { armor: 100 }, icon: 'kevlar_helmet' },
  { id: 'medkit',        name: 'Medkit',           price: 800,  kind: 'health', effects: { maxHealth: 25 }, icon: 'medkit' },
  { id: 'boots',         name: 'Light Boots',      price: 500,  kind: 'speed',  effects: { speedMult: 1.15 }, icon: 'boots' },

  // --- upgrades (shared, applied to equipped weapon) ---
  { id: 'ext_mag',     name: 'Extended Mag', price: 300, kind: 'upgrade', effects: { weapon: { ammoMult: 1.5 } } },
  { id: 'fast_reload', name: 'Fast Reload',  price: 400, kind: 'upgrade', effects: { weapon: { reloadMult: 0.7 } } },
]

/** Items available to a team: shared (no team) plus that team's own. */
export function catalogForTeam(team: Team): StoreItem[] {
  return STORE_CATALOG.filter((i) => i.team === undefined || i.team === team)
}

export function findItem(id: string): StoreItem | undefined {
  return STORE_CATALOG.find((i) => i.id === id)
}

export function canAffordItem(money: number, id: string): boolean {
  const item = findItem(id)
  return !!item && money >= item.price
}
```

- [ ] **Step 2: Commit**

```bash
git add src/weapons/StoreCatalog.ts
git commit -m "feat: add icon references to store catalog"
```

---

### Task 5: Rewrite BuyMenu with Grid Layout

**Files:**
- Modify: `src/ui/BuyMenu.tsx`

**Interfaces:**
- Consumes: `icon` field from StoreItem, `WeaponIcon` component
- Produces: Responsive grid buy menu

- [ ] **Step 1: Rewrite BuyMenu.tsx**

```tsx
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
  const isMobile = window.innerWidth < 768

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
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/BuyMenu.tsx
git commit -m "feat: rewrite buy menu with responsive grid and icons"
```

---

### Task 6: Create AboutModal Component

**Files:**
- Create: `src/ui/AboutModal.tsx`

**Interfaces:**
- Consumes: None
- Produces: `AboutModal` component

- [ ] **Step 1: Create AboutModal.tsx**

```tsx
import React from 'react'

interface AboutModalProps {
  onClose: () => void
}

export const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', zIndex: 100, fontFamily: 'monospace', color: '#fff',
    }}>
      <div style={{
        background: '#15151f', border: '1px solid #3a3a55', padding: 32,
        minWidth: 320, maxWidth: 400,
      }}>
        <h2 style={{ margin: '0 0 20px', color: '#ff6600' }}>About</h2>
        
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#8a8aad', fontSize: 12 }}>VERSION</div>
          <div style={{ fontSize: 18 }}>0.1.0</div>
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: '#8a8aad', fontSize: 12 }}>BUILD</div>
          <div style={{ fontSize: 14 }}>Browser Shooter</div>
        </div>
        
        <div style={{ marginBottom: 24 }}>
          <div style={{ color: '#8a8aad', fontSize: 12 }}>CREDITS</div>
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>
            Built with Three.js, React, Vite
          </div>
        </div>
        
        <button onClick={onClose} style={{
          width: '100%', padding: 12, background: '#3a3a55', color: '#fff',
          border: 'none', cursor: 'pointer', fontSize: 14,
        }}>
          CLOSE
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/AboutModal.tsx
git commit -m "feat: add About modal component"
```

---

### Task 7: Create HelpModal Component

**Files:**
- Create: `src/ui/HelpModal.tsx`

**Interfaces:**
- Consumes: None
- Produces: `HelpModal` component

- [ ] **Step 1: Create HelpModal.tsx**

```tsx
import React from 'react'

interface HelpModalProps {
  onClose: () => void
}

export const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', zIndex: 100, fontFamily: 'monospace', color: '#fff',
    }}>
      <div style={{
        background: '#15151f', border: '1px solid #3a3a55', padding: 32,
        minWidth: 320, maxWidth: 400,
      }}>
        <h2 style={{ margin: '0 0 20px', color: '#ff6600' }}>Help</h2>
        
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 12, fontSize: 14, color: '#8a8aad' }}>CONTROLS</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', fontSize: 14 }}>
            <span style={{ opacity: 0.6 }}>WASD</span><span>Move</span>
            <span style={{ opacity: 0.6 }}>Mouse</span><span>Look</span>
            <span style={{ opacity: 0.6 }}>Click</span><span>Shoot</span>
            <span style={{ opacity: 0.6 }}>1-3</span><span>Switch Weapon</span>
            <span style={{ opacity: 0.6 }}>R</span><span>Reload</span>
            <span style={{ opacity: 0.6 }}>Space</span><span>Jump</span>
            <span style={{ opacity: 0.6 }}>Tab</span><span>Scoreboard</span>
            <span style={{ opacity: 0.6 }}>B</span><span>Buy Menu</span>
            <span style={{ opacity: 0.6 }}>M</span><span>Mute Sound</span>
            <span style={{ opacity: 0.6 }}>ESC</span><span>Pause</span>
          </div>
        </div>
        
        <button onClick={onClose} style={{
          width: '100%', padding: 12, background: '#3a3a55', color: '#fff',
          border: 'none', cursor: 'pointer', fontSize: 14,
        }}>
          CLOSE
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/HelpModal.tsx
git commit -m "feat: add Help modal component"
```

---

### Task 8: Rewrite MainMenu with Vertical Layout

**Files:**
- Modify: `src/ui/MainMenu.tsx`

**Interfaces:**
- Consumes: None
- Produces: `MainMenu` component with vertical layout and new props

- [ ] **Step 1: Rewrite MainMenu.tsx**

```tsx
import React from 'react'

interface MainMenuProps {
  onSingleplayer: () => void
  onMultiplayer: () => void
  onSettings: () => void
  onAbout: () => void
  onHelp: () => void
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onSingleplayer, onMultiplayer, onSettings, onAbout, onHelp,
}) => {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(180deg, #0a0a1a 0%, #1a1a3e 100%)',
      color: 'white',
      fontFamily: 'monospace',
    }}>
      <h1 style={{
        fontSize: 64,
        fontWeight: 'bold',
        textShadow: '0 0 30px #ff6600, 0 0 60px #ff3300',
        marginBottom: 10,
        color: '#ff6600',
      }}>
        BROWSER SHOOTER
      </h1>
      <p style={{ fontSize: 18, opacity: 0.6, marginBottom: 40 }}>
        3D FPS Arena Wave Survival
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 280 }}>
        <button onClick={onSingleplayer} style={{
          padding: '16px 40px', fontSize: 22, fontWeight: 'bold', background: '#ff6600',
          color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
        }}>SINGLEPLAYER</button>
        <button onClick={onMultiplayer} style={{
          padding: '16px 40px', fontSize: 22, fontWeight: 'bold', background: '#3399ff',
          color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
        }}>MULTIPLAYER</button>
        <button onClick={onSettings} style={{
          padding: '16px 40px', fontSize: 22, fontWeight: 'bold', background: '#444',
          color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
        }}>SETTINGS</button>
        <button onClick={onAbout} style={{
          padding: '16px 40px', fontSize: 22, fontWeight: 'bold', background: '#333',
          color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
        }}>ABOUT</button>
        <button onClick={onHelp} style={{
          padding: '16px 40px', fontSize: 22, fontWeight: 'bold', background: '#333',
          color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer',
        }}>HELP</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/MainMenu.tsx
git commit -m "feat: rewrite main menu with vertical layout and About/Help"
```

---

### Task 9: Fix Cursor Disappearing Issue

**Files:**
- Modify: `src/player/Controls.ts:1-111`
- Modify: `src/App.tsx:336`

**Interfaces:**
- Consumes: `GameState` type
- Produces: Controls class with gameState parameter

- [ ] **Step 1: Update Controls.ts constructor**

```typescript
import type { GameState } from '../types'

export class Controls {
  forward = false
  backward = false
  left = false
  right = false
  jump = false
  shoot = false
  private element: HTMLElement
  private getGameState: () => GameState
  private boundKeyDown: (e: KeyboardEvent) => void
  private boundKeyUp: (e: KeyboardEvent) => void
  private boundMouseDown: (e: MouseEvent) => void
  private boundMouseUp: (e: MouseEvent) => void

  onMouseMove: ((e: MouseEvent) => void) | null = null
  onCycleWeapon: (() => void) | null = null
  onToggleStore: (() => void) | null = null
  onScoreboard: ((show: boolean) => void) | null = null
  private scoreboardHeld = false

  constructor(element: HTMLElement, getGameState: () => GameState) {
    this.element = element
    this.getGameState = getGameState

    this.boundKeyDown = (e: KeyboardEvent) => this.onKeyDown(e)
    this.boundKeyUp = (e: KeyboardEvent) => this.onKeyUp(e)
    this.boundMouseDown = (e: MouseEvent) => this.onMouseDown(e)
    this.boundMouseUp = (e: MouseEvent) => this.onMouseUp(e)

    this.bindEvents()
  }
```

- [ ] **Step 2: Update onMouseDown method**

```typescript
private onMouseDown(e: MouseEvent) {
  if (e.button === 0) {
    this.shoot = true
    if (this.getGameState() === 'playing' && document.pointerLockElement !== this.element) {
      this.element.requestPointerLock()
    }
  }
}
```

- [ ] **Step 3: Update App.tsx Controls initialization**

Find line 336 and update:

```typescript
data.controls = new Controls(container, () => gameStateRef.current)
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/player/Controls.ts src/App.tsx
git commit -m "fix: prevent pointer lock on menu screens"
```

---

### Task 10: Update App.tsx for New Menu States

**Files:**
- Modify: `src/App.tsx:731-739`

**Interfaces:**
- Consumes: `AboutModal`, `HelpModal`, `MainMenu` with new props
- Produces: Updated App component with modal states

- [ ] **Step 1: Add imports**

```typescript
import { AboutModal } from './ui/AboutModal'
import { HelpModal } from './ui/HelpModal'
```

- [ ] **Step 2: Add state variables**

Find line 49 and add:

```typescript
const [showAbout, setShowAbout] = useState(false)
const [showHelp, setShowHelp] = useState(false)
```

- [ ] **Step 3: Update MainMenu rendering**

```typescript
{gameState === 'menu' && (
  <>
    <MainMenu
      onSingleplayer={() => updateGameState('teamselect')}
      onMultiplayer={() => updateGameState('mpmenu')}
      onSettings={() => updateGameState('settings')}
      onAbout={() => setShowAbout(true)}
      onHelp={() => setShowHelp(true)}
    />
    {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
  </>
)}
```

- [ ] **Step 4: Run build to verify**

```bash
npm run build
```

Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: integrate About and Help modals into App"
```

---

### Task 11: Final Verification

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: All previous tasks
- Produces: Verified working application

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: All tests pass

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: No errors

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: Build succeeds

- [ ] **Step 4: Verify sound files in dist**

```bash
ls dist/sounds/
```

Expected: Sound files present

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: verify all UI improvements working"
```
