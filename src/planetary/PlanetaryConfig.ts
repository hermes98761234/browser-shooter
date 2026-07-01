export const PLANETARY_CONFIG = {
  // Must match scene.fog far in PlanetaryEngine — collision culls at the same
  // distance as rendering, otherwise buildings can block movement after they
  // stop being drawn.
  fogFar: 600,
  post: {
    defaultPreset: 'medium' as 'low' | 'medium' | 'high',
    bloomThreshold: 1.0,
    bloomIntensity: 0.5,
  },
  building: {
    minHeight: 3,
    wallColor: 0xc8b89d,   // warm beige fallback
    roofColor: 0x8b4513,   // terracotta fallback
  },
}
