---
name: Modern Program Pagination
description: Replace "Load More" with professional pagination in the university details program list.
type: feature
---

## Changes

### Frontend

- **University Details Page (`src/routes/_authenticated.universities.$universityId.index.tsx`)**:
  - Replace the current manual "Load More" logic with a professional pagination component.
  - Implement dynamic page calculation based on the `filtered` results and `itemsPerPage`.
  - Add a styled pagination footer with "Previous", page numbers, and "Next" buttons.
  - Ensure the scroll position resets or smooth-scrolls to the top of the program list when the page changes.
  - Update the `ProgramsTab` state to handle page transitions smoothly.

## Technical details

- **State Management**: Update the `page` state logic to support absolute page selection instead of incremental expansion.
- **UI Components**: Use existing `Button` variants and Tailwind CSS for a professional pagination look matching the enterprise SaaS aesthetic.
- **Logic**: 
  - `const totalPages = Math.ceil(filtered.length / itemsPerPage);`
  - `const displayed = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);`
  - Render page buttons `[1, 2, 3, ..., N]` based on current position for better UX.

## User review required

> [!IMPORTANT]
> The pagination will replace the "Load More" button. Do you have a preference for how many programs should be visible per page (currently 9)?
