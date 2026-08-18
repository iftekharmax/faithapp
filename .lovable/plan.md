# Plan: Update Programs Pagination

Change the default items per page for the programs list from 9 to 18 to align with the new requirement.

## Steps
1. Open `src/routes/_authenticated.universities.$universityId.index.tsx`.
2. Locate the default state for `itemsPerPage` or the constant used for pagination calculation.
3. Update the value from 9 to 18.
4. Verify that the pagination logic (`totalPages` calculation, slice range) correctly reflects the new value.
