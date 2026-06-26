import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { RemotePlayer } from '../RemotePlayer'
import { RemotePlayerManager } from '../RemotePlayerManager'

// The global test-setup.ts already stubs HTMLCanvasElement.prototype.getContext
// so buildTalkingSprite() (and the name-tag code) can run without WebGL.

describe('RemotePlayer.setTalking', () => {
  it('starts not talking', () => {
    const rp = new RemotePlayer('id1', 'Alice')
    expect(rp.isTalking()).toBe(false)
  })

  it('toggles talkingSprite visibility', () => {
    const rp = new RemotePlayer('id1', 'Alice')
    expect(rp.isTalking()).toBe(false)
    rp.setTalking(true)
    expect(rp.isTalking()).toBe(true)
    rp.setTalking(false)
    expect(rp.isTalking()).toBe(false)
  })
})

describe('RemotePlayerManager.setTalking', () => {
  it('forwards to the RemotePlayer if it exists', () => {
    const scene = new THREE.Scene()
    const mgr = new RemotePlayerManager(scene, 'local')
    const rp = new RemotePlayer('p1', 'Bob')
    scene.add(rp.group)
    // Access private map via any cast to inject the player
    ;(mgr as unknown as { players: Map<string, RemotePlayer> }).players.set('p1', rp)
    mgr.setTalking('p1', true)
    expect(rp.isTalking()).toBe(true)
  })

  it('silently ignores unknown player ids', () => {
    const scene = new THREE.Scene()
    const mgr = new RemotePlayerManager(scene, 'local')
    expect(() => mgr.setTalking('nonexistent', true)).not.toThrow()
  })
})
