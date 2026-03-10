# Stract Kanban — Today's Walkthrough (Mar 10)

---

## 1. Database Connection Fix
**Problem:** DNS failures to Supabase.
**Fix:** Switched to Connection Pooler URL (`pooler.supabase.com:6543`).

## 2. Drag-and-Drop 400 Error Fix
**Problem:** `Position 0` rejected by Gin.
**Fix:** Removed `binding:"required"` from Position fields.

## 3. UI Redesign — Light Theme & shadcn/ui
**Implementation:** Replaced dark zinc with soft gray `#fafaf8`. Installed `shadcn/ui` (Button, Badge, Card, Input, Separator, Tooltip, Avatar) and Geist font. Warm Linear-style aesthetic.

---

## 4. Phase 4 — Insights & Live Sync

### Real-time Synchronization (SSE)
- **Backend:** `internal/core/stream/broker.go` manages client connections. `GET /api/v1/stream` pipes events to browsers.
- **Frontend:** `useRealtime.js` hook listens for `created`, `moved`, `deleted`, and `updated` events.
- **Notifications:** shadcn `Sonner` toasts show live updates (e.g., "'Task A' moved to in progress").

### Analytics Dashboard
- **Backend:** `GET /api/v1/analytics/summary` computes velocity (7d), stale counts (3d+), and backlog health.
- **Frontend:** `/dashboard` page with KPI cards and a status distribution bar.
- **Task Staleness:** Cards show age indicators (e.g., "3 days ago") with color-coded "Flame" icons for stale tasks.

---

## 5. Phase 5 — Project-First Architecture

### Workspace & Project Hierarchy
- **Architecture:** Tasks are now scoped to **Projects**, which are scoped to **Workspaces**.
- **Authorization:** New `RequireWorkspaceMember` middleware enforces a 3-level chain (JWT → Workspace Membership).

### Feature Breakdown

| Component | Implementation |
|-----------|----------------|
| **Sidebar** | Global workspace switcher (shadcn Popover) + project list with color dots and task counts. |
| **AppContext** | Global state managing `activeWorkspace` and `activeProject`, restoring from `localStorage` on boot. |
| **Task Priority** | Added `Priority` (`low`/`medium`/`high`) to tasks. Cards show a priority dot (gray/amber/red). |
| **New Project** | Inline creation in sidebar with name input and 8 preset color swatches. |
| **Dashboard v2** | Added "Priority Breakdown" and "Completion Rate" cards. Filtered by active workspace/project. |

### Bug Fix: Hydration Error (Nested Buttons)
**Problem:** Next.js reported a hydration error: `<button> cannot be a descendant of <button>`.
**Fix:** Removed the nested `<button>` inside `PopoverTrigger asChild`. Since shadcn v4's `PopoverTrigger` (Base UI) already renders a button, I styled it directly instead of using a redundant inner button.

### Bug Fix: Route Collision Panic
**Problem:** Backend panicked on start due to duplicate registration of `GET /api/v1/workspaces/:workspace_id`.
**Fix:** Consolidated the route under the gated `RequireWorkspaceMember` group. Verified with `go build`.

---

## Build & Deploy Status

| Target | Status |
|--------|--------|
| `go build ./cmd/api` | ✅ Clean (including Phase 5) |
| `npm run build` | ✅ Compiled (✓ / and /dashboard) |
| `git push` | ✅ Head: `f140dbb` |
