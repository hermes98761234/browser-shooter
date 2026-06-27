import * as THREE from 'three'
import type maplibregl from 'maplibre-gl'
import { CollisionWorld } from '../engine/CollisionWorld'
import { lngLatDistance } from './geoUtils'

const RESCAN_METERS = 50
const BUILDING_LAYERS = ['building']

export class PlanetaryCollision {
  private world = new CollisionWorld()
  private lastLng = NaN
  private lastLat = NaN

  constructor(private map: Pick<maplibregl.Map, 'queryRenderedFeatures'>) {}

  get collisionWorld(): CollisionWorld { return this.world }

  update(lng: number, lat: number): CollisionWorld {
    if (
      !isNaN(this.lastLng) &&
      lngLatDistance(lng, lat, this.lastLng, this.lastLat) < RESCAN_METERS
    ) return this.world

    this.lastLng = lng
    this.lastLat = lat
    this.rebuild(lng, lat)
    return this.world
  }

  private rebuild(refLng: number, refLat: number) {
    this.world.boxes.length = 0
    const metersPerDegLon = 111320 * Math.cos((refLat * Math.PI) / 180)
    const metersPerDegLat = 111320

    const features = this.map.queryRenderedFeatures(undefined, { layers: BUILDING_LAYERS })
    for (const f of features) {
      const height = (f.properties?.height as number) ?? (f.properties?.render_height as number) ?? 10
      const rings: [number, number][][] =
        f.geometry.type === 'Polygon'
          ? [f.geometry.coordinates[0] as [number, number][]]
          : f.geometry.type === 'MultiPolygon'
          ? (f.geometry.coordinates as [number, number][][][]).map(p => p[0])
          : []

      for (const ring of rings) {
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
        for (const [bLng, bLat] of ring) {
          const x = (bLng - refLng) * metersPerDegLon
          const z = -(bLat - refLat) * metersPerDegLat
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (z < minZ) minZ = z
          if (z > maxZ) maxZ = z
        }
        const sx = maxX - minX
        const sz = maxZ - minZ
        if (sx > 0.5 && sz > 0.5) {
          this.world.addBox(
            new THREE.Vector3((minX + maxX) / 2, height / 2, (minZ + maxZ) / 2),
            new THREE.Vector3(sx, height, sz),
          )
        }
      }
    }
  }
}
