import type { GameState, Team } from '../types'

export const PUSH_TO_TALK_KEY = 'KeyK'

export class Controls {
  forward = false
  backward = false
  left = false
  right = false
  jump = false
  shoot = false
  private element: HTMLElement
  private getGameState: () => GameState
  private boundKeyDown: (e: KeyboardEvent) => void
  private boundKeyUp: (e: KeyboardEvent) => void
  private boundMouseDown: (e: MouseEvent) => void
  private boundMouseUp: (e: MouseEvent) => void

  onMouseMove: ((e: MouseEvent) => void) | null = null
  onCycleWeapon: (() => void) | null = null
  onToggleStore: (() => void) | null = null
  /** Fired on Tab down (true) / up (false) to show/hide the scoreboard. */
  onScoreboard: ((show: boolean) => void) | null = null
  onThrowGrenade: ((mode: 'long' | 'short') => void) | null = null
  /** Authority-only: add a bot to the given team / remove the last bot. */
  onAddBot: ((team: Team) => void) | null = null
  onRemoveBot: (() => void) | null = null
  onSelectGrenade: ((type: 'he' | 'flash' | 'smoke') => void) | null = null
  onCycleGrenade: (() => void) | null = null
  onIsStoreOpen: (() => boolean) | null = null
  /** Fired on push-to-talk key down / up (hold to transmit voice). */
  onTalkStart: (() => void) | null = null
  onTalkStop: (() => void) | null = null
  private talkHeld = false
  private scoreboardHeld = false

  constructor(element: HTMLElement, getGameState: () => GameState) {
    this.element = element
    this.getGameState = getGameState

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
    switch (e.code) {
      case 'KeyW': this.forward = true; break
      case 'KeyS': this.backward = true; break
      case 'KeyA': this.left = true; break
      case 'KeyD': this.right = true; break
      case 'Space': this.jump = true; break
      case 'Tab':
        e.preventDefault()
        if (!this.scoreboardHeld) { this.scoreboardHeld = true; this.onScoreboard?.(true) }
        break
      case 'KeyB': e.preventDefault(); this.onToggleStore?.(); break
      case 'Digit4': this.onSelectGrenade?.('he'); break
      case 'Digit5': this.onSelectGrenade?.('flash'); break
      case 'Digit6': this.onSelectGrenade?.('smoke'); break
      case 'KeyG': this.onCycleGrenade?.(); break
      case 'BracketLeft': this.onAddBot?.('ct'); break
      case 'BracketRight': this.onAddBot?.('t'); break
      case 'Backslash': this.onRemoveBot?.(); break
      case PUSH_TO_TALK_KEY:
        if (!this.talkHeld) { this.talkHeld = true; this.onTalkStart?.() }
        break
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    switch (e.code) {
      case 'KeyW': this.forward = false; break
      case 'KeyS': this.backward = false; break
      case 'KeyA': this.left = false; break
      case 'KeyD': this.right = false; break
      case 'Space': this.jump = false; break
      case 'Tab':
        e.preventDefault()
        this.scoreboardHeld = false
        this.onScoreboard?.(false)
        break
      case PUSH_TO_TALK_KEY:
        this.talkHeld = false
        this.onTalkStop?.()
        break
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
        this.shoot = true
        if (document.pointerLockElement !== this.element) {
          this.element.requestPointerLock()
        }
        this.onThrowGrenade?.('long')
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
