import * as THREE from 'three'

export interface AtmosphereState {
  turbidity: number
  rayleigh: number
  mieCoefficient: number
  mieDirectionalG: number
  fogColor: THREE.Color
  sunColor: THREE.Color
  sunIntensity: number
  hemiSky: THREE.Color     // HemisphereLight sky color
  hemiGround: THREE.Color   // HemisphereLight ground color
  hemiIntensity: number
}

interface Keyframe {
  elevation: number
  turbidity: number
  rayleigh: number
  mieCoefficient: number
  mieDirectionalG: number
  fogColor: THREE.Color
  sunColor: THREE.Color
  sunIntensity: number
  hemiSky: THREE.Color
  hemiGround: THREE.Color
  hemiIntensity: number
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// Named keyframes ordered by ascending elevation.
// Elevations below the first are clamped to night; above the last to midday.
const KEYFRAMES: Keyframe[] = [
  {
    elevation: -0.1,
    turbidity: 2,
    rayleigh: 0.1,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.7,
    fogColor: new THREE.Color(0x080810),
    sunColor: new THREE.Color(0x102040),
    sunIntensity: 0,
    hemiSky: new THREE.Color(0x0a0a1a),
    hemiGround: new THREE.Color(0x050508),
    hemiIntensity: 0.15,
  },
  {
    elevation: 0.0,
    turbidity: 8,
    rayleigh: 2.0,
    mieCoefficient: 0.02,
    mieDirectionalG: 0.9,
    fogColor: new THREE.Color(0xff7030),
    sunColor: new THREE.Color(0xff6020),
    sunIntensity: 0.8,
    hemiSky: new THREE.Color(0xff8040),
    hemiGround: new THREE.Color(0x301810),
    hemiIntensity: 0.4,
  },
  {
    elevation: 0.15,
    turbidity: 4,
    rayleigh: 1.0,
    mieCoefficient: 0.005,
    mieDirectionalG: 0.8,
    fogColor: new THREE.Color(0x9ec7e8),
    sunColor: new THREE.Color(0xffffff),
    sunIntensity: 1.2,
    hemiSky: new THREE.Color(0x87ceeb),
    hemiGround: new THREE.Color(0x405020),
    hemiIntensity: 0.6,
  },
  {
    elevation: 0.6,
    turbidity: 3,
    rayleigh: 0.8,
    mieCoefficient: 0.003,
    mieDirectionalG: 0.75,
    fogColor: new THREE.Color(0x5080c0),
    sunColor: new THREE.Color(0xffffff),
    sunIntensity: 1.4,
    hemiSky: new THREE.Color(0x4080d0),
    hemiGround: new THREE.Color(0x304010),
    hemiIntensity: 0.7,
  },
]

export class AtmosphereConfig {
  private _state: AtmosphereState = this._computeFromKeyframe(KEYFRAMES[0])

  /** Update atmosphere state for the given sun elevation in radians. */
  update(sunElevationRad: number): AtmosphereState {
    // Clamp below lowest keyframe → night
    if (sunElevationRad <= KEYFRAMES[0].elevation) {
      this._state = this._computeFromKeyframe(KEYFRAMES[0])
      return this._state
    }

    // Clamp above highest keyframe → midday
    const last = KEYFRAMES[KEYFRAMES.length - 1]
    if (sunElevationRad >= last.elevation) {
      this._state = this._computeFromKeyframe(last)
      return this._state
    }

    // Find the segment [lo, hi] that straddles sunElevationRad
    let lo = KEYFRAMES[0]
    let hi = KEYFRAMES[1]
    for (let i = 1; i < KEYFRAMES.length; i++) {
      if (KEYFRAMES[i].elevation >= sunElevationRad) {
        lo = KEYFRAMES[i - 1]
        hi = KEYFRAMES[i]
        break
      }
    }

    const t = (sunElevationRad - lo.elevation) / (hi.elevation - lo.elevation)

    const fogColor = new THREE.Color().lerpColors(lo.fogColor, hi.fogColor, t)
    const sunColor = new THREE.Color().lerpColors(lo.sunColor, hi.sunColor, t)
    const hemiSky = new THREE.Color().lerpColors(lo.hemiSky, hi.hemiSky, t)
    const hemiGround = new THREE.Color().lerpColors(lo.hemiGround, hi.hemiGround, t)

    this._state = {
      turbidity: lerp(lo.turbidity, hi.turbidity, t),
      rayleigh: lerp(lo.rayleigh, hi.rayleigh, t),
      mieCoefficient: lerp(lo.mieCoefficient, hi.mieCoefficient, t),
      mieDirectionalG: lerp(lo.mieDirectionalG, hi.mieDirectionalG, t),
      fogColor,
      sunColor,
      sunIntensity: lerp(lo.sunIntensity, hi.sunIntensity, t),
      hemiSky,
      hemiGround,
      hemiIntensity: lerp(lo.hemiIntensity, hi.hemiIntensity, t),
    }
    return this._state
  }

  /** The last state computed by update(). */
  get state(): AtmosphereState {
    return this._state
  }

  private _computeFromKeyframe(kf: Keyframe): AtmosphereState {
    return {
      turbidity: kf.turbidity,
      rayleigh: kf.rayleigh,
      mieCoefficient: kf.mieCoefficient,
      mieDirectionalG: kf.mieDirectionalG,
      fogColor: kf.fogColor.clone(),
      sunColor: kf.sunColor.clone(),
      sunIntensity: kf.sunIntensity,
      hemiSky: kf.hemiSky.clone(),
      hemiGround: kf.hemiGround.clone(),
      hemiIntensity: kf.hemiIntensity,
    }
  }
}
