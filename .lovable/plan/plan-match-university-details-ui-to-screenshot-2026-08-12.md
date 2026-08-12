# Plan - Match University Details UI to Screenshot

The goal is to update `src/routes/_authenticated.universities.$universityId.index.tsx` to 100% match the provided screenshot (`a01b2466-0d1c-4236-9535-461418272bfc.png`).

## Proposed Changes

### University Header (Hero Section)
- Adjust paddings and margins to match the screenshot's airy feel.
- Ensure the "ACTIVE" badge is correctly styled (pill shape, high contrast blue).
- Fix "MY Malaysia" and "Negeri Sembilan" layout with exact icons and spacing.
- Ensure "Website" link has the external link icon properly positioned.
- Match the "4 CAMPUSES" and "155 PROGRAMS" boxes precisely (background, border, typography).

### Tabs Navigation
- Match the tab borders and active state color (Blue-600).
- Ensure the spacing between tabs matches the screenshot.

### Programs Toolbar & Filters
- Refine the Search input height and border radius.
- Implement the exactly aligned buttons: "Export programs", "Import programs", "Template", and "+ Add program".
- Update the filter dropdowns ("All Faculties", "All Campuses", etc.) to have the subtle border and font weight (500) as requested.
- Ensure the grid/list view toggle buttons match the screenshot.

### Program Cards
- **Header**: Featured/Active badges at the top left. Heart icon at top right.
- **Title Section**: Logo/Icon on the left, Title and University name on the right.
- **Info Grid**: "Bachelor's Degree", "3 Years...", "Subang Campus" with specific blue icons.
- **Fee Grid**: Tuition, Scholarship, and App. Fee in a 3-column layout with specific font weights (700/black).
- **Intake Badges**: Light blue badges for months (January, April, August).
- **Footer Stats**: Applications, Acceptance, Visa Success with small icons and bold numbers.
- **Actions**: "Create Application" (Primary Blue), "View Details" (Outline), and "..." (MoreHorizontal) button.

### Miscellaneous
- Add the "Load More Programs" button at the bottom as shown.
- Ensure the floating blue chat/help button is present (it seems to be in the bottom right of the screenshot).

## Technical Details
- Using `lucide-react` for all icons.
- Using `tailwind-merge` and `clsx` for dynamic classes.
- Framer Motion for any transition effects if applicable.
- Shadcn UI components as the base, customized with specific Tailwind classes to match the 100% design requirement.

## Verification Plan
- Visually compare the preview with the screenshot side-by-side.
- Check responsiveness (mobile view should switch to a single column or scrollable tabs).
- Verify that search and filters still function correctly after styling changes.
