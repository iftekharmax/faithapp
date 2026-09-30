---
title: Reapply program card and action icon styling
description: Restores the enterprise SaaS design for program cards and action icons in the university details page to match the premium screenshot provided by the user.
---

# Plan - Reapply program card and action icon styling

The user wants to re-apply the styling for program cards and the action icon (making it a vertical dot icon) to match the enterprise screenshot 100%. A previous turn rolled these changes back, and now the user wants them back.

## User Preferences & Constraints
- **Styling**: Premium enterprise SaaS design, "same to same" match with the screenshot.
- **Card**: White background, `rounded-[32px]`, `p-10` padding, specific fee grid typography (800 font weight).
- **Actions**: Vertical `MoreVertical` dot icon instead of horizontal.

## Proposed Changes

### Frontend - University Details Page
- Modify `src/routes/_authenticated.universities.$universityId.index.tsx`:
    - Update the program card container to use `bg-white` instead of `bg-[#F9FAFB]` by default.
    - Change `MoreHorizontal` icon to `MoreVertical`.
    - Ensure the button containing the vertical dots matches the screenshot's height and rounding.
    - Verify typography weights for Tuition, Scholarship, and App. Fee match the requested high-fidelity look.

## Verification Plan

### Automated Checks
- Run a build check to ensure no TypeScript errors were introduced.
- Verify file content matches the intended design.

### Manual Verification
- View the university details page in the preview.
- Confirm program cards have a white background and elevated shadow/border on hover.
- Confirm the action button uses a vertical dot icon.
