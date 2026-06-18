# Task 6: Integrate BuyPreview into BuyMenu

**Status:** DONE
**Commit:** ba076f5 - feat: integrate BuyPreview into BuyMenu with hover preview panel

## What was done

Integrated the `BuyPreview` 3D component into the `BuyMenu` UI, creating a two-panel layout where hovering over an item shows its 3D preview on the right side.

## Changes

### `src/ui/BuyMenu.tsx`
- Added imports for `BuyPreview` and `StoreItem` type
- Added `selectedItem` state to track hovered item
- Wrapped item grid in flex container with preview panel on the right
- Added `onMouseEnter` handlers to item buttons to update selected item
- Preview panel shows 220px wide with left border separator

### `src/ui/__tests__/BuyMenu.test.tsx`
- Added mock for `BuyPreview` component to avoid WebGL in tests
- Added `buy preview` test suite with two tests:
  - Verifies "Select an item" text shown before hover
  - Verifies "Select an item" hidden after hover

## Test Results
- 9/9 tests passing
- TypeScript compilation clean
