import React from 'react'
import type { FlashEffectState } from '../effects/FlashEffect'

interface FlashOverlayProps {
  flash: FlashEffectState | null
}

/** Full-screen white blind from a flashbang detonating in the local player's view. */
export const FlashOverlay: React.FC<FlashOverlayProps> = ({ flash }) => {
  if (!flash || !flash.active) return null

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      background: '#ffffff',
      opacity: flash.opacity,
      zIndex: 12,
    }} />
  )
}
