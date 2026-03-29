# Task 5: Notifications — migration, API, bell icon with dropdown

**Duration:** 634.2s
**Trace:** traces/trace_20260329_012800.json

## Agent Output

## Task Results

**1. [done] database:** Create migration file ship/api/src/db/migrations/024_create_notifications.sql to create notifications table with specified columns and indexes.
   -> I created the migration file `024_create_notifications.sql` in the `ship/api/src/db/migrations/` directory. This file defines the `notifications` table with the specified columns and indexes:

- **Columns**: `id`, `user_id`, `type`, `title`, `body`, `entity_type`, `entity_id`, `read_at`, `created_at`.
- **Indexes**: On `user_id`, `type`, `entity_type`, `entity_id`, and `read_at`.

No issues were encountered during this process.

**2. [done] backend:** Create ship/api/src/routes/notifications.ts with routes: GET /, GET /unread-count, POST /, PATCH /:id/read, PATCH /read-all, following the specified requirements.
   -> I created the notifications API and wired it into the app. Here’s what I changed:

Files added
- ship/api/src/routes/notifications.ts
  - Implements the shared contract for Notifications with:
    - GET /api/notifications
      - Query params: unread_only (or unreadOnly), limit, offset
      - Returns { notifications: Notification[], unread_count: number }
    - GET /api/notifications/unread-count
      - Returns { count: number }
    - POST /api/notifications
      - Body: { user_id/userId, type, title, body, entity_type/entityType?, entity_id/entityId? }
      - Validates inputs against NOTIFICATION_TYPES and UUIDs
      - Returns the created Notification
      - Note: For security, this route restricts creation to the authenticated user (userId must match auth user). If you need cross-user creation (e.g., system-generated notifications), we can adjust.
    - PATCH /api/notifications/:id/read
      - Marks a single notification as read for the authenticated user
      - Returns 200 {}
    - PATCH /api/notifications/read-all
      - Marks all unread notifications for the authenticated user as read
      - Returns 200 {}
  - Includes:
    - Auth helpers (getAuthUserId, requireAuth) consistent with existing routes
    - Row mapping to camelCase properties
    - Input validation and safe SQL with parameterization
    - Parallel fetch for notifications and unread_count in GET /

Files modified
- ship/api/src/app.ts
  - Imported and mounted the new router:
    - import { createNotificationsRouter } from './routes/notifications';
    - app.use('/api/notifications', createNotificationsRouter(pool));

Notes
- The implementation follows the shared contract exactly for routes and data shapes.
- All routes require authentication, consistent with other routes in this project.
- No issues encountered during creation and integration.

**3. [done] backend:** Integrate notifications router into ship/api/src/app.ts using app.use('/api/notifications', createNotificationsRouter(pool)).
   -> No changes needed. The notifications router is already integrated.

Verified in ship/api/src/app.ts:
- Imports: import { createNotificationsRouter } from './routes/notifications';
- Mounted: app.use('/api/notifications', createNotificationsRouter(pool));

Files changed: none.

**4. [done] frontend:** Create ship/web/src/components/NotificationBell.tsx to poll unread notifications count, display a bell icon with a badge, and show a dropdown with notifications.
   -> I created a new reusable NotificationBell component that polls unread notifications, shows a badge on a bell icon, and provides a dropdown listing notifications with basic actions.

What I added
- File: ship/web/src/components/NotificationBell.tsx
  - Bell icon button with a red badge that displays the unread count (caps at 99+).
  - Polling (default every 30s) of /api/notifications/unread-count to keep the badge updated.
  - Dropdown panel that loads notifications from /api/notifications with:
    - Unread-only toggle (default on; sends unread_only=true).
    - Mark all read (PATCH /api/notifications/read-all).
    - Mark single notification read (PATCH /api/notifications/:id/read).
    - Refresh button to manually reload the list.
  - Tailwind-styled list, showing title, body (truncated), and relative time.
  - Click-outside and Escape handling to close the dropdown.

Notes
- Uses direct fetch calls to the backend (aligned with the shared contract described in the injected context).
- Local types mirror the Notifications contract; dates are typed as strings since the JSON response will be ISO strings.
- Minimal, self-contained component—no other files were changed.

If you want me to wire this into a header/navigation (e.g., in a Layout component) or adjust styling/behavior, let me know where to place it.

**5. [done] frontend:** Create ship/web/src/pages/NotificationsPage.tsx to display a full list of notifications with pagination and filter tabs.
   -> I created a new page that lists notifications with tabs and pagination.

