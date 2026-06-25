import type { ZoneDef } from './ZoneDef'

export interface SavedMap {
  id: string
  name: string
  createdAt: number
  zone: ZoneDef
}

const KEY = 'browser-shooter-maps'

export function loadMaps(): SavedMap[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as SavedMap[]) : []
  } catch {
    return []
  }
}

export function saveMap(map: SavedMap): boolean {
  try {
    const maps = loadMaps().filter((m) => m.id !== map.id)
    localStorage.setItem(KEY, JSON.stringify([...maps, map]))
    return true
  } catch {
    return false
  }
}

export function deleteMap(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadMaps().filter((m) => m.id !== id)))
  } catch { /* ignore */ }
}

export function findByName(name: string): SavedMap | undefined {
  return loadMaps().find((m) => m.name === name)
}

export function newMapId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}
