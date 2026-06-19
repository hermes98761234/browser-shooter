/** Of a teammate pair, the peer with the smaller id places the call;
 *  the other answers. Guarantees exactly one call per pair. */
export function shouldInitiate(myPeerId: string, otherPeerId: string): boolean {
  return myPeerId < otherPeerId
}

export interface MeshDiff {
  toOpen: string[]   // peer ids we should call now
  toClose: string[]  // peer ids we should hang up on
}

/** Given who we're connected to and who our teammates are, decide which calls
 *  to open (only those we initiate and haven't opened) and which to close. */
export function reconcileMesh(myPeerId: string, connected: string[], teammates: string[]): MeshDiff {
  const teammateSet = new Set(teammates)
  const connectedSet = new Set(connected)
  const toOpen = teammates.filter(p => shouldInitiate(myPeerId, p) && !connectedSet.has(p))
  const toClose = connected.filter(p => !teammateSet.has(p))
  return { toOpen, toClose }
}
