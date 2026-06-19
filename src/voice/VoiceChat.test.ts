import { describe, it, expect, vi } from 'vitest'
import { VoiceChat } from './VoiceChat'
import type { VoicePeer, VoiceCall, MicProvider } from './VoiceTransport'

function fakeStream(): MediaStream {
  const track = { enabled: false, stop: vi.fn() }
  return { getAudioTracks: () => [track] } as unknown as MediaStream
}

class FakeCall implements VoiceCall {
  answered = false
  closed = false
  private streamCb: ((s: MediaStream) => void) | null = null
  private closeCb: (() => void) | null = null
  constructor(public peerId: string) {}
  answer(): void { this.answered = true }
  onStream(cb: (s: MediaStream) => void): void { this.streamCb = cb }
  onClose(cb: () => void): void { this.closeCb = cb }
  close(): void { this.closed = true; this.closeCb?.() }
  emitStream(s: MediaStream): void { this.streamCb?.(s) }
}

class FakePeer implements VoicePeer {
  calls: FakeCall[] = []
  private incomingCbs = new Map<(call: VoiceCall) => void, (call: VoiceCall) => void>()
  constructor(public id: string) {}
  call(peerId: string): VoiceCall { const c = new FakeCall(peerId); this.calls.push(c); return c }
  onIncomingCall(cb: (call: VoiceCall) => void): void { this.incomingCbs.set(cb, cb) }
  offIncomingCall(cb: (call: VoiceCall) => void): void { this.incomingCbs.delete(cb) }
  fireIncoming(call: FakeCall): void { this.incomingCbs.forEach(cb => cb(call)) }
}

function setup(myId: string) {
  const peer = new FakePeer(myId)
  const stream = fakeStream()
  const mic: MicProvider = { getStream: vi.fn().mockResolvedValue(stream) }
  const sendStart = vi.fn()
  const sendStop = vi.fn()
  const onSpeakersChanged = vi.fn()
  const playStream = vi.fn()
  const stopStream = vi.fn()
  let t = 0
  const chat = new VoiceChat({
    peer, mic, localPlayerId: 'me', localName: 'Me',
    sendStart, sendStop, onSpeakersChanged, playStream, stopStream,
    now: () => t,
  })
  return { peer, stream, mic, sendStart, sendStop, onSpeakersChanged, playStream, stopStream, chat, setTime: (v: number) => { t = v } }
}

describe('VoiceChat', () => {
  it('acquires the mic only on first talk and shows the local speaker', async () => {
    const s = setup('me')
    expect(s.mic.getStream).not.toHaveBeenCalled()
    await s.chat.startTalking()
    expect(s.mic.getStream).toHaveBeenCalledTimes(1)
    expect(s.sendStart).toHaveBeenCalledWith('me', 'Me')
    expect(s.onSpeakersChanged).toHaveBeenLastCalledWith([{ playerId: 'me', name: 'Me' }])
    expect(s.stream.getAudioTracks()[0].enabled).toBe(true)
  })

  it('disables the mic track and clears the local speaker on stop', async () => {
    const s = setup('me')
    await s.chat.startTalking()
    s.chat.stopTalking()
    expect(s.stream.getAudioTracks()[0].enabled).toBe(false)
    expect(s.sendStop).toHaveBeenCalledWith('me')
    expect(s.onSpeakersChanged).toHaveBeenLastCalledWith([])
  })

  it('opens an initiator call to a teammate with a larger peer id once activated', async () => {
    const s = setup('aaa') // 'aaa' < 'zzz' so we initiate
    s.chat.setRoster([{ playerId: 'p2', peerId: 'zzz', name: 'Zoe' }])
    expect(s.peer.calls).toHaveLength(0) // not activated yet
    await s.chat.startTalking()
    expect(s.peer.calls.map(c => c.peerId)).toEqual(['zzz'])
  })

  it('does not initiate to a teammate with a smaller peer id (answers instead)', async () => {
    const s = setup('zzz') // 'zzz' > 'aaa' so the other initiates
    s.chat.setRoster([{ playerId: 'p2', peerId: 'aaa', name: 'Ann' }])
    await s.chat.startTalking()
    expect(s.peer.calls).toHaveLength(0)
  })

  it('answers an incoming call from a teammate and plays its stream', async () => {
    const s = setup('zzz')
    s.chat.setRoster([{ playerId: 'p2', peerId: 'aaa', name: 'Ann' }])
    await s.chat.startTalking()
    const incoming = new FakeCall('aaa')
    s.peer.fireIncoming(incoming)
    expect(incoming.answered).toBe(true)
    const remoteStream = fakeStream()
    incoming.emitStream(remoteStream)
    expect(s.playStream).toHaveBeenCalledWith('aaa', remoteStream)
  })

  it('rejects an incoming call from a non-teammate', async () => {
    const s = setup('zzz')
    s.chat.setRoster([])
    await s.chat.startTalking()
    const incoming = new FakeCall('stranger')
    s.peer.fireIncoming(incoming)
    expect(incoming.answered).toBe(false)
    expect(incoming.closed).toBe(true)
  })

  it('adds and removes remote speakers from talk events', () => {
    const s = setup('me')
    s.chat.remoteStart('p2', 'Bob')
    expect(s.onSpeakersChanged).toHaveBeenLastCalledWith([{ playerId: 'p2', name: 'Bob' }])
    s.chat.remoteStop('p2')
    expect(s.onSpeakersChanged).toHaveBeenLastCalledWith([])
  })

  it('closes the call and drops the speaker when a peer disconnects', async () => {
    const s = setup('aaa')
    s.chat.setRoster([{ playerId: 'p2', peerId: 'zzz', name: 'Zoe' }])
    await s.chat.startTalking()
    s.chat.remoteStart('p2', 'Zoe')
    s.chat.peerDisconnected('p2')
    expect(s.peer.calls[0].closed).toBe(true)
    expect(s.stopStream).toHaveBeenCalledWith('zzz')
    expect(s.stopStream).toHaveBeenCalledTimes(1)
    expect(s.onSpeakersChanged).toHaveBeenLastCalledWith([{ playerId: 'me', name: 'Me' }])
  })

  it('resends a talk heartbeat after the interval while holding', async () => {
    const s = setup('me')
    await s.chat.startTalking()
    s.sendStart.mockClear()
    s.setTime(500)
    s.chat.tick(500)
    expect(s.sendStart).not.toHaveBeenCalled()
    s.setTime(1100)
    s.chat.tick(1100)
    expect(s.sendStart).toHaveBeenCalledWith('me', 'Me')
  })

  it('prunes a stale remote speaker on tick', () => {
    const s = setup('me')
    s.chat.remoteStart('p2', 'Bob') // lastSeen = 0
    s.chat.tick(5000)               // ttl default 2500 → pruned
    expect(s.onSpeakersChanged).toHaveBeenLastCalledWith([])
  })
})
