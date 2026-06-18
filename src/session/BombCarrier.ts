import type { Vec3 } from '../types'

export enum BombState {
  None = 'none',
  Carried = 'carried',
  Dropped = 'dropped',
  Planting = 'planting',
  Planted = 'planted',
  Defusing = 'defusing',
  Defused = 'defused',
  Exploded = 'exploded',
}

export class BombCarrier {
  state: BombState = BombState.None
  carrier: string | null = null
  position: Vec3 | null = null
  site: 'A' | 'B' | null = null
  timer: number = 40
  plantProgress: number = 0
  defuseProgress: number = 0

  private plantDuration = 3
  defuseDuration = 5
  private defuseDurationNoKit = 10

  reset(): void {
    this.state = BombState.None
    this.carrier = null
    this.position = null
    this.site = null
    this.timer = 40
    this.plantProgress = 0
    this.defuseProgress = 0
  }

  assign(playerId: string): void {
    this.state = BombState.Carried
    this.carrier = playerId
    this.position = null
    this.site = null
    this.timer = 40
    this.plantProgress = 0
    this.defuseProgress = 0
  }

  drop(pos: Vec3): void {
    this.state = BombState.Dropped
    this.carrier = null
    this.position = pos
  }

  pickup(playerId: string): void {
    if (this.state !== BombState.Dropped) return
    this.state = BombState.Carried
    this.carrier = playerId
    this.position = null
  }

  startPlant(site: 'A' | 'B'): void {
    if (this.state !== BombState.Carried) return
    this.state = BombState.Planting
    this.site = site
    this.plantProgress = 0
  }

  cancelPlant(): void {
    if (this.state !== BombState.Planting) return
    this.state = BombState.Carried
    this.plantProgress = 0
    this.site = null
  }

  startDefuse(hasKit: boolean = true): void {
    if (this.state !== BombState.Planted) return
    this.state = BombState.Defusing
    this.defuseProgress = 0
    this.defuseDuration = hasKit ? 5 : this.defuseDurationNoKit
  }

  cancelDefuse(): void {
    if (this.state !== BombState.Defusing) return
    this.state = BombState.Planted
    this.defuseProgress = 0
  }

  update(dt: number): void {
    if (this.state === BombState.Planting) {
      this.plantProgress += dt
      if (this.plantProgress >= this.plantDuration) {
        this.state = BombState.Planted
        this.timer = 40
        this.plantProgress = this.plantDuration
      }
    } else if (this.state === BombState.Planted) {
      this.timer -= dt
      if (this.timer <= 0) {
        this.state = BombState.Exploded
        this.timer = 0
      }
    } else if (this.state === BombState.Defusing) {
      this.timer -= dt
      if (this.timer <= 0) {
        this.state = BombState.Exploded
        this.timer = 0
        return
      }
      this.defuseProgress += dt
      if (this.defuseProgress >= this.defuseDuration) {
        this.state = BombState.Defused
        this.defuseProgress = this.defuseDuration
      }
    }
  }
}
