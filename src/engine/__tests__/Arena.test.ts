import { describe, it, expect, vi } from 'vitest'
import * as THREE from 'three'
import { createArena } from '../Arena'

// Mock WebGLRenderer to avoid needing a real GL context
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof THREE>('three')
  return {
    ...actual,
    WebGLRenderer: vi.fn().mockImplementation(() => ({
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      render: vi.fn(),
      shadowMap: { enabled: false, type: 0 },
      domElement: document.createElement('canvas'),
    })),
  }
})

describe('createArena', () => {
  it('creates bombsite markers', () => {
    const scene = new THREE.Scene()
    createArena(scene)
    
    // Count total children in scene (floor, walls, crates, lights, bombsite markers)
    const initialChildCount = scene.children.length
    
    // The arena should add at least 2 additional meshes for bombsite markers
    // We can check that the scene has children and that the function doesn't throw
    expect(initialChildCount).toBeGreaterThan(0)
    
    // More specific: check that we have ring geometries for bombsite markers
    const ringGeometries = scene.children.filter(child => {
      if (child instanceof THREE.Mesh) {
        return child.geometry instanceof THREE.RingGeometry
      }
      return false
    })
    
    // Should have exactly 2 ring geometries for bombsite markers
    expect(ringGeometries).toHaveLength(2)
  })
})