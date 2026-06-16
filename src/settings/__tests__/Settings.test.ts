import { describe, it, expect, beforeEach } from 'vitest'
import { loadSettings, saveSettings, mobileControlsActive, DEFAULT_SETTINGS } from '../Settings'

describe('Settings', () => {
  beforeEach(() => localStorage.clear())

  it('returns defaults when nothing is stored', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('round-trips saved settings', () => {
    saveSettings({ playerName: 'Neo', mobileControls: 'on', lookSensitivity: 1.8 })
    expect(loadSettings()).toEqual({ playerName: 'Neo', mobileControls: 'on', lookSensitivity: 1.8 })
  })

  it('fills missing fields from defaults when stored data is partial', () => {
    localStorage.setItem('browser-shooter-settings', JSON.stringify({ playerName: 'Trinity' }))
    const loaded = loadSettings()
    expect(loaded.playerName).toBe('Trinity')
    expect(loaded.mobileControls).toBe(DEFAULT_SETTINGS.mobileControls)
    expect(loaded.lookSensitivity).toBe(DEFAULT_SETTINGS.lookSensitivity)
  })

  it('mobileControlsActive honours explicit on/off regardless of device', () => {
    expect(mobileControlsActive({ ...DEFAULT_SETTINGS, mobileControls: 'on' })).toBe(true)
    expect(mobileControlsActive({ ...DEFAULT_SETTINGS, mobileControls: 'off' })).toBe(false)
  })
})
