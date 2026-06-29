import * as THREE from 'three'

export interface SunState {
  direction: THREE.Vector3  // normalized, points from scene toward sun
  color: THREE.Color
  intensity: number         // 0 at night, up to 1.2 at noon
  skyTop: THREE.Color
  skyHorizon: THREE.Color
}

export class SunSystem {
  compute(hour: number): SunState {
    // t: 0 at 6am, 0.5 at noon, 1 at 6pm, negative/>1 at night
    const t = (hour - 6) / 12
    const elevAngle = t * Math.PI  // radians; sin gives 0 at dawn, 1 at noon, 0 at dusk
    const sinElev = Math.sin(elevAngle)

    // Azimuth: sun sweeps from east (-X) at dawn through south (+Z) at noon to west (+X) at dusk
    const aziAngle = (t - 0.5) * Math.PI

    // groundDist = cos(asin(sinElev)) = sqrt(1 - sinElev²), always non-negative
    const groundDist = Math.sqrt(Math.max(0, 1 - sinElev * sinElev))

    const dirX = groundDist * Math.sin(aziAngle)
    const dirY = Math.max(0, sinElev)
    const dirZ = groundDist * Math.cos(aziAngle)

    // Fallback for midnight when sun is directly below (zero vector)
    const direction = new THREE.Vector3(dirX, dirY, dirZ)
    if (direction.lengthSq() < 0.0001) direction.set(0, 1, 0)
    direction.normalize()

    const intensity = Math.max(0, sinElev) * 1.2

    const color = new THREE.Color()
    if (sinElev <= 0) {
      color.setHex(0x102040)
    } else if (sinElev < 0.3) {
      // low sun: orange
      const f = sinElev / 0.3
      color.setRGB(1, 0.38 + f * 0.62, f * 1.0)
    } else {
      color.setHex(0xffffff)
    }

    const skyTop = new THREE.Color()
    const skyHorizon = new THREE.Color()
    if (sinElev <= 0) {
      skyTop.setHex(0x050510)
      skyHorizon.setHex(0x0d1020)
    } else if (sinElev < 0.25) {
      const f = sinElev / 0.25
      skyTop.lerpColors(new THREE.Color(0x0d1535), new THREE.Color(0x1a50a0), f)
      skyHorizon.lerpColors(new THREE.Color(0xff6035), new THREE.Color(0x9ec7e8), f)
    } else {
      skyTop.setHex(0x1a50a0)
      skyHorizon.setHex(0x9ec7e8)
    }

    return { direction, color, intensity, skyTop, skyHorizon }
  }
}
