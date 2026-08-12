# Plan: University Details Page Premium UI Redesign

Redesign the University Details page (specifically the Programs tab) to achieve a premium enterprise SaaS look as per the user's detailed specifications.

## Proposed Changes

### 1. Program Cards (`src/routes/_authenticated.universities.$universityId.index.tsx`)
- Update the card container styles:
    - Background: Subtle gradient (e.g., `bg-gradient-to-br from-white to-[#FCFCFD]`).
    - Border: `border-[#E8ECF3]`, hover `hover:border-[#3B82F6]`.
    - Shadow: `shadow-[0_2px_10px_rgba(15,23,42,0.05)]`, hover `hover:shadow-[0_16px_40px_rgba(37,99,235,0.15)]`.
    - Radius: `rounded-[20px]`.
    - Animation: `hover:-translate-y-[6px] transition-all duration-300 ease-in-out`.
- Redesign Header:
    - Status Badges: Featured (Orange soft), Active (Green soft), pill style.
    - Program Icon: Light blue circular background (`bg-blue-50/50`), gradient icon.
- Redesign Typography:
    - Program Title: `text-[20px] font-bold text-[#0F172A]` (Dark Navy).
    - University Name: `text-[14px] text-slate-500`.
    - Meta info: `text-[14px] text-slate-600` with aligned icons.
- Redesign Fee Section:
    - Implement 3 mini stat cards (Tuition Fee, Scholarship, App. Fee) with light background, rounded corners, and soft borders.
- Redesign Intake Section:
    - Display intakes as blue soft pills.
- Redesign Bottom Statistics:
    - 3 equal-width mini cards with light gray background and hover effects.
- Redesign Buttons:
    - Create Application: Gradient blue (`bg-gradient-to-r from-[#2563EB] to-[#3B82F6]`), 44px height.
    - View Details: White button with blue border on hover.
    - More Button: Circular icon button.

### 2. Filter Bar Redesign (`src/routes/_authenticated.universities.$universityId.index.tsx`)
- Filter Container: `bg-white rounded-[18px] p-5 shadow-sm`.
- Search Box: `h-[48px] rounded-full pl-12 border-slate-200 focus-visible:ring-blue-600/10`.
- Dropdown Filters: `h-[46px] rounded-[14px] border-slate-100 bg-slate-50/50`.
- Filter Chips: Pill style with active/inactive states.
- View Toggle: Segmented control style.
- Action Buttons: Soft background with blue hover.
- Add Program Button: Gradient blue with shadow and hover animation.

### 3. Layout and Spacing
- Background: Ensure overall page background is `#F8FAFC`.
- Spacing:
    - Grid gap: `gap-[28px]`.
    - Filter spacing: `gap-[20px]`.
    - Section spacing: `mt-[32px]`.
    - Container max-width: `max-w-[1600px]`.

## Technical Details
- Use Tailwind CSS classes for all styling.
- Utilize existing Lucide icons.
- Ensure transitions and animations are smooth (250ms-300ms).
- Maintain all existing logic, states, and functionalities.

## Verification Plan
- Visually inspect the University Details page in the preview.
- Verify the Program Cards hover effects, gradients, and layout.
- Test the new Filter Bar responsiveness and styling.
- Ensure all buttons and dropdowns function as expected.
