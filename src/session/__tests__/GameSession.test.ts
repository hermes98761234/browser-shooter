import { describe, it, expect } from 'vitest'
import { GameSession } from '../GameSession'
import { emptyInput } from '../protocol'
import { defaultCompetitiveConfig } from '../MatchConfig'
import { RoundState } from '../RoundManager'
import { BombState } from '../BombCarrier'

describe('GameSession skeleton', () => {
  it('starts with one local player and no enemies', () => {
    const s = new GameSession()
    const snap = s.getSnapshot()
    expect(snap.players).toHaveLength(1)
    expect(snap.players[0].id).toBe('local')
    expect(snap.enemies).toHaveLength(0)
    expect(snap.players[0].health).toBe(100)
  })

  it('stores the latest input for a player', () => {
    const s = new GameSession()
    const input = { ...emptyInput(), forward: true, yaw: 1.2 }
    s.applyInput('local', input)
    expect(s.getInput('local').forward).toBe(true)
    expect(s.getInput('local').yaw).toBe(1.2)
  })
})

describe('competitive mode', () => {
  it('creates with RoundManager when mode is competitive', () => {
    const config = defaultCompetitiveConfig()
    const session = new GameSession(config)
    expect(session.roundManager).toBeDefined()
    expect(session.economy).toBeDefined()
    expect(session.roundManager!.state).toBe(RoundState.Buying)
  })

  it('does not create RoundManager when mode is not competitive', () => {
    const session = new GameSession()
    expect(session.roundManager).toBeNull()
    expect(session.economy).toBeNull()
  })

  it('resets weapons on death in competitive mode', () => {
    const config = defaultCompetitiveConfig()
    const session = new GameSession(config)
    session.weaponManager.equip('ak', 'primary')
    expect(session.weaponManager.current.type).toBe('ak')
    session.handleDeath('local')
    expect(session.weaponManager.current.type).toBe('pistol')
  })

  it('does not reset weapons on death in non-competitive mode', () => {
    const session = new GameSession()
    session.weaponManager.equip('ak', 'primary')
    expect(session.weaponManager.current.type).toBe('ak')
    session.handleDeath('local')
    expect(session.weaponManager.current.type).toBe('ak')
  })

  it('round advances after buy phase', () => {
    const config = defaultCompetitiveConfig()
    const session = new GameSession(config)
    session.step(16) // buy phase -> active
    expect(session.roundManager!.buyPhase).toBe(false)
  })
})

describe('bomb mechanics', () => {
  it('creates bombsites in competitive mode', () => {
    const config = defaultCompetitiveConfig()
    const session = new GameSession(config)
    expect(session.bombsites).toHaveLength(2)
    expect(session.bombsites[0].id).toBe('A')
    expect(session.bombsites[1].id).toBe('B')
  })

  it('creates bomb carrier in competitive mode', () => {
    const config = defaultCompetitiveConfig()
    const session = new GameSession(config)
    expect(session.bomb).toBeDefined()
    expect(session.bomb.state).toBe(BombState.None)
  })

  it('does not create bombsites in non-competitive mode', () => {
    const session = new GameSession()
    expect(session.bombsites).toHaveLength(0)
  })

  it('assigns bomb at round start', () => {
    const config = defaultCompetitiveConfig()
    const session = new GameSession(config)
    session.addPlayer('t1', 'TPlayer', 't')
    session.assignBomb()
    expect(session.bomb.state).toBe(BombState.Carried)
  })

  it('updates bomb state during step when planting', () => {
    const config = defaultCompetitiveConfig()
    const session = new GameSession(config)
    const t = session.addPlayer('t1', 'TPlayer', 't')
    session.assignBomb()
    t.player.position.set(0, 2, -25) // stay inside site A so the plant progresses
    session.bomb.startPlant('A')
    session.step(1)
    expect(session.bomb.state).toBe(BombState.Planting)
    expect(session.bomb.plantProgress).toBe(1)
  })

  it('emits bombPlanted when plant completes', () => {
    const config = defaultCompetitiveConfig()
    const session = new GameSession(config)
    const t = session.addPlayer('t1', 'TPlayer', 't')
    session.assignBomb()
    t.player.position.set(0, 2, -25)
    session.bomb.startPlant('A')
    const events = session.step(3)
    expect(session.bomb.state).toBe(BombState.Planted)
    expect(events.some(e => e.type === 'bombPlanted')).toBe(true)
  })

  it('emits bombExploded when timer runs out', () => {
    const config = defaultCompetitiveConfig()
    const session = new GameSession(config)
    const t = session.addPlayer('t1', 'TPlayer', 't')
    session.assignBomb()
    t.player.position.set(0, 2, -25)
    session.bomb.startPlant('A')
    session.step(3) // plant
    const events = session.step(40) // explode
    expect(session.bomb.state).toBe(BombState.Exploded)
    expect(events.some(e => e.type === 'bombExploded')).toBe(true)
  })

  it('emits bombDefused when defuse completes', () => {
    const config = defaultCompetitiveConfig()
    const session = new GameSession(config)
    const t = session.addPlayer('t1', 'TPlayer', 't')
    session.assignBomb()
    t.player.position.set(0, 2, -25)
    session.bomb.startPlant('A')
    session.step(3) // plant
    session.player.position.set(0, 2, -25) // local CT stands on the site to defuse
    session.tryDefuse('local', true)
    const events = session.step(5) // defuse
    expect(session.bomb.state).toBe(BombState.Defused)
    expect(events.some(e => e.type === 'bombDefused')).toBe(true)
  })
})

