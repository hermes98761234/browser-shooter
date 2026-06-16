import { describe, it, expect } from 'vitest'
import { applyItem } from '../applyPurchase'
import { Player } from '../Player'
import { WeaponManager } from '../../weapons/WeaponManager'
import { findItem } from '../../weapons/StoreCatalog'

function ctx() {
  return { player: new Player(), wm: new WeaponManager() }
}

describe('applyItem', () => {
  it('equips a primary weapon into its slot', () => {
    const { player, wm } = ctx()
    applyItem(findItem('ak')!, player, wm)
    expect(wm.primary?.type).toBe('ak')
    expect(wm.current.type).toBe('ak')
  })

  it('equips a secondary weapon into its slot', () => {
    const { player, wm } = ctx()
    applyItem(findItem('deagle')!, player, wm)
    expect(wm.secondary.type).toBe('deagle')
  })

  it('armor gear raises armor', () => {
    const { player, wm } = ctx()
    applyItem(findItem('kevlar')!, player, wm)
    expect(player.armor).toBe(50)
  })

  it('medkit raises max health', () => {
    const { player, wm } = ctx()
    applyItem(findItem('medkit')!, player, wm)
    expect(player.maxHealth).toBe(125)
  })

  it('boots increase speed multiplier', () => {
    const { player, wm } = ctx()
    applyItem(findItem('boots')!, player, wm)
    expect(player.speedMult).toBeCloseTo(1.15)
  })

  it('upgrade applies to the currently equipped weapon', () => {
    const { player, wm } = ctx()
    applyItem(findItem('ak')!, player, wm) // ak maxAmmo 90, now current
    applyItem(findItem('ext_mag')!, player, wm)
    expect(wm.current.def.maxAmmo).toBe(135)
  })
})
