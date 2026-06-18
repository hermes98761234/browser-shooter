import { describe, it, expect } from 'vitest'
import { BombCarrier, BombState } from '../BombCarrier'

describe('BombCarrier', () => {
  it('starts with no bomb', () => {
    const bomb = new BombCarrier()
    expect(bomb.state).toBe(BombState.None)
  })

  it('assigns bomb to carrier', () => {
    const bomb = new BombCarrier()
    bomb.assign('player-1')
    expect(bomb.state).toBe(BombState.Carried)
    expect(bomb.carrier).toBe('player-1')
  })

  it('reset() clears all bomb state back to None', () => {
    const bomb = new BombCarrier()
    bomb.assign('player-1')
    bomb.startPlant('A')
    bomb.reset()
    expect(bomb.state).toBe(BombState.None)
    expect(bomb.carrier).toBeNull()
    expect(bomb.position).toBeNull()
    expect(bomb.site).toBeNull()
    expect(bomb.plantProgress).toBe(0)
    expect(bomb.defuseProgress).toBe(0)
  })

  it('exposes the current defuseDuration', () => {
    const bomb = new BombCarrier()
    bomb.assign('player-1')
    bomb.startPlant('A')
    bomb.update(3) // -> planted
    bomb.startDefuse(false)
    expect(bomb.defuseDuration).toBe(10)
    bomb.cancelDefuse()
    bomb.startDefuse(true)
    expect(bomb.defuseDuration).toBe(5)
  })

  it('drops bomb', () => {
    const bomb = new BombCarrier()
    bomb.assign('player-1')
    bomb.drop({ x: 5, y: 0, z: -15 })
    expect(bomb.state).toBe(BombState.Dropped)
    expect(bomb.position).toEqual({ x: 5, y: 0, z: -15 })
    expect(bomb.carrier).toBeNull()
  })

  it('picks up dropped bomb', () => {
    const bomb = new BombCarrier()
    bomb.assign('player-1')
    bomb.drop({ x: 5, y: 0, z: -15 })
    bomb.pickup('player-2')
    expect(bomb.state).toBe(BombState.Carried)
    expect(bomb.carrier).toBe('player-2')
  })

  it('plants bomb', () => {
    const bomb = new BombCarrier()
    bomb.assign('player-1')
    bomb.startPlant('A')
    expect(bomb.state).toBe(BombState.Planting)
    expect(bomb.plantProgress).toBe(0)
  })

  it('completes plant after 3 seconds', () => {
    const bomb = new BombCarrier()
    bomb.assign('player-1')
    bomb.startPlant('A')
    bomb.update(1)
    bomb.update(1)
    bomb.update(1)
    expect(bomb.state).toBe(BombState.Planted)
    expect(bomb.site).toBe('A')
  })

  it('cancels plant on move', () => {
    const bomb = new BombCarrier()
    bomb.assign('player-1')
    bomb.startPlant('A')
    bomb.cancelPlant()
    expect(bomb.state).toBe(BombState.Carried)
    expect(bomb.plantProgress).toBe(0)
  })

  it('defuses bomb', () => {
    const bomb = new BombCarrier()
    bomb.assign('player-1')
    bomb.startPlant('A')
    bomb.update(3) // complete plant
    bomb.startDefuse()
    expect(bomb.state).toBe(BombState.Defusing)
  })

  it('completes defuse after 5 seconds with kit', () => {
    const bomb = new BombCarrier()
    bomb.assign('player-1')
    bomb.startPlant('A')
    bomb.update(3)
    bomb.startDefuse()
    bomb.update(5)
    expect(bomb.state).toBe(BombState.Defused)
  })

  it('completes defuse after 10 seconds without kit', () => {
    const bomb = new BombCarrier()
    bomb.assign('player-1')
    bomb.startPlant('A')
    bomb.update(3)
    bomb.startDefuse(false)
    bomb.update(10)
    expect(bomb.state).toBe(BombState.Defused)
  })

  it('explodes after 40 seconds', () => {
    const bomb = new BombCarrier()
    bomb.assign('player-1')
    bomb.startPlant('A')
    bomb.update(3)
    bomb.update(40)
    expect(bomb.state).toBe(BombState.Exploded)
  })
})
