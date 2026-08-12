# Plan: Program Card and Intake UI Refinement

The user wants to reduce the spacing between program cards and ensure that the "Next Intake" list displays in a single line within each card.

## Proposed Changes

### Frontend - `src/routes/_authenticated.universities.$universityId.index.tsx`

1.  **Reduce Grid Gap**:
    *   Change the grid gap in the `ProgramsTab` component from `gap-10` to `gap-6` to make the card list more compact.
2.  **Ensure Single Line Intake**:
    *   Modify the container for "Next Intake" chips to prevent wrapping by adding `flex-nowrap` and `overflow-x-auto` (with hidden scrollbar if needed).
    *   Adjust the padding or margins of the intake chips to fit more comfortably in a single line.

## Technical Details

- **File**: `src/routes/_authenticated.universities.$universityId.index.tsx`
- **Line 663**: Change `<div className="grid gap-10 md:grid-cols-2 xl:grid-cols-3 px-12">` to `<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 px-12">`.
- **Line 735**: Change `<div className="flex flex-wrap gap-3">` to `<div className="flex flex-nowrap gap-2 overflow-x-auto scrollbar-none">`.
- **Line 737**: Reduce chip padding from `px-6 py-3` to `px-4 py-2` and font size if necessary to ensure they fit well without taking too much vertical space or forcing horizontal scrolling too early.

## Verification Plan

- **Visual Inspection**: Check the university details page to confirm the grid gap is smaller.
- **Intake Layout**: Verify that intakes for programs with multiple dates (e.g., "January, April, August") are displayed in a single horizontal row without wrapping.
- **Responsiveness**: Ensure the grid and single-line intakes still look good on different screen sizes.
