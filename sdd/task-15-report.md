**Status**: success
**Summary**: Added grenade selector buttons (HE, Flash, Smoke) to TouchControls component with active state highlighting.

**Deliverable**:
Added a grenade selector section to the touch controls UI with three buttons:
- HE button (key 4)
- Flash button (key 5)
- Smoke button (key 6)

Each button:
- Calls `onSelectGrenade` with the appropriate grenade type
- Has visual styling matching existing touch controls
- Shows selection highlight (yellow) when active via `activeGrenade` prop

The component now accepts two new props:
- `onSelectGrenade: (type: GrenadeType) => void` - callback when grenade is selected
- `activeGrenade?: GrenadeType | null` - currently selected grenade for visual feedback

**Files touched**: src/ui/TouchControls.tsx
**Findings worth promoting**: (none)
