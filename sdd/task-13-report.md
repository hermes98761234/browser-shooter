**Status**: success
**Summary**: Added grenade sound effects to SoundEffects class with supporting AudioManager types.

## Deliverable

Added three grenade sound methods to `SoundEffects` class:

- `playGrenadeThrow(position?)` - plays weapon_reload sound
- `playGrenadeBounce(position)` - plays bullet_impact sound at low volume
- `playGrenadeDetonate(type, position)` - plays different sounds based on grenade type:
  - HE: enemy_death at 1.5 volume
  - Flash: weapon_fire at 0.8 volume
  - Smoke: weapon_reload at 0.5 volume

Also added three new sound names to `AudioManager.SoundName` type and corresponding file mappings: `weapon_reload`, `bullet_impact`, `weapon_fire`.

**Files touched**: src/audio/SoundEffects.ts, src/audio/AudioManager.ts
**Findings worth promoting**:
- AudioManager requires explicit SoundName type entries for any new sounds - must be added to both the type union and the soundFiles record
- Existing codebase uses positional audio via `{ x, y, z }` objects, not THREE.Vector3 directly