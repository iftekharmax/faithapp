# Plan - Adjust Font Weight to 500

The user wants to change the font weight of the cards (and likely general text that was previously set to `font-black`) to `500` (which corresponds to `font-medium` in Tailwind CSS). In the previous step, a lot of text was set to `font-black` (900) to achieve a premium look, but it seems it became too heavy.

## Proposed Changes

### 1. Update University Details Page
- Search and replace `font-black` with `font-medium` in `src/routes/_authenticated.universities.$universityId.index.tsx`.
- Review the occurrences to ensure specific headings that *should* remain bold (like the main H1) are adjusted appropriately (perhaps to `font-bold` or `font-semibold` if `font-medium` is too light for main titles, but the instruction says "cards er front weight 500 hobe", which specifically targets the weight).
- Based on "cards er front weight 500 hobe", I will specifically target the card content and titles that were previously bumped to 900.

## Technical Details
- **Tailwind class change**: `font-black` (900) -> `font-medium` (500).
- **Target file**: `src/routes/_authenticated.universities.$universityId.index.tsx`.

## Verification Plan
- Inspect the UI in the preview to ensure the font weight is visibly reduced to a medium weight.
- Check that the layout remains consistent and readable with the lighter weight.
