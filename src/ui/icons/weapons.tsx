import React from 'react'

interface IconProps {
  name: string
  size?: number
}

const icons: Record<string, React.FC<{ size: number }>> = {
  pistol: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M8 28h32v8H8z M36 28h12l8 8v4h-8V28z M12 36h20v4H12z M16 40h12v8H16z"/>
    </svg>
  ),
  usp: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M10 26h30v6H10z M38 26h10l6 6v4h-8V26z M14 32h22v4H14z M18 36h10v8H18z"/>
    </svg>
  ),
  glock: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M8 28h28v6H8z M34 28h14l6 6v4h-10V28z M12 34h20v4H12z M16 38h12v8H16z"/>
    </svg>
  ),
  deagle: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M6 24h36v10H6z M40 24h14l8 10v4h-12V24z M10 34h28v4H10z M14 38h16v10H14z"/>
    </svg>
  ),
  m4: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M4 26h48v6H4z M4 32h20v4H4z M40 32h16v4H40z M24 32h12v8H24z M8 36h12v8H8z"/>
    </svg>
  ),
  aug: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M4 24h50v6H4z M4 30h22v4H4z M42 30h14v4H42z M24 30h14v10H24z M8 34h10v8H8z"/>
    </svg>
  ),
  ak: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M4 26h48v6H4z M4 32h18v4H4z M38 32h18v4H38z M20 32h14v10H20z M8 36h8v8H8z"/>
    </svg>
  ),
  galil: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M4 26h46v6H4z M4 32h20v4H4z M40 32h16v4H40z M22 32h14v10H22z M8 36h10v8H8z"/>
    </svg>
  ),
  mp5: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M8 28h32v6H8z M38 28h12l6 6v4H44V28z M12 34h24v4H12z M16 38h14v8H16z"/>
    </svg>
  ),
  shotgun: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M4 24h52v4H4z M4 28h24v4H4z M44 28h16v4H44z M26 28h14v12H26z M8 32h14v8H8z"/>
    </svg>
  ),
  awp: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M2 26h56v4H2z M2 30h26v4H2z M46 30h16v4H46z M26 30l4 14h8l4-14z M6 34h16v6H6z"/>
    </svg>
  ),
  kevlar: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M16 12h32v40H16z M20 16h24v32H20z M28 20h8v8h-8z"/>
    </svg>
  ),
  kevlar_helmet: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M16 8h32v24H16z M20 32h24v8H20z M28 40h8v12h-8z M24 16h16v4H24z"/>
    </svg>
  ),
  medkit: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M16 16h32v32H16z M28 20h8v24h-8z M20 28h24v8H20z"/>
    </svg>
  ),
  boots: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M16 12h12v36H16z M36 12h12v28H36z M12 48h40v8H12z"/>
    </svg>
  ),
  heavy_armor: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M14 6h36v22H14z M18 28h28v8H18z M28 36h8v16h-8z M22 12h20v4H22z M22 18h20v4H22z"/>
    </svg>
  ),
  he_grenade: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M28 8h8v6h-8z M30 14h4l6 6v4H24v-4z M20 24h24v24a12 12 0 0 1-24 0z M40 10h10v4H40z"/>
    </svg>
  ),
  flashbang: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M28 8h8v8h-8z M22 16h20v8H22z M24 24h16v24a8 8 0 0 1-16 0z M40 10h8v4h-8z"/>
    </svg>
  ),
  smoke_grenade: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M27 8h10v6H27z M24 14h16v6H24z M22 20h20v22a10 10 0 0 1-20 0z M40 10h9v4h-9z"/>
    </svg>
  ),
  bomb: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M12 20h40v24H12z M16 24h32v4H16z M20 32h10v6H20z M34 32h10v6H34z M24 12h16v8H24z"/>
    </svg>
  ),
  defuse_kit: ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor">
      <path d="M16 8l10 18-6 4-10-18z M48 8l-10 18 6 4 10-18z M24 28h16v6H24z M26 34h12v22H26z"/>
    </svg>
  ),
}

export const WeaponIcon: React.FC<IconProps> = ({ name, size = 64 }) => {
  const IconComponent = icons[name]
  if (!IconComponent) return <div style={{ width: size, height: size, background: '#333' }} />
  return <IconComponent size={size} />
}
