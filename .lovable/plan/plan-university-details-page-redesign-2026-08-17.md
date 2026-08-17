# Plan - University Details Page Redesign

I will redesign the University Details page (Hero Section, Stats, and Content tabs) to match the premium, professional, and user-friendly enterprise SaaS design from the provided screenshot.

## Proposed Changes

### UI & UX Enhancements

#### 1. Hero Section Overhaul
- **Layout**: Large rounded container (`rounded-[40px]`) with a clean horizontal layout.
- **Logo**: Distinct large rounded card for the university logo.
- **Typography**: Enhanced heading font size (`text-[42px]`) with tighter tracking.
- **Metadata**: Bold flags, location, and website links with clean icons.
- **Description**: Refined typography for the university overview text.
- **Stats Cards**: Modern, minimalist "Campuses" and "Programs" counters on the right side.

#### 2. Navigation & Tabs
- **Tab Bar**: Custom full-width tab list with bottom-border active indicator and subtle vertical separators.
- **Typography**: Larger, more readable tab labels with count indicators.

#### 3. Content Tabs
- **Programs**: Elevated grid of program cards with a consistent gradient background and premium shadows.
- **Campuses**: Clean card layout for location management.
- **Applications**: Professional table view for recent application tracking.

### Technical Implementation

- **File**: `src/routes/_authenticated.universities.$universityId.index.tsx`
- **Component**: `UniversityDetail`
- **Styling**: Tailwind CSS for layout, spacing, and typography. Framer Motion for subtle entry animations.
- **Components**: shadcn/ui (Tabs, Cards, Badges, Tables, etc.) with custom styling to match the enterprise design system.

---
*Note: I will ensure the redesign remains fully responsive and accessible while maintaining the premium enterprise aesthetic.*
