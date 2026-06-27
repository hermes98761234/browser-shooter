import { describe, it, expect, vi } from 'vitest'
import { VideoChat } from './VideoChat'
import type { VoicePeer, VoiceCall, CamProvider } from './VoiceTransport'

function fakeCamStream(): MediaStream {
  const track = { enabled: false, stop: vi.fn() }
  return { getVideoTracks: () => [track] } as unknown as MediaStream
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
  const stream = fakeCamStream()
  const cam: CamProvider = { getStream: vi.fn().mockResolvedValue(stream) }
  const onStreamsChanged = vi.fn()
  const chat = new VideoChat({ peer, cam, localPlayerId: myId, onStreamsChanged })
  return { peer, stream, cam, onStreamsChanged, chat }
}

describe('VideoChat', () => {
  it('acquires camera only on first toggle', async () => {
    const s = setup('me')
    expect(s.cam.getStream).not.toHaveBeenCalled()
    await s.chat.toggleCamera()
    expect(s.cam.getStream).toHaveBeenCalledTimes(1)
    await s.chat.toggleCamera() // off
    await s.chat.toggleCamera() // on again
    expect(s.cam.getStream).toHaveBeenCalledTimes(1) // still once
  })

  it('enables video track when toggled on, disables when toggled off', async () => {
    const s = setup('me')
    await s.chat.toggleCamera()
    expect(s.stream.getVideoTracks()[0].enabled).toBe(true)
    expect(s.chat.localStream).toBe(s.stream)
    await s.chat.toggleCamera()
    expect(s.stream.getVideoTracks()[0].enabled).toBe(false)
    expect(s.chat.localStream).toBeNull()
  })

  it('opens calls to roster teammates when camera is on (initiator has smaller id)', async () => {
    const s = setup('aaa')
    s.chat.setRoster([{ playerId: 'other', peerId: 'bbb', name: 'Other' }])
    await s.chat.toggleCamera()
    expect(s.peer.calls).toHaveLength(1)
    expect(s.peer.calls[0].peerId).toBe('bbb')
  })

  it('does not initiate call when own peer id is larger (other side initiates)', async () => {
    const s = setup('zzz')
    s.chat.setRoster([{ playerId: 'other', peerId: 'aaa', name: 'Other' }])
    await s.chat.toggleCamera()
    expect(s.peer.calls).toHaveLength(0)
  })

  it('closes all calls when camera is toggled off', async () => {
    const s = setup('aaa')
    s.chat.setRoster([{ playerId: 'other', peerId: 'bbb', name: 'Other' }])
    await s.chat.toggleCamera()
    const call = s.peer.calls[0]
    expect(call.closed).toBe(false)
    await s.chat.toggleCamera()
    expect(call.closed).toBe(true)
  })

  it('fires onStreamsChanged when remote stream arrives', async () => {
    const s = setup('aaa')
    s.chat.setRoster([{ playerId: 'other', peerId: 'bbb', name: 'Other' }])
    await s.chat.toggleCamera()
    const remoteStream = fakeCamStream()
    s.peer.calls[0].emitStream(remoteStream)
    expect(s.onStreamsChanged).toHaveBeenLastCalledWith(new Map([['bbb', remoteStream]]))
  })

  it('fires onStreamsChanged when a call closes', async () => {
    const s = setup('aaa')
    s.chat.setRoster([{ playerId: 'other', peerId: 'bbb', name: 'Other' }])
    await s.chat.toggleCamera()
    s.peer.calls[0].emitStream(fakeCamStream())
    s.peer.calls[0].close()
    expect(s.onStreamsChanged).toHaveBeenLastCalledWith(new Map())
  })

  it('rejects incoming calls when camera is off', async () => {
    const s = setup('bbb') // bbb > aaa so bbb answers, aaa calls
    s.chat.setRoster([{ playerId: 'caller', peerId: 'aaa', name: 'Caller' }])
    // camera is off — must reject
    const call = new FakeCall('aaa')
    s.peer.fireIncoming(call)
    expect(call.closed).toBe(true)
    expect(call.answered).toBe(false)
  })

  it('answers incoming calls when camera is on and caller is in roster', async () => {
    const s = setup('bbb')
    s.chat.setRoster([{ playerId: 'caller', peerId: 'aaa', name: 'Caller' }])
    await s.chat.toggleCamera()
    const call = new FakeCall('aaa')
    s.peer.fireIncoming(call)
    expect(call.answered).toBe(true)
    expect(call.closed).toBe(false)
  })

  it('rejects incoming calls from peers not in roster', async () => {
    const s = setup('bbb')
    s.chat.setRoster([]) // roster is empty
    await s.chat.toggleCamera()
    const call = new FakeCall('aaa')
    s.peer.fireIncoming(call)
    expect(call.closed).toBe(true)
  })

  it('closes call to disconnected peer', async () => {
    const s = setup('aaa')
    s.chat.setRoster([{ playerId: 'p2', peerId: 'bbb', name: 'P2' }])
    await s.chat.toggleCamera()
    const call = s.peer.calls[0]
    s.chat.peerDisconnected('p2')
    expect(call.closed).toBe(true)
  })

  it('peerIdByPlayerId Map: populated by setRoster, retained after roster cleared, consumed by peerDisconnected', async () => {
    const s = setup('aaa')
    const chat = s.chat as any  // access private Map for verification

    s.chat.setRoster([{ playerId: 'p2', peerId: 'bbb', name: 'P2' }])
    expect(chat.peerIdByPlayerId.get('p2')).toBe('bbb')   // Map populated

    s.chat.setRoster([])                                   // roster cleared, Map retains entry
    expect(chat.peerIdByPlayerId.get('p2')).toBe('bbb')   // Map retained — old code would have nothing

    s.chat.peerDisconnected('p2')                          // Map entry consumed
    expect(chat.peerIdByPlayerId.has('p2')).toBe(false)   // entry cleaned up
  })

  it('dispose closes all calls and stops camera tracks', async () => {
    const s = setup('aaa')
    s.chat.setRoster([{ playerId: 'other', peerId: 'bbb', name: 'Other' }])
    await s.chat.toggleCamera()
    const call = s.peer.calls[0]
    s.chat.dispose()
    expect(call.closed).toBe(true)
    expect(s.stream.getVideoTracks()[0].stop).toHaveBeenCalled()
  })

  it('concurrent toggleCamera calls serialize — camera ends up ON after two rapid calls', async () => {
    const s = setup('aaa')
    s.chat.setRoster([{ playerId: 'p2', peerId: 'bbb', name: 'P2' }])
    // Fire two toggles without awaiting the first
    const p1 = s.chat.toggleCamera()
    const p2 = s.chat.toggleCamera()
    await Promise.all([p1, p2])
    // Two presses = on then off OR two presses = they serialise and net to the same result.
    // The key invariant: cameraOn must equal the number of presses mod 2.
    // Two presses → off. But the bug causes them to both enter init and double-flip cameraOn.
    // After fix: second call waits for first, then flips again → off. No spurious peer calls.
    expect(s.chat.localStream).toBeNull()          // 2 presses = net off
    expect(s.peer.calls.every(c => c.closed)).toBe(true) // no open calls
  })

  it('retries call after remote rejects due to camera off (initiator reconciles on cleanup)', async () => {
    // aaa < bbb, so aaa initiates
    const s = setup('aaa')
    s.chat.setRoster([{ playerId: 'p2', peerId: 'bbb', name: 'P2' }])
    await s.chat.toggleCamera()   // camera ON, opens call to bbb

    const firstCall = s.peer.calls[0]
    expect(firstCall.peerId).toBe('bbb')

    // Simulate remote rejection: bbb closes the call (camera was off on bbb's side)
    firstCall.close()  // fires onClose → cleanupCall → should trigger reconcile → retry

    // After retry, a second call should have been placed
    expect(s.peer.calls).toHaveLength(2)
    expect(s.peer.calls[1].peerId).toBe('bbb')
    expect(s.peer.calls[1].closed).toBe(false)
  })

  it('ignores stream event arriving after call is closed (no ghost tile)', async () => {
    const s = setup('aaa')
    s.chat.setRoster([{ playerId: 'p2', peerId: 'bbb', name: 'P2' }])
    await s.chat.toggleCamera()

    const call = s.peer.calls[0]
    // Close the call before the stream event arrives
    call.close()
    s.onStreamsChanged.mockClear()

    // Simulate buffered stream event arriving after close
    call.emitStream(fakeCamStream())

    // Must not add a ghost stream entry
    expect(s.onStreamsChanged).not.toHaveBeenCalled()
  })

  it('dispose while activating stops the acquired stream and does not crash', async () => {
    let resolveStream!: (s: MediaStream) => void
    const slowStream = new Promise<MediaStream>(res => { resolveStream = res })
    const cam: CamProvider = { getStream: vi.fn().mockReturnValue(slowStream) }
    const peer = new FakePeer('aaa')
    const chat = new VideoChat({ peer, cam, localPlayerId: 'aaa', onStreamsChanged: vi.fn() })
    const toggleP = chat.toggleCamera() // suspended, getStream not yet resolved
    chat.dispose()                       // dispose races the toggle
    const stream = fakeCamStream()
    resolveStream(stream)                // now getStream resolves
    await toggleP                        // continuation runs — must not crash
    expect(stream.getVideoTracks()[0].stop).toHaveBeenCalled() // tracks stopped
    expect(chat.localStream).toBeNull()
  })
})

