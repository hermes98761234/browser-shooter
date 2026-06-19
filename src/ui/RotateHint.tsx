import React, { useEffect, useState } from 'react'

interface RotateHintProps {
  /** Only shown when enabled (typically: touch controls active during play). */
  enabled: boolean
}

function isPortrait(): boolean {
  return typeof window !== 'undefined' && window.innerHeight > window.innerWidth
}

/**
 * Full-screen overlay nudging mobile players to hold their device in landscape,
 * which a first-person shooter strongly prefers. Non-blocking: it appears only
 * while the viewport is portrait and disappears automatically on rotation.
 */
export const RotateHint: React.FC<RotateHintProps> = ({ enabled }) => {
  const [portrait, setPortrait] = useState(isPortrait)

  useEffect(() => {
    const update = () => setPortrait(isPortrait())
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    update()
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  if (!enabled || !portrait) return null

  return (
    <div
      role="dialog"
      aria-label="rotate device to landscape"
      style={{
        position: 'absolute', inset: 0, zIndex: 90,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 20, padding: 24, textAlign: 'center',
        background: 'rgba(8,8,16,0.92)', color: '#fff', fontFamily: 'monospace',
      }}
    >
      <div
        aria-hidden
        style={{ fontSize: 56, animation: 'none', transform: 'rotate(90deg)', lineHeight: 1 }}
      >
        📱
      </div>
      <div style={{ fontSize: 'clamp(18px, 6vw, 24px)', fontWeight: 'bold', color: '#ff6600' }}>
        ROTATE YOUR DEVICE
      </div>
      <div style={{ fontSize: 'clamp(13px, 4vw, 16px)', opacity: 0.8, maxWidth: 320 }}>
        Turn your phone sideways for the best aiming and controls.
      </div>
    </div>
  )
}
