# Plan: University List Toolbar and Navigation Refinement

The goal is to update the Universities list toolbar to include explicit "Export", "Import", and "Template" buttons and reposition the "Countries" link to declutter the secondary toolbar.

## User Review Required

> [!IMPORTANT]
> - The "Countries" link will be moved from the secondary toolbar to the main header area (beside "New University") to keep the data actions (Export/Import) grouped together.
> - The buttons will be styled to match the existing premium enterprise SaaS aesthetic.

## Proposed Changes

### 1. `src/components/universities/CsvToolbar.tsx`
- Refactor the component to display three distinct buttons: **Export**, **Import**, and **Template**.
- Remove the current "Export [label]" / "Import [label]" text if it feels cluttered, replacing it with the direct user-requested labels.
- Ensure the "Template" button is consistent in style with the others.

### 2. `src/routes/_authenticated.universities.index.tsx`
- Remove the `Countries` link from the `CsvToolbar` wrapper area.
- Add the `Countries` link to the main header section, next to the "New University" button.
- Clean up the toolbar container spacing now that the "Countries" link is moved.

## Technical Details
- Using `Button` variants (`outline` for Export/Import/Template) to maintain visual hierarchy.
- Repositioning the `Link` to `/countries` using the same `rounded-xl` and `h-11` styling as the "New University" button for consistency in the primary action area.

## Verification Plan
- [ ] Check the Universities page preview to see Export, Import, and Template buttons.
- [ ] Verify the Countries button is now in the header area.
- [ ] Test the functionality of each button (Export, Import modal, Template download).
