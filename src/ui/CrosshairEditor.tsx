import React, { useEffect, useRef, useState } from 'react'
import type { WeaponType } from '../types'
import { WEAPON_DEFS } from '../weapons/WeaponDefs'
import {
  type CrosshairSettings,
  type CrosshairConfig,
  resolveCrosshair,
} from '../settings/Crosshair'
import { drawCrosshair } from './drawCrosshair'

type Target = 'global' | WeaponType

const WEAPONS = Object.keys(WEAPON_DEFS) as WeaponType[]
const COLOR_PRESETS = ['#00ff66', '#00e5ff', '#ffe600', '#ff3b3b', '#ffffff', '#ff00ff']

const label: React.CSSProperties = { fontSize: 13, opacity: 0.6, marginBottom: 6, display: 'block' }
const rowGap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 14 }

interface CrosshairEditorProps {
  value: CrosshairSettings
  onChange: (next: CrosshairSettings) => void
}

export const CrosshairEditor: React.FC<CrosshairEditorProps> = ({ value, onChange }) => {
  const [target, setTarget] = useState<Target>('global')

  const hasOverride = target !== 'global' && value.perWeapon[target] != null
  const active: CrosshairConfig =
    target === 'global' ? value.global : resolveCrosshair(value, target)

  /** Write an edited config back to the right place, creating a per-weapon override if needed. */
  const update = (patch: Partial<CrosshairConfig>) => {
    const next = { ...active, ...patch }
    if (target === 'global') {
      onChange({ ...value, global: next })
    } else {
      onChange({ ...value, perWeapon: { ...value.perWeapon, [target]: next } })
    }
  }

  const resetToGlobal = () => {
    if (target === 'global') return
    const perWeapon = { ...value.perWeapon }
    delete perWeapon[target]
    onChange({ ...value, perWeapon })
  }

  return (
    <div style={rowGap}>
      <div>
        <span style={label}>CROSSHAIR FOR</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as Target)}
            style={{
              flex: 1, padding: 9, fontSize: 14, background: '#12121f', color: 'white',
              border: '1px solid #2a2a3f', borderRadius: 6,
            }}
          >
            <option value="global">Global default</option>
            {WEAPONS.map((w) => (
              <option key={w} value={w}>
                {WEAPON_DEFS[w].name}{value.perWeapon[w] ? ' — custom' : ''}
              </option>
            ))}
          </select>
          {hasOverride && (
            <button
              onClick={resetToGlobal}
              style={{
                padding: '0 14px', fontSize: 13, background: '#2a2a3f', color: 'white',
                border: 'none', borderRadius: 6, cursor: 'pointer',
              }}
            >
              Reset
            </button>
          )}
        </div>
        {target !== 'global' && !hasOverride && (
          <div style={{ fontSize: 12, opacity: 0.5, marginTop: 6 }}>
            Using the global default. Change anything below to give this weapon its own crosshair.
          </div>
        )}
      </div>

      <Preview config={active} />

      <div>
        <span style={label}>STYLE</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['dynamic', 'static'] as const).map((s) => (
            <button
              key={s}
              onClick={() => update({ style: s })}
              style={{
                flex: 1, padding: '9px 0', fontSize: 14, color: 'white', border: 'none',
                borderRadius: 6, cursor: 'pointer',
                background: active.style === s ? '#ff6600' : '#2a2a3f',
              }}
            >
              {s === 'dynamic' ? 'Dynamic' : 'Static'}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, opacity: 0.5, marginTop: 6 }}>
          {active.style === 'dynamic'
            ? 'Expands while moving, jumping and firing.'
            : 'Fixed size — never moves.'}
        </div>
      </div>

      <div>
        <span style={label}>COLOR</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              onClick={() => update({ color: c })}
              aria-label={`color ${c}`}
              style={{
                width: 26, height: 26, background: c, borderRadius: 5, cursor: 'pointer',
                border: active.color.toLowerCase() === c ? '2px solid white' : '2px solid #2a2a3f',
              }}
            />
          ))}
          <input
            type="color"
            value={active.color}
            onChange={(e) => update({ color: e.target.value })}
            style={{ width: 36, height: 28, background: 'none', border: 'none', cursor: 'pointer' }}
          />
        </div>
      </div>

      <Slider label="LENGTH" value={active.size} min={0} max={30} step={1}
        onChange={(v) => update({ size: v })} />
      <Slider label="THICKNESS" value={active.thickness} min={1} max={8} step={1}
        onChange={(v) => update({ thickness: v })} />
      <Slider label="GAP" value={active.gap} min={-5} max={30} step={1}
        onChange={(v) => update({ gap: v })} />
      <Slider label="OPACITY" value={active.opacity} min={0.1} max={1} step={0.05} digits={2}
        onChange={(v) => update({ opacity: v })} />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Toggle label="Center dot" on={active.dot} onClick={() => update({ dot: !active.dot })} />
        <Toggle label="Outline" on={active.outline} onClick={() => update({ outline: !active.outline })} />
        <Toggle label="T-style" on={active.tStyle} onClick={() => update({ tStyle: !active.tStyle })} />
      </div>

      {active.outline && (
        <Slider label="OUTLINE THICKNESS" value={active.outlineThickness} min={0} max={3} step={1}
          onChange={(v) => update({ outlineThickness: v })} />
      )}
    </div>
  )
}

const Slider: React.FC<{
  label: string; value: number; min: number; max: number; step: number; digits?: number
  onChange: (v: number) => void
}> = ({ label: text, value, min, max, step, digits = 0, onChange }) => (
  <div>
    <span style={label}>{text} — {value.toFixed(digits)}</span>
    <input
      type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{ width: '100%' }}
    />
  </div>
)

const Toggle: React.FC<{ label: string; on: boolean; onClick: () => void }> = ({ label: text, on, onClick }) => (
  <button
    onClick={onClick}
    style={{
      flex: '1 1 30%', padding: '9px 0', fontSize: 13, color: 'white', border: 'none',
      borderRadius: 6, cursor: 'pointer', background: on ? '#3399ff' : '#2a2a3f',
    }}
  >
    {on ? '☑' : '☐'} {text}
  </button>
)

/** Preview canvas that animates the dynamic bloom so the effect is visible while editing. */
const Preview: React.FC<{ config: CrosshairConfig }> = ({ config }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cfgRef = useRef(config)
  cfgRef.current = config
  const SIZE = 150

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = SIZE * dpr
    canvas.height = SIZE * dpr
    ctx.scale(dpr, dpr)

    let raf = 0
    const start = performance.now()
    const render = (now: number) => {
      const cfg = cfgRef.current
      // Gently pulse bloom 0..1.2 so dynamic crosshairs visibly breathe in the preview.
      const bloom = cfg.style === 'dynamic' ? (Math.sin((now - start) / 600) * 0.5 + 0.5) * 1.2 : 0
      ctx.clearRect(0, 0, SIZE, SIZE)
      drawCrosshair(ctx, cfg, bloom, SIZE / 2, SIZE / 2)
      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: SIZE, height: SIZE,
          background: 'repeating-conic-gradient(#1a1a2e 0% 25%, #15151f 0% 50%) 50% / 24px 24px',
          borderRadius: 8, border: '1px solid #2a2a3f',
        }}
      />
    </div>
  )
}
