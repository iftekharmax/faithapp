# Plan - Redesign University Details Page

The goal is to redesign the University Details / Programs page to closely match the provided enterprise SaaS screenshot, focusing on visual structure, spacing, and modern styling while preserving all existing functionality.

## Technical Details

- **File to Edit**: `src/routes/_authenticated.universities.$universityId.index.tsx`
- **Design Principles**:
    - **Hero Section**: Implement a large, premium hero card (380-420px height) with the university logo in a shadow container, large bold typography for the name, and a campus background image on the right with a soft white-to-transparent gradient fade.
    - **Typography**: Use dark navy (`text-slate-900`) for headers, bold weights (700-800) for primary titles, and muted gray (`text-slate-400/500`) for metadata.
    - **Layout**: 
        - Top header with breadcrumbs and user profile.
        - "Back to Universities" link with a clean icon.
        - Unified white card containers with `rounded-[24px]` or `rounded-[32px]`.
        - Responsive 3-column grid for program cards.
    - **Navigation**: Clean underline-style tabs for "Programs", "Campuses", and "Applications" with item counts in bubbles.
    - **Program Cards**:
        - White background, soft shadows, rounded corners.
        - "Featured" and "Active" badges at the top.
        - Fee breakdown in a subtle grid (Tuition, Scholarship, Application Fee).
        - Horizontal intake chips.
        - "Apply Now" and "Details" buttons at the bottom.
    - **Spacing**: Generous padding and gaps to create a spacious, enterprise-grade feel.

## Proposed Changes

### `src/routes/_authenticated.universities.$universityId.index.tsx`

#### 1. Header & Breadcrumbs
- Update the top navigation area to match the "☰ > Universities > ID" breadcrumb style.
- Ensure the user profile area (Theme, Messages, Notifications, Avatar) is consistently styled.

#### 2. University Hero Card
- Redesign the hero section to be a large card with a background image on the right.
- Move the logo into a high-density white box with shadow.
- Increase the university name font size and weight.
- Style the "Active" badge and location/website metadata.
- Group the "Campuses" and "Programs" stats into modern square cards on the right.

#### 3. Tabs Navigation
- Re-style the `TabsList` to have a full-width bottom border, clean typography, and blue active indicators.
- Include count badges in the tab labels.

#### 4. Filter Toolbar
- Refine the horizontal filter bar with a clean search input and "Export", "Import", "Add Program" buttons.
- Ensure the "All [Category]" dropdowns are neatly aligned in a secondary row.

#### 5. Program Grid & Cards
- Use a `gap-8` grid for better spacing.
- Re-build the program card to follow the screenshot exactly:
    - Top badges (Featured, Active).
    - Program icon and name with university subtext.
    - Meta info list (Degree, Duration, Campus) with small icons.
    - Fee grid with specialized backgrounds for Tuition and Scholarship.
    - Intake chips row.
    - Action buttons ("Apply Now" primary, "Details" outline).

#### 6. Global Styling
- Apply a consistent background color to the main content area (`bg-[#F8FAFC]`).
- Ensure all margins and paddings follow a professional scale.