describe('bomb interaction', () => {
  function comp(): GameSession {
    return new GameSession(defaultCompetitiveConfig())
  }

  it('tryPlant starts a plant when the T carrier stands inside a bombsite', () => {
    const s = comp()
    const t = s.addPlayer('t1', 'T', 't')
    s.assignBomb() // t1 carries
    t.player.position.set(0, 2, -25) // inside site A
    expect(s.tryPlant('t1')).toBe(true)
    expect(s.bomb.state).toBe(BombState.Planting)
    expect(s.bomb.site).toBe('A')
  })

  it('tryPlant fails when the carrier is not inside a bombsite', () => {
    const s = comp()
    const t = s.addPlayer('t1', 'T', 't')
    s.assignBomb()
    t.player.position.set(0, 2, 0) // arena centre, no site
    expect(s.tryPlant('t1')).toBe(false)
    expect(s.bomb.state).toBe(BombState.Carried)
  })

  it('tryPlant fails when the requester is not the carrier', () => {
    const s = comp()
    s.addPlayer('t1', 'T', 't')
    const t2 = s.addPlayer('t2', 'T2', 't')
    s.assignBomb() // t1 carries
    t2.player.position.set(0, 2, -25)
    expect(s.tryPlant('t2')).toBe(false)
  })

  it('tryDefuse lets a CT near the planted bomb start defusing', () => {
    const s = comp()
    const t = s.addPlayer('t1', 'T', 't')
    s.assignBomb()
    t.player.position.set(0, 2, -25)
    s.tryPlant('t1')
    s.step(3) // complete plant
    expect(s.bomb.state).toBe(BombState.Planted)
    const ct = s.getPlayer('local')!
    ct.player.position.set(0, 2, -25)
    expect(s.tryDefuse('local', true)).toBe(true)
    expect(s.bomb.state).toBe(BombState.Defusing)
  })

  it('tryDefuse fails for a T player', () => {
    const s = comp()
    const t = s.addPlayer('t1', 'T', 't')
    s.assignBomb()
    t.player.position.set(0, 2, -25)
    s.tryPlant('t1')
    s.step(3)
    t.player.position.set(0, 2, -25)
    expect(s.tryDefuse('t1', true)).toBe(false)
  })

  it('auto-picks up a dropped bomb when a T player walks over it', () => {
    const s = comp()
    const t = s.addPlayer('t1', 'T', 't')
    s.assignBomb()
    s.bomb.drop({ x: 0, y: 0, z: 5 })
    t.player.position.set(0, 2, 5)
    s.step(0.1)
    expect(s.bomb.state).toBe(BombState.Carried)
    expect(s.bomb.carrier).toBe('t1')
  })

  it('auto-assigns the bomb to a T player when the round goes active', () => {
    const s = comp()
    s.addPlayer('t1', 'T', 't')
    expect(s.bomb.state).toBe(BombState.None)
    s.step(16) // buy phase (15s) -> active
    expect(s.roundManager!.buyPhase).toBe(false)
    expect(s.bomb.state).toBe(BombState.Carried)
    expect(s.bomb.carrier).toBe('t1')
  })
})