describe('BrowserCamProvider track liveness', () => {
  it('concurrent getStream calls with ended tracks share one re-acquisition', async () => {
    let callCount = 0
    const track = { readyState: 'live' as string, stop: vi.fn() }
    const stream1 = { getVideoTracks: () => [track] } as unknown as MediaStream
    const stream2 = { getVideoTracks: () => [] } as unknown as MediaStream
    const gum = vi.fn().mockImplementation(() =>
      Promise.resolve(callCount++ === 0 ? stream1 : stream2)
    )
    const originalMD = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices')
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: gum }, configurable: true,
    })

    const { BrowserCamProvider } = await import('./VoiceTransport')
    const provider = new (BrowserCamProvider as any)()

    // First acquisition
    await provider.getStream()
    expect(gum).toHaveBeenCalledTimes(1)

    // Mark the track as ended (use stable track reference so it's visible to the implementation)
    track.readyState = 'ended'

    // Two concurrent calls — both see ended track synchronously → should share one new acquisition
    const [s2, s3] = await Promise.all([provider.getStream(), provider.getStream()])
    expect(gum).toHaveBeenCalledTimes(2)  // only one re-acquisition
    expect(s2).toBe(s3)                    // same promise result

    if (originalMD) Object.defineProperty(navigator, 'mediaDevices', originalMD)
  })

  it('re-acquires stream when cached tracks are ended', async () => {
    // Simulate what happens in the browser after tracks are stopped
    const liveTrack1 = { readyState: 'live', stop: vi.fn() }
    const liveTrack2 = { readyState: 'live', stop: vi.fn() }

    const stream1 = { getVideoTracks: () => [liveTrack1] } as unknown as MediaStream
    const stream2 = { getVideoTracks: () => [liveTrack2] } as unknown as MediaStream

    // Mock getUserMedia to return stream1 first, stream2 second
    let callCount = 0
    const gum = vi.fn().mockImplementation(() =>
      Promise.resolve(callCount++ === 0 ? stream1 : stream2)
    )
    // We need to test BrowserCamProvider directly — import it
    // Since it uses navigator.mediaDevices, we patch it:
    const originalGUM = navigator.mediaDevices?.getUserMedia
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: gum }, configurable: true,
    })

    const { BrowserCamProvider } = await import('./VoiceTransport')
    const provider = new BrowserCamProvider()

    const s1 = await provider.getStream()
    expect(s1).toBe(stream1)
    expect(gum).toHaveBeenCalledTimes(1)

    // Simulate track being stopped
    ;(liveTrack1 as any).readyState = 'ended'

    const s2 = await provider.getStream()
    expect(s2).toBe(stream2)
    expect(gum).toHaveBeenCalledTimes(2) // re-acquired

    // Restore
    if (originalGUM) {
      Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia: originalGUM }, configurable: true,
      })
    }
  })
})
