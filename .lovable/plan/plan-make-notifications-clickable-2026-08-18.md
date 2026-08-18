# Plan: Make Notifications Clickable

The user wants to make notifications in the notification bar clickable. This involves updating the UI to navigate to the relevant content (applications, tasks, etc.) when a notification is clicked and marking the notification as read.

## User Review Required

> [!IMPORTANT]
> The current database schema for `notifications` only stores `id`, `user_id`, `title`, `message`, `read`, and `created_at`. It **does not** explicitly store which application or task a notification belongs to in the database.
> 
> To make notifications properly clickable, I will implement "pattern matching" on the `title` and `message` to guess the link (e.g., if it contains an application code like `APP123`). However, for a 100% reliable system, I recommend adding `entity_type` and `entity_id` columns to the `notifications` table in the future.

## Proposed Changes

### Frontend Improvements

#### 1. Update `NotificationBell.tsx`
- Wrap each notification item in a clickable `button` or `Link`.
- Implement a click handler that:
  - Extracts potential IDs from the title/message (regex for application codes).
  - Navigates to the corresponding route:
    - `/applications/$id` for application-related notifications.
    - `/tasks` or a specific task view if we can identify it.
  - Calls `supabase` to mark the specific notification as `read: true`.
- Improve the visual state for unread notifications (e.g., subtle background highlight).

#### 2. Navigation Logic
- Detect `application_code` (e.g., starting with "APP") to link to application details.
- Detect "Task" or "Approval" keywords to link to the tasks dashboard.

## Technical Details

### New Navigation Helper
I will add a utility function to parse notification content:
```typescript
function getNotificationLink(title: string, message?: string): string | null {
  // Regex to find application codes like APP-2026-0001
  const appMatch = (title + (message || "")).match(/APP-\d{4}-\d+/);
  if (appMatch) return `/applications/search?code=${appMatch[0]}`;
  
  if (title.toLowerCase().includes("task") || title.toLowerCase().includes("approval")) {
    return "/tasks";
  }
  return null;
}
```
*Note: Since the database doesn't store the UUID of the application, I'll navigate to a search route OR try to fetch the ID via the code if possible.*

### Database Interaction
- Update single row: `supabase.from('notifications').update({ read: true }).eq('id', id)`
