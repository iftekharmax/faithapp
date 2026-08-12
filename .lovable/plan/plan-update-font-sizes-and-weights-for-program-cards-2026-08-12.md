# Plan: Update Font Sizes and Weights for Program Cards

Update the typography of the program cards in the university details page to match the user's specific requirements for program names, university names, and info sections.

## User Requirements
- **Program Name**: font-size: 18px, font-weight: 700
- **University Name**: font-size: 16px, font-weight: 500
- **University Info Section**: font-size: 14px, font-weight: 400

## Proposed Changes

### University Details Page
`src/routes/_authenticated.universities.$universityId.index.tsx`

#### Program Cards
- Locate the program name `h3` (currently `text-[24px] font-medium`) and update to `text-[18px] font-bold` (bold is 700).
- Locate the university name `p` (currently `text-sm font-medium`) and update to `text-[16px] font-medium` (medium is 500).
- Update the info section items (Degree, Duration, Campus):
    - Change container class from `text-base font-medium` to `text-[14px] font-normal` (normal is 400).
    - Ensure icons size remains balanced (currently `h-5 w-5`, might adjust to `h-4 w-4` if they look too large).

## Technical Details
- Use tailwind arbitrary values `text-[18px]`, `text-[16px]`, `text-[14px]` for precise control.
- Use `font-bold` for weight 700, `font-medium` for weight 500, and `font-normal` for weight 400.
- Verify that these changes don't negatively impact the layout or responsiveness of the cards.

## Verification Plan
- Preview the university details page.
- Inspect the program cards to confirm the font sizes and weights match the request.
- Ensure the overall card aesthetic remains premium and balanced.
