import React, { useRef } from 'react'
import type { MutableRefObject } from 'react'
import type { Controls } from '../player/Controls'

interface TouchControlsProps {
  controls: Controls
  lookRef: MutableRefObject<{ yaw: number; pitch: number }>
  lookSensitivity: number
  onReload: () => void
  onCycleWeapon: () => void
  onToggleStore: () => void
  onToggleScoreboard: () => void
}

const JOY_SIZE = 130
const JOY_RADIUS = JOY_SIZE / 2
const DEADZONE = 0.28
const LOOK_SPEED = 0.004

/**
 * On-screen controls for touch devices: a movement joystick (left), a look pad
 * covering the rest of the screen (right), and action buttons (bottom-right).
 * Writes directly into the shared Controls instance and look ref, so the game
 * loop consumes touch input through the exact same path as keyboard/mouse.
 */
export const TouchControls: React.FC<TouchControlsProps> = ({
  controls, lookRef, lookSensitivity,
  onReload, onCycleWeapon, onToggleStore, onToggleScoreboard,
}) => {
  const joyId = useRef<number | null>(null)
  const joyCenter = useRef({ x: 0, y: 0 })
  const thumbRef = useRef<HTMLDivElement>(null)

  const lookId = useRef<number | null>(null)
  const lookLast = useRef({ x: 0, y: 0 })

  // ---- Movement joystick ----
  function joyStart(e: React.TouchEvent) {
    e.preventDefault()
    const t = e.changedTouches[0]
    joyId.current = t.identifier
    const rect = e.currentTarget.getBoundingClientRect()
    joyCenter.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    updateJoy(t.clientX, t.clientY)
  }
  function joyMove(e: React.TouchEvent) {
    e.preventDefault()
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === joyId.current) { updateJoy(t.clientX, t.clientY); break }
    }
  }
  function joyEnd(e: React.TouchEvent) {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === joyId.current) { releaseJoy(); break }
    }
  }
  function updateJoy(x: number, y: number) {
    let dx = x - joyCenter.current.x
    let dy = y - joyCenter.current.y
    const dist = Math.hypot(dx, dy)
    if (dist > JOY_RADIUS) { dx = (dx / dist) * JOY_RADIUS; dy = (dy / dist) * JOY_RADIUS }
    const nx = dx / JOY_RADIUS
    const ny = dy / JOY_RADIUS
    controls.left = nx < -DEADZONE
    controls.right = nx > DEADZONE
    controls.forward = ny < -DEADZONE
    controls.backward = ny > DEADZONE
    if (thumbRef.current) {
      thumbRef.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
    }
  }
  function releaseJoy() {
    joyId.current = null
    controls.left = controls.right = controls.forward = controls.backward = false
    if (thumbRef.current) thumbRef.current.style.transform = 'translate(-50%, -50%)'
  }

  // ---- Look pad ----
  function lookStart(e: React.TouchEvent) {
    e.preventDefault()
    const t = e.changedTouches[0]
    lookId.current = t.identifier
    lookLast.current = { x: t.clientX, y: t.clientY }
  }
  function lookMove(e: React.TouchEvent) {
    e.preventDefault()
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== lookId.current) continue
      const dx = t.clientX - lookLast.current.x
      const dy = t.clientY - lookLast.current.y
      lookLast.current = { x: t.clientX, y: t.clientY }
      const look = lookRef.current
      look.yaw -= dx * LOOK_SPEED * lookSensitivity
      look.pitch -= dy * LOOK_SPEED * lookSensitivity
      look.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, look.pitch))
      break
    }
  }
  function lookEnd(e: React.TouchEvent) {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === lookId.current) { lookId.current = null; break }
    }
  }

  // ---- Action buttons ----
  const actionBtn: React.CSSProperties = {
    pointerEvents: 'auto', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
    width: 60, height: 60, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)',
    background: 'rgba(255,255,255,0.12)', color: 'white', fontSize: 13, fontWeight: 'bold',
    fontFamily: 'monospace', display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
  const tap = (fn: () => void) => (e: React.TouchEvent) => { e.preventDefault(); fn() }
  const hold = (set: (v: boolean) => void) => ({
    onTouchStart: (e: React.TouchEvent) => { e.preventDefault(); set(true) },
    onTouchEnd: (e: React.TouchEvent) => { e.preventDefault(); set(false) },
    onTouchCancel: (e: React.TouchEvent) => { e.preventDefault(); set(false) },
  })

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 25, touchAction: 'none' }}>
      {/* Look pad — full screen, underneath joystick & buttons so it only catches free space */}
      <div
        style={{ position: 'absolute', inset: 0, pointerEvents: 'auto', touchAction: 'none' }}
        onTouchStart={lookStart} onTouchMove={lookMove} onTouchEnd={lookEnd} onTouchCancel={lookEnd}
      />

      {/* Movement joystick (bottom-left) */}
      <div
        onTouchStart={joyStart} onTouchMove={joyMove} onTouchEnd={joyEnd} onTouchCancel={joyEnd}
        style={{
          position: 'absolute', left: 28, bottom: 28, width: JOY_SIZE, height: JOY_SIZE,
          borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)',
          background: 'rgba(255,255,255,0.08)', pointerEvents: 'auto', touchAction: 'none',
        }}
      >
        <div ref={thumbRef} style={{
          position: 'absolute', left: '50%', top: '50%', width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(255,255,255,0.35)', transform: 'translate(-50%, -50%)',
        }} />
      </div>

      {/* Shoot (large, bottom-right) */}
      <div
        {...hold((v) => { controls.shoot = v })}
        style={{
          ...actionBtn, position: 'absolute', right: 32, bottom: 40, width: 96, height: 96,
          fontSize: 16, background: 'rgba(255,80,40,0.35)', border: '2px solid rgba(255,120,80,0.7)',
        }}
      >FIRE</div>

      {/* Jump (above-left of fire) */}
      <div {...hold((v) => { controls.jump = v })}
        style={{ ...actionBtn, position: 'absolute', right: 140, bottom: 56 }}>JUMP</div>

      {/* Right-side action column */}
      <div style={{
        position: 'absolute', right: 32, bottom: 150, display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={actionBtn} onTouchStart={tap(onReload)}>RELOAD</div>
        <div style={actionBtn} onTouchStart={tap(onCycleWeapon)}>WEAP</div>
        <div style={actionBtn} onTouchStart={tap(onToggleStore)}>BUY</div>
      </div>

      {/* Scoreboard toggle (top-right) */}
      <div style={{ ...actionBtn, position: 'absolute', right: 24, top: 24, width: 64, height: 40, borderRadius: 10 }}
        onTouchStart={tap(onToggleScoreboard)}>TAB</div>
    </div>
  )
}
