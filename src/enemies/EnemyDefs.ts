import type { EnemyDef } from '../types'

export const ENEMY_DEFS: Record<string, EnemyDef> = {
  grunt: {
    type: 'grunt', health: 50, damage: 10, speed: 4, attackRange: 2,
    scoreValue: 100, color: 0xb33939,
    attackType: 'melee', fireRange: 0, fireRate: 0, accuracy: 0, telegraphTime: 0, standoff: 0,
  },
  runner: {
    type: 'runner', health: 30, damage: 8, speed: 8, attackRange: 1.5,
    scoreValue: 150, color: 0xe67e22,
    attackType: 'melee', fireRange: 0, fireRate: 0, accuracy: 0, telegraphTime: 0, standoff: 0,
  },
  tank: {
    type: 'tank', health: 150, damage: 25, speed: 2, attackRange: 3,
    scoreValue: 300, color: 0x6d0000,
    attackType: 'melee', fireRange: 0, fireRate: 0, accuracy: 0, telegraphTime: 0, standoff: 0,
  },
  rifleman: {
    type: 'rifleman', health: 60, damage: 12, speed: 3.5, attackRange: 2,
    scoreValue: 200, color: 0x2d6cdf,
    attackType: 'ranged', fireRange: 25, fireRate: 1.2, accuracy: 0.6, telegraphTime: 0.5, standoff: 8,
  },
  sniper: {
    type: 'sniper', health: 40, damage: 30, speed: 2.5, attackRange: 2,
    scoreValue: 350, color: 0x16607a,
    attackType: 'ranged', fireRange: 45, fireRate: 2.5, accuracy: 0.8, telegraphTime: 1.0, standoff: 18,
  },
}
