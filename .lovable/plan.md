# Plan: Update Program Card Background and Action Icons

The user requested changing the program card background to white and modifying the action dot icon. Based on the previous context (which mentioned "dot icon vertical hobe"), I will update the program card to match the premium screenshot design more closely by ensuring the card background is white and the more/options icon is vertical if needed, but the primary request is "card bg white hobe".

## Proposed Changes

### University Details & Programs Page
- Update the program card container in `src/routes/_authenticated.universities.$universityId.index.tsx` to use a white background (`bg-white`) by default instead of the current light gray (`bg-[#F9FAFB]`).
- Ensure the hover state and border styles remain consistent with the premium enterprise SaaS design.
- Verify the action button (dots) styling matches the "vertical" preference if applicable, although the latest message focuses on the white background.

## Technical Details
- Modify the `ProgramsTab` component's mapped program cards.
- Change `bg-[#F9FAFB]` to `bg-white` on the card container.
- Adjust `group-hover` styles if necessary to maintain visibility of the card against the page background.

## Validation Plan
- Inspect the live preview to confirm program cards now have a white background.
- Verify the layout remains responsive and professional.
