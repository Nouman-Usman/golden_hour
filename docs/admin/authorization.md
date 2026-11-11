# Admin authorization

## Database role and RLS boundary

Drizzle connects as Supabase's `postgres` role, which owns the tables and therefore bypasses RLS (RLS is enabled, not forced). The security boundary for app data is server-side authorization (`requirePermission`). RLS is enabled with **no policies** on every table so Supabase's Data API roles `anon` and `authenticated` can read or write nothing; this is asserted by a test. Never add `FORCE ROW LEVEL SECURITY` and never add policies in this plan.

## Rule

Every admin page, server action and route handler calls `requirePermission` first and re-reads the staff row (role and `active` are never trusted from the session or client). `requirePermission` wraps `authorize()` in `app/lib/permissions.ts`: no session is `unauthenticated`; an inactive account or missing permission is `forbidden`.

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

## Actions

| Action | Permission | Status |
|---|---|---|
| createStaff, setStaffActive, setStaffRole, resetStaffPassword | staff.manage | Task 4 |
| changeOrderStatus | orders.manage | Task 6 |
| changeEnquiryStatus | enquiries.manage | Task 7 |
| placeOrder, submitEnquiry | none (public) | Tasks 6-7 |
| adjustStock, setVariantInStock | stock.adjust | planned |
| create/update/archive/restore product and variant, change price | products.edit | planned |
| create/update/reorder/hide plans | plans.edit | planned |
| edit timings, programs, coach, gallery, reviews, page copy | content.edit | planned |
| update contact settings, delivery fee, shop open/closed | shop.settings | planned |
