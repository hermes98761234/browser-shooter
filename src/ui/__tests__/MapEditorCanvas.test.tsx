import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import React, { createRef } from 'react'
import type { TopSnapRef } from '../MapEditorCanvas'

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div data-testid="r3f-canvas">{children}</div>,
  useThree: () => ({ camera: { position: { set: vi.fn() }, lookAt: vi.fn() } }),
  useFrame: vi.fn(),
}))
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  Grid: () => null,
}))

import { MapEditorCanvas } from '../MapEditorCanvas'
import { DAYLIGHT } from '../../zones/ZoneDef'
import type { ZoneDef } from '../../zones/ZoneDef'

const zone: ZoneDef = {
  id: 'z1', name: 'Test', description: '', arenaSize: 20, floorColor: 0x444444,
  lighting: DAYLIGHT, structures: [], ctSpawns: [[0, -10]], tSpawns: [[0, 10]],
  bombsites: [{ id: 'A', center: [10, 0] }, { id: 'B', center: [-10, 0] }],
}

describe('MapEditorCanvas', () => {
  it('renders without crashing', () => {
    const ref = createRef<TopSnapRef>()
    const { getByTestId } = render(
      <MapEditorCanvas
        zone={zone} tool="wall" selectedIdx={null}
        topSnapRef={{ current: null }}
        onPlaceStructure={vi.fn()} onPlaceSpawn={vi.fn()} onMoveBombsite={vi.fn()}
        onSelectStructure={vi.fn()} onDeleteStructure={vi.fn()} onDeleteSpawn={vi.fn()}
      />
    )
    expect(getByTestId('r3f-canvas')).toBeTruthy()
  })
})
