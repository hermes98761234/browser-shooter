export type MobileControlsMode = 'auto' | 'on' | 'off'

export interface Settings {
  /** Display name shown on the scoreboard and to other players. */
  playerName: string
  /** Whether the on-screen touch controls are shown. 'auto' uses touch-device detection. */
  mobileControls: MobileControlsMode
  /** Multiplier applied to touch look speed (1 = default). */
  lookSensitivity: number
}

const STORAGE_KEY = 'browser-shooter-settings'

export const DEFAULT_SETTINGS: Settings = {
  playerName: 'Player',
  mobileControls: 'auto',
  lookSensitivity: 1,
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* localStorage unavailable — settings simply won't persist */
  }
}

/** True if the current device reports touch support. */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  return 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0
}

/** Resolve whether the on-screen touch controls should be active for these settings. */
export function mobileControlsActive(settings: Settings): boolean {
  if (settings.mobileControls === 'on') return true
  if (settings.mobileControls === 'off') return false
  return isTouchDevice()
}
