import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { LagCompensation } from '../LagCompensation'
import { Enemy } from '../../enemies/Enemy'

function makeEnemy(id: string, x: number): Enemy {
  const e = new Enemy('grunt', new THREE.Vector3(x, 0, 0))
  e.id = id
  return e
}

describe('LagCompensation', () => {
  it('records enemy positions per tick', () => {
    const lc = new LagCompensation()
    const e1 = makeEnemy('e1', 0)
    e1.mesh.position.set(5, 0, 0)
    lc.record(1, [e1])
    e1.mesh.position.set(10, 0, 0)
    lc.record(2, [e1])

    const rewound = lc.rewind(0) // very early — should return earliest
    expect(rewound).not.toBeNull()
    expect(rewound!.get('e1')!.x).toBe(5)
  })

  it('returns null if renderTime is older than history', () => {
    const lc = new LagCompensation()
    const e1 = makeEnemy('e1', 0)
    e1.mesh.position.set(5, 0, 0)
    lc.record(Date.now(), [e1])

    const rewound = lc.rewind(Date.now() - 2000) // 2s old, maxAge is 1s
    expect(rewound).toBeNull()
  })

  it('returns closest position for renderTime within history', () => {
    const lc = new LagCompensation()
    const e1 = makeEnemy('e1', 0)
    e1.mesh.position.set(0, 0, 0)
    lc.record(1000, [e1])
    e1.mesh.position.set(10, 0, 0)
    lc.record(1050, [e1])
    e1.mesh.position.set(20, 0, 0)
    lc.record(1100, [e1])

    const rewound = lc.rewind(1030) // between 1000 and 1050, should get 1000
    expect(rewound).not.toBeNull()
    expect(rewound!.get('e1')!.x).toBe(0)
  })

  it('trims history older than maxAge', () => {
    const lc = new LagCompensation()
    const e1 = makeEnemy('e1', 0)
    e1.mesh.position.set(0, 0, 0)
    lc.record(Date.now() - 1500, [e1]) // too old
    e1.mesh.position.set(10, 0, 0)
    lc.record(Date.now(), [e1])

    const rewound = lc.rewind(Date.now() - 500)
    expect(rewound).not.toBeNull()
    expect(rewound!.get('e1')!.x).toBe(10)
  })
})
