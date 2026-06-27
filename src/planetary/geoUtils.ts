const METERS_PER_DEG_LAT = 111320

export function offsetLngLat(
  refLng: number,
  refLat: number,
  eastMeters: number,
  northMeters: number,
): [number, number] {
  const metersPerDegLon = METERS_PER_DEG_LAT * Math.cos((refLat * Math.PI) / 180)
  return [refLng + eastMeters / metersPerDegLon, refLat + northMeters / METERS_PER_DEG_LAT]
}

export function lngLatDistance(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const midLat = ((lat1 + lat2) / 2) * (Math.PI / 180)
  const dx = (lng2 - lng1) * METERS_PER_DEG_LAT * Math.cos(midLat)
  const dy = (lat2 - lat1) * METERS_PER_DEG_LAT
  return Math.sqrt(dx * dx + dy * dy)
}

export function medianLngLat(points: [number, number][]): [number, number] {
  const n = points.length
  if (n === 0) return [0, 0]
  const lngs = points.map(p => p[0]).sort((a, b) => a - b)
  const lats = points.map(p => p[1]).sort((a, b) => a - b)
  const mid = Math.floor(n / 2)
  return [
    n % 2 === 0 ? (lngs[mid - 1] + lngs[mid]) / 2 : lngs[mid],
    n % 2 === 0 ? (lats[mid - 1] + lats[mid]) / 2 : lats[mid],
  ]
}
