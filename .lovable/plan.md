# Plan - Redesign Program Card Buttons

Update the button design inside the Programs cards on the University Details page to a modern, high-fidelity SaaS layout while preserving all existing functionality.

## User Review Required

> [!IMPORTANT]
> This change only affects the visual styling of the "Apply Now", "Details", and action menu (`...`) buttons. Functional behavior remains identical.

- **Apply Now**: Will use the primary blue with a Send/Paperclip-style icon (as seen in reference).
- **Details**: Will use an outline style with a File/Document icon.
- **Action Menu**: Will use a compact square outline style with a vertical ellipsis.

## Technical Details

### 1. Update Lucide Icons
- Import `Send`, `FileText`, and `MoreVertical` from `lucide-react` in `src/routes/_authenticated.universities.$universityId.index.tsx`.

### 2. Restyle Program Card Buttons
- **Container**: Ensure the button group uses `flex items-center gap-3` for consistent spacing.
- **Apply Now Button**:
  - Increase `rounded` to `rounded-[12px]`.
  - Set `h-[46px]` or `h-12`.
  - Add `Send` icon.
  - Apply `shadow-sm` and hover transformations.
- **Details Button**:
  - Change from icon-only square to text + icon layout.
  - Set `h-[46px]` and `rounded-[12px]`.
  - Add `FileText` icon.
  - Use `border-slate-200` and `text-slate-600`.
- **Action Menu Button**:
  - Replace `MoreHorizontal` with `MoreVertical`.
  - Set `h-[46px] w-[46px]` for a perfect square.
  - Use `rounded-[12px]` and `border-slate-200`.

### 3. Verification
- Verify button alignment and heights.
- Check responsive behavior (flex-wrap or shrink/grow).
- Confirm hover states match the "premium" aesthetic of the rest of the page.
