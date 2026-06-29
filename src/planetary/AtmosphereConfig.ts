import * as THREE from 'three'

export interface AtmosphereState {
  turbidity: number
  rayleigh: number
  mieCoefficient: number
  mieDirectionalG: number
  fogColor: THREE.Color
  sunColor: THREE.Color
  sunIntensity: number
  ambientColor: THREE.Color
  groundColor: THREE.Color
}

export class AtmosphereConfig {
  private _state: AtmosphereState = this.nightState()

  get state(): AtmosphereState {
    return this._state
  }

  update(sunElevationRad: number): AtmosphereState {
    if (sunElevationRad < -0.1) {
      this._state = this.nightState()
    } else if (sunElevationRad < -0.05) {
      const f = (sunElevationRad + 0.1) / 0.05
      this._state = lerpAtmosphere(this.nightState(), this.sunriseState(), f)
    } else if (sunElevationRad < 0.05) {
      const f = (sunElevationRad + 0.05) / 0.1
      this._state = lerpAtmosphere(this.sunriseState(), this.dayState(), f)
    } else if (sunElevationRad < 0.6) {
      const f = (sunElevationRad - 0.05) / 0.55
      this._state = lerpAtmosphere(this.dayState(), this.middayState(), f)
    } else {
      this._state = this.middayState()
    }
    return this._state
  }

  private nightState(): AtmosphereState {
    return {
      turbidity: 2, rayleigh: 0.3, mieCoefficient: 0.001, mieDirectionalG: 0.6,
      fogColor: new THREE.Color(0x080810), sunColor: new THREE.Color(0x050510),
      sunIntensity: 0, ambientColor: new THREE.Color(0x050520),
      groundColor: new THREE.Color(0x030510),
    }
  }

  private sunriseState(): AtmosphereState {
    return {
      turbidity: 4, rayleigh: 2, mieCoefficient: 0.01, mieDirectionalG: 0.8,
      fogColor: new THREE.Color(0xff7030), sunColor: new THREE.Color(0xff6020),
      sunIntensity: 0.4, ambientColor: new THREE.Color(0x301560),
      groundColor: new THREE.Color(0x301020),
    }
  }

  private dayState(): AtmosphereState {
    return {
      turbidity: 10, rayleigh: 2, mieCoefficient: 0.005, mieDirectionalG: 0.8,
      fogColor: new THREE.Color(0x9ec7e8), sunColor: new THREE.Color(0xffffff),
      sunIntensity: 1.2, ambientColor: new THREE.Color(0xffffff),
      groundColor: new THREE.Color(0x444444),
    }
  }

  private middayState(): AtmosphereState {
    return {
      turbidity: 8, rayleigh: 3, mieCoefficient: 0.003, mieDirectionalG: 0.85,
      fogColor: new THREE.Color(0x6aafe0), sunColor: new THREE.Color(0xfffef8),
      sunIntensity: 1.4, ambientColor: new THREE.Color(0xffffff),
      groundColor: new THREE.Color(0x555555),
    }
  }
}

function lerpAtmosphere(a: AtmosphereState, b: AtmosphereState, t: number): AtmosphereState {
  return {
    turbidity: a.turbidity + (b.turbidity - a.turbidity) * t,
    rayleigh: a.rayleigh + (b.rayleigh - a.rayleigh) * t,
    mieCoefficient: a.mieCoefficient + (b.mieCoefficient - a.mieCoefficient) * t,
    mieDirectionalG: a.mieDirectionalG + (b.mieDirectionalG - a.mieDirectionalG) * t,
    fogColor: new THREE.Color().lerpColors(a.fogColor, b.fogColor, t),
    sunColor: new THREE.Color().lerpColors(a.sunColor, b.sunColor, t),
    sunIntensity: a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t,
    ambientColor: new THREE.Color().lerpColors(a.ambientColor, b.ambientColor, t),
    groundColor: new THREE.Color().lerpColors(a.groundColor, b.groundColor, t),
  }
}