describe('round resolution', () => {
  function comp(): GameSession {
    return new GameSession(defaultCompetitiveConfig())
  }

  it('concludes a defused round exactly once and resets the bomb', () => {
    const s = comp()
    s.roundManager!.state = RoundState.Active
    s.roundManager!.roundTimer = 100
    s.bomb.state = BombState.Planted
    s.bomb.site = 'A'
    s.bomb.timer = 40
    s.player.position.set(0, 2, -25) // local CT on the site to defuse
    s.bomb.startDefuse(true, 'local')
    s.step(5) // defuse completes this tick
    expect(s.bomb.state).toBe(BombState.Defused)
    s.step(1) // resolution: CT wins the round
    expect(s.roundManager!.ctScore).toBe(1)
    expect(s.bomb.state).toBe(BombState.None) // reset for next round
    s.step(1)
    s.step(1)
    expect(s.roundManager!.ctScore).toBe(1) // does NOT re-fire
  })

  it('does not end the round on the round timer once the bomb is planted', () => {
    const s = comp()
    s.roundManager!.state = RoundState.Active
    s.roundManager!.roundTimer = 5 // about to expire
    s.bomb.state = BombState.Planted
    s.bomb.site = 'A'
    s.bomb.timer = 40 // bomb fuse still has plenty of time
    s.step(6) // round timer would expire, but a planted bomb keeps the round live
    expect(s.roundManager!.state).toBe(RoundState.Active)
    expect(s.bomb.state).toBe(BombState.Planted)
    expect(s.roundManager!.tScore).toBe(0)
    expect(s.roundManager!.ctScore).toBe(0)
  })

  it('awards T when the planted bomb explodes after the round timer would have expired', () => {
    const s = comp()
    s.roundManager!.state = RoundState.Active
    s.roundManager!.roundTimer = 5 // round timer expires well before the fuse
    s.bomb.state = BombState.Planted
    s.bomb.site = 'A'
    s.bomb.timer = 40
    s.step(41) // bomb fuse elapses -> Exploded at end of step
    expect(s.bomb.state).toBe(BombState.Exploded)
    s.step(1) // next tick concludes the round
    expect(s.roundManager!.tScore).toBe(1)
    expect(s.bomb.state).toBe(BombState.None) // reset for next round
  })

  it('awards CT when the bomb is defused after the round timer would have expired', () => {
    const s = comp()
    s.roundManager!.state = RoundState.Active
    s.roundManager!.roundTimer = 2 // round timer would expire mid-defuse
    s.bomb.state = BombState.Planted
    s.bomb.site = 'A'
    s.bomb.timer = 40
    s.player.position.set(0, 2, -25) // local CT on the site to defuse
    s.bomb.startDefuse(true, 'local')
    s.step(5) // defuse completes this tick despite the round timer being "expired"
    expect(s.bomb.state).toBe(BombState.Defused)
    s.step(1) // next tick concludes the round
    expect(s.roundManager!.ctScore).toBe(1)
    expect(s.bomb.state).toBe(BombState.None)
  })

  it('resets economy money to 800 at halftime', () => {
    const s = comp()
    s.economy!.money = 5000
    s.roundManager!.round = 15
    s.roundManager!.state = RoundState.Active
    s.roundManager!.roundTimer = 0.01
    s.step(1) // round 15 ends -> halftime
    expect(s.roundManager!.isHalftime).toBe(true)
    expect(s.economy!.money).toBe(800)
  })

  it('revives dead players at the start of the next round', () => {
    const s = comp()
    const t = s.addPlayer('t1', 'T', 't')
    t.player.takeDamage(1000)
    expect(t.player.isDead).toBe(true)
    s.roundManager!.state = RoundState.Active
    s.roundManager!.roundTimer = 0.01
    s.step(1) // round ends -> next round
    expect(t.player.isDead).toBe(false)
  })
})

describe('plant/defuse interruption', () => {
  function comp(): GameSession {
    return new GameSession(defaultCompetitiveConfig())
  }

  /** Plant the bomb at site A so we have a Planted bomb to defuse. */
  function planted(s: GameSession) {
    const t = s.addPlayer('t1', 'T', 't')
    s.assignBomb()
    t.player.position.set(0, 2, -25) // inside site A
    s.tryPlant('t1')
    s.step(3) // complete plant
  }

  it('cancels an in-progress defuse when the defuser dies', () => {
    const s = comp()
    planted(s)
    const ct = s.getPlayer('local')!
    ct.player.position.set(0, 2, -25)
    expect(s.tryDefuse('local', true)).toBe(true)

    ct.player.takeDamage(1000) // defuser killed mid-defuse
    s.step(5) // would have completed a 5s defuse

    expect(ct.player.isDead).toBe(true)
    expect(s.bomb.state).toBe(BombState.Planted) // defuse cancelled, bomb NOT defused
  })

  it('cancels an in-progress defuse when the defuser leaves the bombsite', () => {
    const s = comp()
    planted(s)
    const ct = s.getPlayer('local')!
    ct.player.position.set(0, 2, -25)
    expect(s.tryDefuse('local', true)).toBe(true)

    ct.player.position.set(0, 2, 0) // walk off the site mid-defuse
    s.step(5)

    expect(s.bomb.state).toBe(BombState.Planted) // defuse cancelled
  })

  it('cancels an in-progress plant when the planter leaves the bombsite', () => {
    const s = comp()
    const t = s.addPlayer('t1', 'T', 't')
    s.assignBomb()
    t.player.position.set(0, 2, -25)
    expect(s.tryPlant('t1')).toBe(true)

    t.player.position.set(0, 2, 0) // leave the site before the plant completes
    s.step(0.5)

    expect(s.bomb.state).toBe(BombState.Carried) // plant cancelled, still carrying
  })
})
