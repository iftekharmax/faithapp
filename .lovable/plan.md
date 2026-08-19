# Plan: Fix Infinite Spinner on Protected Routes for Unauthenticated Users

Fix the issue where unauthenticated users accessing protected routes (like `/dashboard`) are stuck on "Initializing session..." indefinitely.

## Proposed Changes

### 1. `src/lib/auth-context.tsx`
- Ensure that the authentication state is resolved immediately if no session exists.
- Prevent `loadUserData` from being awaited if there is no session.
- Guarantee that the `loading` state is set to `false` even in failure cases.
- Proactively handle the missing session case in `initialize()`.

### 2. `src/routes/_authenticated.tsx`
- Optimize the redirection logic.
- Instead of a delayed timeout to check `getUser()`, immediately redirect if `authReady` is true and `session` is null.
- Ensure the UI doesn't render the spinner if we know the user is not authenticated.

## Technical Details

- **AuthContext Update**:
  - In the `initialize` function, if `data.session` is null, set `setAuthReady(false)` and `setLoading(false)` immediately.
  - Avoid awaiting `loadUserData` if `s` is null.
  - Ensure the `initializationPromiseRef` is handled correctly to allow subsequent login attempts to trigger updates if needed, though usually `onAuthStateChange` handles that.

- **Route Guard Update**:
  - In `AuthenticatedLayout`, check if `!loading && authReady && !session`. If this condition is met, trigger an immediate navigation to `/auth/login`.
  - Remove the 2.5s delay if we already have definitive proof from `auth-context` that the session is missing.

## Verification Plan

- [ ] **Incognito/Logged Out Test**: Open `/dashboard` directly and verify it redirects to `/login` within milliseconds.
- [ ] **Logged In Test**: Verify `/dashboard` still loads correctly for authenticated users.
- [ ] **Refresh Test**: Refresh `/dashboard` while logged out and verify redirection.
- [ ] **Logout Test**: Log out from the dashboard and verify redirection.
- [ ] **Network Failure Test**: Simulate a Supabase timeout and verify the app resolves the loading state (due to the 10s hard timeout already implemented).
