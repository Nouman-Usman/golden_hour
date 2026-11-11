# Admin authorization

## Database role and RLS boundary

Drizzle connects as Supabase's `postgres` role, which owns the tables and therefore bypasses RLS (RLS is enabled, not forced). The security boundary for app data is server-side authorization (`requirePermission`). RLS is enabled with **no policies** on every table so Supabase's Data API roles `anon` and `authenticated` can read or write nothing; this is asserted by a test. Never add `FORCE ROW LEVEL SECURITY` and never add policies in this plan.

## Rule

Every admin page and `generateMetadata` calls `requireStaffPage(permission?)`; every admin server action and route handler calls `requireStaffAction(permission?)` (both in `app/admin/guard.ts`) before touching protected data. Both re-read the staff row through `getStaff()` on every request (role and `active` are never trusted from the session or client), and `getStaff()` treats a sign-in older than the row's `sessions_valid_after` as signed out (see `docs/admin/portal.md`). Layouts are never the boundary. With no permission argument the guard requires an active staff member only (dashboard, account, push toggle).

Staff-management functions additionally re-read the acting owner inside their own transaction (share-locked, after the owner advisory lock where used) before any Supabase Auth call, so a stale `StaffRecord` can't authorize a staff change.

Domain functions that mutate on behalf of staff take the `StaffRecord` (`actor`) and call `authorize(actor, permission)` themselves, so the boundary holds even if a caller forgets `requirePermission`; the event's staff id comes from `actor.userId`, never from input.

## Matrix

| Permission | owner | front_desk |
|---|---|---|
| orders.manage | yes | yes |
| enquiries.manage | yes | yes |
| stock.adjust | yes | yes |
| products.edit | yes | no |
| plans.edit | yes | no |
| content.edit | yes | no |
| shop.settings | yes | no |
| staff.manage | yes | no |

## Routes

| Route | Page guard | Writes (domain-enforced) |
|---|---|---|
| `/admin` | active staff | none |
| `/admin/orders`, `/admin/orders/[id]` | orders.manage | status, notes |
| `/admin/enquiries`, `/admin/enquiries/[id]` | enquiries.manage | status, notes |
| `/admin/products`, `/admin/products/[id]` | active staff | stock (stock.adjust); everything else products.edit, owner controls rendered only when allowed |
| `/admin/products/new` | products.edit | create |
| `POST /admin/products/[id]/images` | products.edit | upload |
| `/admin/plans` | plans.edit | plans |
| `/admin/settings` | shop.settings | delivery fee, shop open |
| `/admin/staff` | staff.manage | staff |
| `/admin/account` | active staff | own password, own push subscription |

## Actions

| Action | Permission | Where |
|---|---|---|
| createStaff, setStaffActive, setStaffRole, resetStaffPassword | staff.manage | `app/lib/staff.ts`, `/admin/staff` |
| changeOrderStatus, setOrderNotes | orders.manage | `app/lib/orders.ts`, `/admin/orders` |
| changeEnquiryStatus, setEnquiryNotes | enquiries.manage | `app/lib/enquiries.ts`, `/admin/enquiries` |
| setStock | stock.adjust | `app/lib/products.ts`, `/admin/products` |
| createProduct, updateProduct, setProductArchived, upsertVariant, setVariantArchived, addProductImage, removeProductImage | products.edit | `app/lib/products.ts` |
| savePlan, movePlan, deletePlan | plans.edit | `app/lib/plans-admin.ts`, `/admin/plans` |
| updateShopSettings | shop.settings | `app/lib/settings-admin.ts`, `/admin/settings` |
| savePushSubscription, deletePushSubscription | active staff | `app/lib/push.ts`, account and dashboard |
| changePassword (own) | active staff | `/admin/account` |
| placeOrder, submitEnquiry | none (public) | public site |
| edit timings, programs, coach, gallery, reviews, page copy, contact details | content.edit / shop.settings | planned (plan 4) |
