import type { WeaponType } from '../types'

/**
 * A single crosshair appearance, modeled on the configurable crosshair from
 * Counter-Strike (style, color, length, thickness, gap, dot, outline, T-style).
 */
export interface CrosshairConfig {
  /** 'dynamic' expands the gap as accuracy drops (moving/jumping/firing); 'static' never moves. */
  style: 'dynamic' | 'static'
  /** CSS color (hex) of the crosshair lines. */
  color: string
  /** Length of each line, in pixels. */
  size: number
  /** Line thickness, in pixels. */
  thickness: number
  /** Gap between the center and the start of each line, in pixels (may be negative). */
  gap: number
  /** Draw a center dot. */
  dot: boolean
  /** Draw a dark outline behind the lines for contrast. */
  outline: boolean
  /** Outline thickness, in pixels (only used when `outline` is true). */
  outlineThickness: number
  /** T-style hides the top line (classic CS "T" crosshair). */
  tStyle: boolean
  /** Overall opacity, 0..1. */
  opacity: number
}

/**
 * The whole crosshair configuration: one global default plus optional
 * per-weapon overrides. A weapon without an override uses {@link global}.
 */
export interface CrosshairSettings {
  global: CrosshairConfig
  perWeapon: Partial<Record<WeaponType, CrosshairConfig>>
}

export const DEFAULT_CROSSHAIR: CrosshairConfig = {
  style: 'dynamic',
  color: '#00ff66',
  size: 8,
  thickness: 2,
  gap: 4,
  dot: false,
  outline: true,
  outlineThickness: 1,
  tStyle: false,
  opacity: 1,
}

export const DEFAULT_CROSSHAIR_SETTINGS: CrosshairSettings = {
  global: { ...DEFAULT_CROSSHAIR },
  perWeapon: {},
}

/** The effective config for a weapon: its override if present, else the global default. */
export function resolveCrosshair(settings: CrosshairSettings, weapon: WeaponType): CrosshairConfig {
  return settings.perWeapon[weapon] ?? settings.global
}

/** Fill any missing fields of a partially-stored config from the defaults. */
export function normalizeCrosshair(partial: Partial<CrosshairConfig> | undefined): CrosshairConfig {
  return { ...DEFAULT_CROSSHAIR, ...partial }
}

/** Merge a stored (possibly partial / older) crosshair settings blob with the defaults. */
export function normalizeCrosshairSettings(
  partial: Partial<CrosshairSettings> | undefined,
): CrosshairSettings {
  if (!partial) return { global: { ...DEFAULT_CROSSHAIR }, perWeapon: {} }
  const perWeapon: CrosshairSettings['perWeapon'] = {}
  for (const [weapon, cfg] of Object.entries(partial.perWeapon ?? {})) {
    if (cfg) perWeapon[weapon as WeaponType] = normalizeCrosshair(cfg)
  }
  return {
    global: normalizeCrosshair(partial.global),
    perWeapon,
  }
}
