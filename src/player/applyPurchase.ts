import type { StoreItem } from '../types'
import type { Player } from './Player'
import type { WeaponManager } from '../weapons/WeaponManager'

/** Apply a purchased item's effect to the player and weapon manager.
 *  Does NOT check affordability or deduct money — the caller owns the economy. */
export function applyItem(item: StoreItem, player: Player, wm: WeaponManager): void {
  switch (item.kind) {
    case 'weapon':
      if (item.weaponType && item.slot) wm.equip(item.weaponType, item.slot)
      break
    case 'armor':
      if (item.effects?.armor) player.addArmor(item.effects.armor)
      player.hasArmor = true
      if (item.effects?.helmet) player.hasHelmet = true
      break
    case 'health':
      if (item.effects?.maxHealth) player.addMaxHealth(item.effects.maxHealth)
      break
    case 'speed':
      if (item.effects?.speedMult) player.speedMult *= item.effects.speedMult
      break
    case 'upgrade':
      if (item.effects?.weapon) wm.current.applyUpgrade(item.effects.weapon)
      break
  }
}
