import type maplibregl from 'maplibre-gl'

const ROAD_LAYERS = ['road', 'roads', 'transportation']

interface NavNode {
  id: string
  lng: number
  lat: number
  neighbors: string[]
}

export class PlanetaryNavmesh {
  private nodes = new Map<string, NavNode>()

  get nodeCount(): number { return this.nodes.size }

  build(map: Pick<maplibregl.Map, 'queryRenderedFeatures'>) {
    this.nodes.clear()
    const features = map.queryRenderedFeatures(undefined, { layers: ROAD_LAYERS })

    for (const f of features) {
      if (f.geometry.type !== 'LineString') continue
      const coords = f.geometry.coordinates as [number, number][]
      let prevId: string | null = null
      for (const [lng, lat] of coords) {
        const id = `${lng.toFixed(5)},${lat.toFixed(5)}`
        if (!this.nodes.has(id)) this.nodes.set(id, { id, lng, lat, neighbors: [] })
        if (prevId && !this.nodes.get(prevId)!.neighbors.includes(id)) {
          this.nodes.get(prevId)!.neighbors.push(id)
          this.nodes.get(id)!.neighbors.push(prevId)
        }
        prevId = id
      }
    }
  }

  findPath(fromLng: number, fromLat: number, toLng: number, toLat: number): [number, number][] {
    if (this.nodes.size === 0) return []
    const startId = this.nearestId(fromLng, fromLat)
    const goalId = this.nearestId(toLng, toLat)
    if (!startId || !goalId || startId === goalId) return []

    const goal = this.nodes.get(goalId)!
    const dist = (a: NavNode, b: NavNode) => {
      const dx = (a.lng - b.lng) * 111320
      const dz = (a.lat - b.lat) * 111320
      return Math.sqrt(dx * dx + dz * dz)
    }

    const open = new Set([startId])
    const cameFrom = new Map<string, string>()
    const g = new Map<string, number>([[startId, 0]])
    const f = new Map<string, number>([[startId, dist(this.nodes.get(startId)!, goal)]])

    while (open.size > 0) {
      let cur = [...open].reduce((a, b) => (f.get(a) ?? Infinity) < (f.get(b) ?? Infinity) ? a : b)
      if (cur === goalId) return this.reconstruct(cameFrom, cur)
      open.delete(cur)
      const node = this.nodes.get(cur)!
      for (const nid of node.neighbors) {
        const neighbor = this.nodes.get(nid)
        if (!neighbor) continue
        const tentG = (g.get(cur) ?? Infinity) + dist(node, neighbor)
        if (tentG < (g.get(nid) ?? Infinity)) {
          cameFrom.set(nid, cur)
          g.set(nid, tentG)
          f.set(nid, tentG + dist(neighbor, goal))
          open.add(nid)
        }
      }
    }
    return []
  }

  private nearestId(lng: number, lat: number): string | null {
    let best: string | null = null
    let bestD = Infinity
    for (const [id, n] of this.nodes) {
      const dx = (n.lng - lng) * 111320
      const dy = (n.lat - lat) * 111320
      const d = dx * dx + dy * dy
      if (d < bestD) { bestD = d; best = id }
    }
    return best
  }

  private reconstruct(cameFrom: Map<string, string>, cur: string): [number, number][] {
    const path: [number, number][] = []
    let c: string | undefined = cur
    while (c) {
      const n = this.nodes.get(c)
      if (n) path.unshift([n.lng, n.lat])
      c = cameFrom.get(c)
    }
    return path
  }
}
