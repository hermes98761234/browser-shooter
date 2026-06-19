/** Plays incoming teammate audio streams through hidden <audio> elements,
 *  one per peer. Flat (non-positional) by design. */
export class AudioSink {
  private els = new Map<string, HTMLAudioElement>()

  play(peerId: string, stream: MediaStream): void {
    let el = this.els.get(peerId)
    if (!el) {
      el = document.createElement('audio')
      el.autoplay = true
      el.style.display = 'none'
      document.body.appendChild(el)
      this.els.set(peerId, el)
    } else {
      const old = el.srcObject as MediaStream | null
      old?.getTracks().forEach(t => t.stop())
    }
    el.srcObject = stream
    void el.play().catch(() => {})
  }

  stop(peerId: string): void {
    const el = this.els.get(peerId)
    if (!el) return
    el.srcObject = null
    el.remove()
    this.els.delete(peerId)
  }

  dispose(): void {
    for (const id of [...this.els.keys()]) this.stop(id)
  }
}
