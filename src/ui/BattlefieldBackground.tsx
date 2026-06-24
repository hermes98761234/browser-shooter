import React from 'react'
import './battlefield-bg.css'

// CSS custom property values don't match React.CSSProperties types, so we extend here
type BfStyle = React.CSSProperties & Record<string, unknown>

export const BattlefieldBackground: React.FC = () => (
  <div className="bf-root" aria-hidden="true">
    {/* Fog layers */}
    <div className="bf-fog bf-fog-1" />
    <div className="bf-fog bf-fog-2" />
    <div className="bf-fog bf-fog-3" />

    {/* Scrolling combat grid */}
    <div className="bf-grid" />

    {/* Horizon glow */}
    <div className="bf-horizon" />

    {/* Helicopter flyby */}
    <div className="bf-heli">
      <div className="bf-heli-rotor" />
      <div className="bf-heli-body" />
      <div className="bf-heli-tail" />
    </div>

    {/* Soldiers L→R */}
    <div className="bf-soldier" style={{ '--bf-spd': '9s',  '--bf-delay': '0s', '--bf-legspd': '0.25s', opacity: 0.5,  transform: 'scale(0.7)'  } as BfStyle}>
      <div className="bf-soldier-body" /><div className="bf-soldier-head" /><div className="bf-soldier-gun" />
      <div className="bf-soldier-leg-l" /><div className="bf-soldier-leg-r" />
    </div>
    <div className="bf-soldier" style={{ '--bf-spd': '12s', '--bf-delay': '3s', '--bf-legspd': '0.28s', opacity: 0.7,  transform: 'scale(0.85)' } as BfStyle}>
      <div className="bf-soldier-body" /><div className="bf-soldier-head" /><div className="bf-soldier-gun" />
      <div className="bf-soldier-leg-l" /><div className="bf-soldier-leg-r" />
    </div>
    <div className="bf-soldier" style={{ '--bf-spd': '7s',  '--bf-delay': '6s', '--bf-legspd': '0.22s', opacity: 0.9 } as BfStyle}>
      <div className="bf-soldier-body" /><div className="bf-soldier-head" /><div className="bf-soldier-gun" />
      <div className="bf-soldier-leg-l" /><div className="bf-soldier-leg-r" />
    </div>
    <div className="bf-soldier" style={{ '--bf-spd': '15s', '--bf-delay': '1s', '--bf-legspd': '0.30s', opacity: 0.4,  transform: 'scale(0.6)'  } as BfStyle}>
      <div className="bf-soldier-body" /><div className="bf-soldier-head" /><div className="bf-soldier-gun" />
      <div className="bf-soldier-leg-l" /><div className="bf-soldier-leg-r" />
    </div>

    {/* Soldiers R→L (scaleX(-1) flips direction; --bf-anim overrides animation) */}
    <div className="bf-soldier" style={{ '--bf-anim': 'bf-soldier-rtl', '--bf-spd': '11s', '--bf-delay': '4s', '--bf-legspd': '0.27s', opacity: 0.6, transform: 'scaleX(-1) scale(0.8)' } as BfStyle}>
      <div className="bf-soldier-body" /><div className="bf-soldier-head" /><div className="bf-soldier-gun" />
      <div className="bf-soldier-leg-l" /><div className="bf-soldier-leg-r" />
    </div>
    <div className="bf-soldier" style={{ '--bf-anim': 'bf-soldier-rtl', '--bf-spd': '8s',  '--bf-delay': '9s', '--bf-legspd': '0.23s', opacity: 0.85, transform: 'scaleX(-1)' } as BfStyle}>
      <div className="bf-soldier-body" /><div className="bf-soldier-head" /><div className="bf-soldier-gun" />
      <div className="bf-soldier-leg-l" /><div className="bf-soldier-leg-r" />
    </div>

    {/* Bullet tracers L→R */}
    <div className="bf-tracer bf-tracer-ltr-grad" style={{ '--bf-spd': '0.40s', '--bf-delay': '2.0s', '--bf-y': '72%' } as BfStyle} />
    <div className="bf-tracer bf-tracer-ltr-grad" style={{ '--bf-spd': '0.35s', '--bf-delay': '5.5s', '--bf-y': '58%' } as BfStyle} />
    <div className="bf-tracer bf-tracer-ltr-grad" style={{ '--bf-spd': '0.45s', '--bf-delay': '8.0s', '--bf-y': '65%' } as BfStyle} />
    {/* Bullet tracers R→L */}
    <div className="bf-tracer bf-tracer-rtl-grad bf-tracer-rtl" style={{ '--bf-anim': 'bf-tracer-rtl', '--bf-spd': '0.38s', '--bf-delay': '3.2s', '--bf-y': '68%' } as BfStyle} />
    <div className="bf-tracer bf-tracer-rtl-grad bf-tracer-rtl" style={{ '--bf-anim': 'bf-tracer-rtl', '--bf-spd': '0.42s', '--bf-delay': '7.0s', '--bf-y': '75%' } as BfStyle} />

    {/* Muzzle flashes */}
    <div className="bf-muzzle" style={{ '--bf-period': '3.0s', '--bf-delay': '0.5s', '--bf-x': '12%', '--bf-bottom': '30px' } as BfStyle} />
    <div className="bf-muzzle" style={{ '--bf-period': '2.5s', '--bf-delay': '1.8s', '--bf-x': '70%', '--bf-bottom': '35px' } as BfStyle} />
    <div className="bf-muzzle" style={{ '--bf-period': '4.0s', '--bf-delay': '3.0s', '--bf-x': '40%', '--bf-bottom': '28px' } as BfStyle} />
    <div className="bf-muzzle" style={{ '--bf-period': '3.5s', '--bf-delay': '0.2s', '--bf-x': '85%', '--bf-bottom': '32px' } as BfStyle} />
    <div className="bf-muzzle" style={{ '--bf-period': '2.8s', '--bf-delay': '2.3s', '--bf-x': '25%', '--bf-bottom': '26px' } as BfStyle} />

    {/* Explosions */}
    <div className="bf-explosion" style={{ '--bf-period': '8s',  '--bf-delay': '0s', '--bf-x': '20%', '--bf-bottom': '40px' } as BfStyle} />
    <div className="bf-explosion" style={{ '--bf-period': '11s', '--bf-delay': '4s', '--bf-x': '65%', '--bf-bottom': '35px' } as BfStyle} />
    <div className="bf-explosion" style={{ '--bf-period': '9s',  '--bf-delay': '7s', '--bf-x': '45%', '--bf-bottom': '50px' } as BfStyle} />

    {/* Smoke puffs */}
    <div className="bf-smoke" style={{ '--bf-spd': '4.0s', '--bf-delay': '0.0s', '--bf-x': '20%', '--bf-bottom': '40px' } as BfStyle} />
    <div className="bf-smoke" style={{ '--bf-spd': '5.0s', '--bf-delay': '1.5s', '--bf-x': '65%', '--bf-bottom': '35px' } as BfStyle} />
    <div className="bf-smoke" style={{ '--bf-spd': '3.5s', '--bf-delay': '3.0s', '--bf-x': '45%', '--bf-bottom': '50px' } as BfStyle} />
    <div className="bf-smoke" style={{ '--bf-spd': '4.5s', '--bf-delay': '0.8s', '--bf-x': '30%', '--bf-bottom': '30px' } as BfStyle} />
    <div className="bf-smoke" style={{ '--bf-spd': '6.0s', '--bf-delay': '2.5s', '--bf-x': '75%', '--bf-bottom': '45px' } as BfStyle} />

    {/* Screen overlays */}
    <div className="bf-scanlines" />
    <div className="bf-vignette" />
  </div>
)
