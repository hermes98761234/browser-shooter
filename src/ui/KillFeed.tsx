import React from 'react'
import type { HitZone } from '../systems/DamageZones'

export interface KillLine { id: number; attacker: string; victim: string; teamkill: boolean; zone: HitZone }

// The hit model only has three height bands; 'body' reads as "torso" in the feed.
// ponytail: no separate "arms" zone exists in the capsule model, so it isn't shown.
const ZONE_LABEL: Record<HitZone, string> = { head: 'head', body: 'torso', legs: 'legs' }

export const KillFeed: React.FC<{ lines: KillLine[] }> = ({ lines }) => (
  <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', flexDirection: 'column',
    gap: 4, fontFamily: 'monospace', fontSize: 14, zIndex: 55, pointerEvents: 'none' }}>
    {lines.map(l => (
      <div key={l.id} style={{ background: 'rgba(0,0,0,0.5)', padding: '3px 8px', color: l.teamkill ? '#ff5544' : '#fff' }}>
        {l.attacker} <span style={{ opacity: 0.6 }}>{l.teamkill ? '[TK] ✖' : '✖'}</span> {l.victim} <span style={{ opacity: 0.6 }}>({ZONE_LABEL[l.zone]})</span>
      </div>
    ))}
  </div>
)
