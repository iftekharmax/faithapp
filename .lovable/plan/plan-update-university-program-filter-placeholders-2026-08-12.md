# Plan: Update University Program Filter Placeholders

Update the placeholders in the university programs filter bar to be more inclusive and professional, using "All [Category]" instead of just "[Category]".

## Proposed Changes

### University Details Page
- Modify `src/routes/_authenticated.universities.$universityId.index.tsx`:
    - Update `FilterDropdown` placeholders:
        - "Campuses" -> "All Campuses"
        - "Degrees" -> "All Degrees"
        - "Intakes" -> "All Intakes"
        - "Scholarships" -> "All Scholarships"

## User Review Required

> [!IMPORTANT]
> This change only affects the visual placeholders/labels in the filter dropdowns to match the requested Banglish/English specification.

- Does "All [Category]" meet your expectations for all four filter types?
