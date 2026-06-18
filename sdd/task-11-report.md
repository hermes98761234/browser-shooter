**Status**: success
**Summary**: Added grenade inventory display (HE, Flash, Smoke) to the HUD with selection highlighting.

Added `grenadeInventory` and `selectedGrenade` optional props to HUDProps interface. Added a new grenade display section positioned above the ammo display (bottom-right, 80px from bottom) that shows each grenade type with quantity and keybind hint (4/5/6). Selected grenade gets a highlighted background/border, unselected grenades show semi-transparent dark background.

**Files touched**: src/ui/HUD.tsx
**Findings worth promoting**: (none)
