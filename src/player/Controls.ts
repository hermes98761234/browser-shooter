import { DEFAULT_KEYMAP, type Keymap } from '../settings/Settings'
import type { GameState, Team } from '../types'

export class Controls {
  forward = false
  backward = false
  left = false
  right = false
  jump = false
  shoot = false
  private element: HTMLElement
  private getGameState: () => GameState
  private keymap: Keymap
  private boundKeyDown: (e: KeyboardEvent) => void
  private boundKeyUp: (e: KeyboardEvent) => void
  private boundMouseDown: (e: MouseEvent) => void
  private boundMouseUp: (e: MouseEvent) => void

  onMouseMove: ((e: MouseEvent) => void) | null = null
  onCycleWeapon: (() => void) | null = null
  onToggleStore: (() => void) | null = null
  /** Fired on scoreboard key down (true) / up (false) to show/hide the scoreboard. */
  onScoreboard: ((show: boolean) => void) | null = null
  onThrowGrenade: ((mode: 'long' | 'short') => void) | null = null
  /** Authority-only: add a bot to the given team / remove the last bot. */
  onAddBot: ((team: Team) => void) | null = null
  onRemoveBot: (() => void) | null = null
  onSelectGrenade: ((type: 'he' | 'flash' | 'smoke') => void) | null = null
  onCycleGrenade: (() => void) | null = null
  onIsStoreOpen: (() => boolean) | null = null
  /** True when a grenade is selected; left click then throws instead of firing. */
  onIsGrenadeSelected: (() => boolean) | null = null
  /** Fired on push-to-talk key down / up (hold to transmit voice). */
  onTalkStart: (() => void) | null = null
  onTalkStop: (() => void) | null = null
  private talkHeld = false
  private scoreboardHeld = false

  constructor(element: HTMLElement, getGameState: () => GameState, keymap: Keymap = DEFAULT_KEYMAP) {
    this.element = element
    this.getGameState = getGameState
    this.keymap = keymap

    this.boundKeyDown = (e: KeyboardEvent) => this.onKeyDown(e)
    this.boundKeyUp = (e: KeyboardEvent) => this.onKeyUp(e)
    this.boundMouseDown = (e: MouseEvent) => this.onMouseDown(e)
    this.boundMouseUp = (e: MouseEvent) => this.onMouseUp(e)

    this.bindEvents()
  }

  private bindEvents() {
    document.addEventListener('keydown', this.boundKeyDown)
    document.addEventListener('keyup', this.boundKeyUp)
    document.addEventListener('mousedown', this.boundMouseDown)
    document.addEventListener('mouseup', this.boundMouseUp)
    document.addEventListener('mousemove', this.boundMouseMove)
    document.addEventListener('pointerlockchange', this.boundPointerLockChange)
  }

  private boundMouseMove = (e: MouseEvent) => {
    if (this.onMouseMove && document.pointerLockElement === this.element) {
      this.onMouseMove(e)
    }
  }

  private onKeyDown(e: KeyboardEvent) {
    const km = this.keymap
    if (e.code === km.forward) { this.forward = true; return }
    if (e.code === km.backward) { this.backward = true; return }
    if (e.code === km.left) { this.left = true; return }
    if (e.code === km.right) { this.right = true; return }
    if (e.code === km.jump) { this.jump = true; return }
    if (e.code === km.scoreboard) {
      e.preventDefault()
      if (!this.scoreboardHeld) { this.scoreboardHeld = true; this.onScoreboard?.(true) }
      return
    }
    if (e.code === km.buy) { e.preventDefault(); this.onToggleStore?.(); return }
    if (e.code === km.selectGrenadeHE) { this.onSelectGrenade?.('he'); return }
    if (e.code === km.selectGrenadeFlash) { this.onSelectGrenade?.('flash'); return }
    if (e.code === km.selectGrenadeSmoke) { this.onSelectGrenade?.('smoke'); return }
    if (e.code === km.cycleGrenade) { this.onCycleGrenade?.(); return }
    if (e.code === km.addBotCT) { this.onAddBot?.('ct'); return }
    if (e.code === km.addBotT) { this.onAddBot?.('t'); return }
    if (e.code === km.removeBot) { this.onRemoveBot?.(); return }
    if (e.code === km.pushToTalk) {
      if (!this.talkHeld) { this.talkHeld = true; this.onTalkStart?.() }
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    const km = this.keymap
    if (e.code === km.forward) { this.forward = false; return }
    if (e.code === km.backward) { this.backward = false; return }
    if (e.code === km.left) { this.left = false; return }
    if (e.code === km.right) { this.right = false; return }
    if (e.code === km.jump) { this.jump = false; return }
    if (e.code === km.scoreboard) {
      e.preventDefault()
      this.scoreboardHeld = false
      this.onScoreboard?.(false)
      return
    }
    if (e.code === km.pushToTalk) {
      this.talkHeld = false
      this.onTalkStop?.()
    }
  }

  private boundPointerLockChange = () => {
    if (document.pointerLockElement !== this.element) {
      this.shoot = false
    }
  }

  private onMouseDown(e: MouseEvent) {
    if (e.button === 0) {
      if (this.getGameState() === 'playing' && !this.onIsStoreOpen?.()) {
        if (document.pointerLockElement !== this.element) {
          this.element.requestPointerLock()
        }
        if (this.onIsGrenadeSelected?.()) {
          this.onThrowGrenade?.('long')
        } else {
          this.shoot = true
        }
      }
    }
    if (e.button === 2) {
      if (this.getGameState() === 'playing' && !this.onIsStoreOpen?.()) {
        this.onThrowGrenade?.('short')
      }
    }
  }

  private onMouseUp(e: MouseEvent) {
    if (e.button === 0) {
      this.shoot = false
    }
  }

  getMovement() {
    return {
      forward: this.forward,
      backward: this.backward,
      left: this.left,
      right: this.right,
      jump: this.jump,
    }
  }

  destroy() {
    document.removeEventListener('keydown', this.boundKeyDown)
    document.removeEventListener('keyup', this.boundKeyUp)
    document.removeEventListener('mousedown', this.boundMouseDown)
    document.removeEventListener('mouseup', this.boundMouseUp)
    document.removeEventListener('mousemove', this.boundMouseMove)
    document.removeEventListener('pointerlockchange', this.boundPointerLockChange)
    if (document.pointerLockElement === this.element) {
      document.exitPointerLock()
    }
  }
}