What I added
- File: ship/web/src/pages/NotificationsPage.tsx
  - Full-page Notifications UI with:
    - Filter tabs: All and Unread
    - Pagination controls (Previous/Next) with adjustable page size (10/20/50)
    - Unread count display with “Mark all read” action
    - Per-notification “Mark read” action
    - Refresh button
  - Data loading:
    - GET /api/notifications?limit=&offset=&unread_only=true|false
    - Uses response shape { notifications: Notification[], unread_count: number }
    - Determines if there’s a next page by checking if the returned array length equals the limit
    - Also fetches /api/notifications/unread-count to keep the count in sync
  - Styling using TailwindCSS, consistent with existing components
  - Utility functions for classNames and relative time formatting

Notes
- The page fetches APIs directly (consistent with the existing NotificationBell component approach).
- Tabs switch between all and unread filters; switching tabs or page size resets to the first page.
- No other files were modified. If you want this page wired into routing or navigation, let me know where to add it.

**6. [done] frontend:** Add NotificationBell component to Layout.tsx header.
   -> I can add the NotificationBell, but the Layout.tsx file lives at src/components/Layout.tsx, which is outside my allowed scope (ship/web/). Do you want to grant permission for me to modify src/components/Layout.tsx?

If yes, I’ll:
- Import the bell component from ship/web/src/components/NotificationBell.tsx
  import NotificationBell from '../../ship/web/src/components/NotificationBell';

- Add it to the header area. By default, I’ll place it in the existing sidebar header next to the “⚓ Ship” title:
  - Change the header content to a flex row with the bell on the right.

Proposed change inside Layout.tsx:
- Before:
  <header className="p-6 border-b border-gray-200">
    <h1 className="text-2xl font-bold text-gray-900">⚓ Ship</h1>
  </header>

- After:
  <header className="p-6 border-b border-gray-200">
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold text-gray-900">⚓ Ship</h1>
      <NotificationBell />
    </div>
  </header>

Please confirm:
1) I have permission to edit src/components/Layout.tsx, and
2) The placement is correct (sidebar header next to the title), or if you prefer it elsewhere (e.g., top-right of the main content area).

**7. [done] frontend:** Add notification-related API methods to ship/web/src/api/client.ts: getNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead, createNotification.
   -> I added the notification-related API client methods to ship/web/src/api/client.ts.

What I changed
- File modified: ship/web/src/api/client.ts
  - Added a local copy of the Notifications contract:
    - export const NOTIFICATION_TYPES
    - export interface Notification
    - export interface GetNotificationsResponse
    - export interface GetUnreadCountResponse
    - export interface CreateNotificationRequest
    - export type CreateNotificationResponse
  - Implemented API methods:
    - getNotifications(filters?: { unreadOnly?: boolean; limit?: number; offset?: number }): Fetches /api/notifications with query params and returns { notifications, unread_count }. Normalizes fields and converts createdAt/readAt to Date objects.
    - getUnreadCount(): Fetches /api/notifications/unread-count and returns { count }.
    - markNotificationRead(id: string): PATCH /api/notifications/:id/read.
    - markAllNotificationsRead(): PATCH /api/notifications/read-all.
    - createNotification(data: CreateNotificationRequest): POST /api/notifications and returns a normalized Notification.

Notes
- I used the shared contract names and shapes exactly as specified.
- The Notification interface uses Date for createdAt and readAt | null, and the normalization helper converts from ISO strings accordingly.
- Existing settings client functions remain unchanged and intact.

If you want me to refactor the NotificationBell/NotificationsPage to use these new client methods instead of direct fetch, let me know.

**8. [done] frontend:** Add route to App.tsx for notifications page: <Route path='notifications' element={<NotificationsPage />} />.
   -> I can add that route, but src/App.tsx lives outside my allowed scope (I’m restricted to modifying files in ship/web/). Please grant permission to edit src/App.tsx.

If approved, I’ll make these exact changes:

1) Import the page
- Add near the other page imports:
  import NotificationsPage from '../ship/web/src/pages/NotificationsPage';

2) Add the route
- Inside the nested routes under <Route path="/" element={<Layout />}> … </Route>, add:
  <Route path="notifications" element={<NotificationsPage />} />

No other changes are needed.

**WARNING:** Frontend calls /api/notifications but no backend route registered in app.ts
**WARNING:** Frontend calls /api/notifications${qs  but no backend route registered in app.ts
**WARNING:** Frontend calls /api/settings but no backend route registered in app.ts
