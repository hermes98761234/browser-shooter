import { describe, it, expect } from 'vitest'
import { GameSession } from './GameSession'
import { defaultCompetitiveConfig } from './MatchConfig'
import { getMap } from '../maps/registry'

// Regression guard for the multiplayer "wrong map" bug: a session must derive its
// map-dependent state (map, spawns, bombsites) from its own config. The client fix in
// App.tsx relies on rebuilding the session from the host's config so these line up.
describe('GameSession map selection', () => {
  it('uses the map from its config, not the default', () => {
    const session = new GameSession({ ...defaultCompetitiveConfig(), mapId: 'mirage' })
    expect(session.map.id).toBe('mirage')
  })

  it('derives competitive bombsites from the configured map', () => {
    const mirage = getMap('mirage')
    const session = new GameSession({ ...defaultCompetitiveConfig(), mapId: 'mirage' })
    const centers = session.bombsites
      .map((s) => `${s.id}:${s.center.x},${s.center.z}`)
      .sort()
    const expected = mirage.bombsites
      .map((b) => `${b.id}:${b.center[0]},${b.center[1]}`)
      .sort()
    expect(centers).toEqual(expected)
  })
})
