# Plan: Rollback Program Card Visual Changes

The user requested a rollback of the previous changes:
1. Program card background was changed to white (`bg-white`).
2. Action icon was changed from `MoreHorizontal` to `MoreVertical`.

I will revert these to their previous states as per the user's "ata rollback koro" (rollback this) request.

## Proposed Changes

### University Details & Programs Page
- Update `src/routes/_authenticated.universities.$universityId.index.tsx`:
    - Revert the program card background from `bg-white` back to `bg-[#F9FAFB]`.
    - Revert the border from `border-slate-100` back to `border-slate-50`.
    - Revert the action icon from `MoreVertical` back to `MoreHorizontal`.

## Technical Details
- Edit `ProgramsTab` in `src/routes/_authenticated.universities.$universityId.index.tsx`.
- Change `bg-white border border-slate-100` back to `bg-[#F9FAFB] border border-slate-50`.
- Change `<MoreVertical ... />` back to `<MoreHorizontal ... />`.

## Validation Plan
- Verify the cards have the light gray background and the horizontal dots icon again.
