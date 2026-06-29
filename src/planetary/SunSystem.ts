import * as THREE from 'three'

export interface SunState {
  direction: THREE.Vector3
  color: THREE.Color
  intensity: number
  skyTop: THREE.Color
  skyHorizon: THREE.Color
  elevation: number
}

function sunPosition(lat: number, lng: number, date: Date): { azimuth: number; altitude: number } {
  const T = (date.getTime() / 1000 - 946728000) / 31557600
  const M = ((357.5291 + 35999.0503 * T) % 360) * (Math.PI / 180)
  const L = ((280.46645 + 36000.76983 * T) % 360) * (Math.PI / 180)
  const lambda = L + (1.9146 * Math.sin(M) + 0.019993 * Math.sin(2 * M)) * (Math.PI / 180)
  const epsilon = (23.439 - 0.00000036 * T * 3600) * (Math.PI / 180)
  const sinDelta = Math.sin(epsilon) * Math.sin(lambda)
  const cosDelta = Math.sqrt(1 - sinDelta * sinDelta)
  const latRad = lat * Math.PI / 180

  const gmst0 = (280.46061837 + 360.98564736629 * (date.getTime() / 86400000 - Math.floor(date.getTime() / 86400000))) * (Math.PI / 180)
  const ha = gmst0 + lng * Math.PI / 180 - Math.atan2(
    Math.cos(epsilon) * Math.sin(lambda),
    Math.cos(lambda),
  )

  const sinAlt = Math.sin(latRad) * sinDelta + Math.cos(latRad) * cosDelta * Math.cos(ha)
  const altitude = Math.asin(sinAlt)
  const azimuth = Math.atan2(
    -Math.sin(ha) * cosDelta,
    Math.sin(latRad) * cosDelta * Math.cos(ha) - Math.cos(latRad) * sinDelta,
  )

  return { azimuth, altitude }
}

export class SunSystem {
  private lat = 51.5074
  private lng = -0.1278

  setLocation(lat: number, lng: number): void {
    this.lat = lat
    this.lng = lng
  }

  compute(hour: number): SunState {
    return this.computeFromDate(this.hoursToDate(hour))
  }

  computeAt(lat: number, lng: number, hour: number): SunState {
    this.setLocation(lat, lng)
    return this.compute(hour)
  }

  computeFromDate(date: Date): SunState {
    const { azimuth, altitude } = sunPosition(this.lat, this.lng, date)

    const dirX = Math.sin(azimuth) * Math.cos(altitude)
    const dirY = Math.max(0, Math.sin(altitude))
    const dirZ = Math.cos(azimuth) * Math.cos(altitude)

    const direction = new THREE.Vector3(dirX, dirY, dirZ)
    if (direction.lengthSq() < 0.0001) direction.set(0, 1, 0)
    direction.normalize()

    const sinElev = Math.sin(altitude)
    const intensity = Math.max(0, sinElev) * 1.2

    const color = new THREE.Color()
    if (sinElev <= -0.06) {
      color.setHex(0x050510)
    } else if (sinElev <= 0) {
      color.setHex(0x102040)
    } else if (sinElev < 0.3) {
      const f = sinElev / 0.3
      color.setRGB(1, 0.38 + f * 0.62, f * 1.0)
    } else {
      color.setHex(0xffffff)
    }

    const skyTop = new THREE.Color()
    const skyHorizon = new THREE.Color()
    if (sinElev <= -0.06) {
      skyTop.setHex(0x020205)
      skyHorizon.setHex(0x050510)
    } else if (sinElev <= 0) {
      const f = (sinElev + 0.06) / 0.06
      skyTop.lerpColors(new THREE.Color(0x020205), new THREE.Color(0x0d1535), f)
      skyHorizon.lerpColors(new THREE.Color(0x050510), new THREE.Color(0x0a1525), f)
    } else if (sinElev < 0.25) {
      const f = sinElev / 0.25
      skyTop.lerpColors(new THREE.Color(0x0d1535), new THREE.Color(0x1a50a0), f)
      skyHorizon.lerpColors(new THREE.Color(0xff6035), new THREE.Color(0x9ec7e8), f)
    } else {
      skyTop.setHex(0x1a50a0)
      skyHorizon.setHex(0x9ec7e8)
    }

    return { direction, color, intensity, skyTop, skyHorizon, elevation: altitude }
  }

  private hoursToDate(hour: number): Date {
    const d = new Date()
    d.setHours(hour, 0, 0, 0)
    return d
  }
}
