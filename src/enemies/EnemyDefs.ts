import type { EnemyDef } from '../types'

export const ENEMY_DEFS: Record<string, EnemyDef> = {
  grunt: {
    type: 'grunt',
    health: 50,
    damage: 10,
    speed: 4,
    attackRange: 2,
    scoreValue: 100,
    color: 0xff0000,
  },
  runner: {
    type: 'runner',
    health: 30,
    damage: 8,
    speed: 8,
    attackRange: 1.5,
    scoreValue: 150,
    color: 0xff6600,
  },
  tank: {
    type: 'tank',
    health: 150,
    damage: 25,
    speed: 2,
    attackRange: 3,
    scoreValue: 300,
    color: 0x990000,
  },
}
