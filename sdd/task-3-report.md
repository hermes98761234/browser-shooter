**Status**: success
**Summary**: Created Grenade class with physics simulation and unit tests, all 6 tests passing.

The Grenade class implements:
- Type-based grenade instantiation (HE, Flashbang, Smoke)
- Physics simulation: gravity, velocity integration, ground bouncing with restitution
- Fuse timer countdown and expiration detection
- Bounce limiting with max bounce count
- Settled state when grenade stops moving
- Mesh lifecycle management with dispose method

**Files touched**: src/weapons/Grenade.ts, src/weapons/__tests__/Grenade.test.ts
**Findings worth promoting**: (none)