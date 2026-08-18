# Plan: Redesign Program Details Page

Enhance the Program Details page (`src/routes/_authenticated.universities.$universityId.programs.$programId/index.tsx`) to be more attractive, professional, and user-friendly, following the premium SaaS aesthetic established in the university details page.

## Proposed Improvements

### 1. Enhanced Hero Section
- Use a larger, more prominent layout for the program name and degree.
- Integrate the university logo (if available) next to the program name.
- Improve the visual weight of the status badge.
- Add a "Quick Actions" bar within or below the hero (e.g., Apply Now, Share, Download Brochure).

### 2. High-Impact Stats Bar
- Replace the existing `InfoRow` grid with a more distinctive "Quick Facts" section.
- Use larger icons and bolder typography.
- Add descriptive tooltips or labels where necessary.

### 3. Visual Fee Breakdown & Summary
- Redesign the fee cards to be more modern, perhaps using a single card with an itemized list and a prominent total.
- Use a clearer visual distinction for the "Total Fee".
- Add a "Currency Converter" toggle if multiple currencies are common.

### 4. Structured Content Sections
- Use distinct, well-spaced cards for Intakes, Requirements, Scholarships, and Descriptions.
- Implement better typography for rich text content (using Tailwind Typography `prose` classes more effectively).
- Add specific icons for each section to aid visual scanning.

### 5. Sticky Navigation / Actions
- Implement a sticky sidebar or header for quick access to "Apply Now" and "Edit/Delete" actions as the user scrolls through long descriptions.

## Technical Tasks
- Update `src/routes/_authenticated.universities.$universityId.programs.$programId/index.tsx`.
- Use `framer-motion` for smooth entry animations.
- Ensure full responsiveness for mobile devices.
- Refine `RichSection` and `FeeCard` components for better visual hierarchy.

