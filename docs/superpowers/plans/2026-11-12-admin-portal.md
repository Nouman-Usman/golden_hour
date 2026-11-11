# Admin Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Revision 2 (2026-11-12), frozen after this revision.** Changes from the architecture review: fresh actor re-validation in every staff mutation; locked, compensated and swept image lifecycle; magic-byte file validation; uploads via a dedicated route (Server Actions' 1 MB body limit); app-level session revocation via `staff.sessions_valid_after` instead of touching `auth.sessions`; auth-only action guard; a per-route permission table; metadata authorization; bounded slug retry; P2 details settled.

**Goal:** Give the owner and front desk a phone-first `/admin` portal: sign in, see what's new, run orders and enquiries, manage products and stock, edit membership plans and shop settings, and (owner only) manage staff.

**Architecture:** Server-rendered pages under `app/admin/` with thin server actions and one upload route. Every page, metadata function, action and route starts with the guards in `app/admin/guard.ts`. All business rules live in tested domain modules under `app/lib/` that take `(db, actor, input)`, call `authorize()`, and (for privileged mutations) re-validate the actor inside their own transaction. Product images go to a public Supabase Storage bucket through an injected `ImageStore`; product-row locks and compensation keep the bucket and database consistent, and a sweep script removes orphans. Admin writes that change the public site call `updateTag(...)`.

**Tech Stack:** Next.js 16.4.6 (App Router, `cacheComponents: true`, `proxy.ts`), React 19.3, Tailwind v4, Drizzle 0.45.4 + postgres 3.4.7, Supabase Auth + Storage via `@supabase/ssr` 0.12.7 / `@supabase/supabase-js` 2.118.0, `node:test` + PGlite (fast suite), and local Postgres 17 (`test:pg`).

**Spec:** `docs/superpowers/specs/2026-11-11-admin-portal-and-shop-design.md`
**Builds on:** `docs/superpowers/plans/2026-11-12-foundation-data-auth-orders.md` (done; live on Supabase).

**Scope:** Plan 2 of 5 (10 tasks). Not in this plan: the public shop (plan 3); editors for timings, programs, coach, gallery, reviews, contact info and page copy (plan 4); backups and launch (plan 5).

## Already in the repo (do not recreate)

- `db/schema.ts`: all tables, including `staff`, `settings` (single row, `deliveryFee`, `shopOpen`), `plans`, `products` (`slug` unique, `name`, `description`, `category`, `images text[]`, `archived`, `position`), `productVariants` (`label`, `price`, `stock` ≥ 0, `archived`, `position`, unique `(productId, label)`), `orders`, `orderItems`, `orderEvents` and `enquiryEvents` (`staffUserId` FK → `staff`). Migrations 0000–0004 are applied to Supabase.
- `app/lib/permissions.ts`: `Permission`, `can`, `StaffRecord`, `authorize`.
- `app/lib/auth.ts` (`server-only`): `getStaff()` (Supabase `auth.getUser()`, then a fresh staff row), `requirePermission(p)`.
- `app/lib/supabase-server.ts`: `supabaseEnv()`, `createSupabaseServerClient()`.
- `app/lib/supabase-admin.ts` (`server-only`): `supabaseAuthAdmin: AuthAdmin`; `app/lib/supabase-auth-admin.ts`: factory.
- `app/lib/staff.ts`: `AuthAdmin`, `EMAIL` (not exported yet), `createStaff`, `setStaffRole`, `setStaffActive` (returns `{ authSynced }`), `resetStaffPassword`, `reconcileStaff`; owner advisory lock `staff_owner_guard`.
- `app/lib/orders.ts`: `nextStatuses`, `changeOrderStatus(db, actor, { orderId, to, note? })`. `app/lib/enquiries.ts`: `nextEnquiryStatuses`, `changeEnquiryStatus(db, actor, { enquiryId, to, note? })`.
- `app/lib/plans.ts`: `PLANS_TAG = "plans"`, `getPlans()`, `formatPrice`, `periodLabel`. `app/lib/settings.ts`: `getSettings(db)`.
- `app/lib/errors.ts`: `DomainError(code, message?, fields?)`. `test/fixtures.ts`: `seedProduct`, `seedStaff`, `setShopOpen`, `newKey`.
- `proxy.ts` refreshes the session for `/admin/:path*` (the proxy body buffer defaults to 10 MB). `app/globals.css`: `.btn` family and the colour tokens `matte`, `matte-2`, `brass`, `brass-light`, `lamp`, `bone`, `ash`.
- An owner account exists.

## Global Constraints

- **No git commits.** We're on `main` and the user has said not to commit. Every task ends with changes left uncommitted; never run `git commit`, `git push`, `git stash`, `git reset` or `git checkout -- <file>`.
- **Never apply a migration to Supabase or create Supabase resources (buckets) without the user's explicit go-ahead in chat.**
- Read `node_modules/next/dist/docs/` before using a Next.js API (`AGENTS.md`): `redirect`, `cookies`, `updateTag`, `revalidatePath`, server actions, route handlers, `generateMetadata`.
- **Authorization at every entry point:** every page and every `generateMetadata` calls `requireStaffPage(p?)`; every server action and route handler calls `requireStaffAction(p?)` before reading or writing protected data. A layout check is never the boundary. Use the route table below.
- Domain functions take `(db, actor: StaffRecord, input)` and call `authorize(actor, <permission>)` first. Staff-management functions additionally re-validate the actor inside their transaction (Task 8). Server actions never write to the database directly.
- Permission matrix (spec): front desk has `orders.manage`, `enquiries.manage`, `stock.adjust`; owner has everything.

| Route | Page guard | Writes allowed (domain-enforced) |
|---|---|---|
| `/admin` (dashboard) | active staff | none |
| `/admin/orders`, `/admin/orders/[id]` | `orders.manage` | status, notes |
| `/admin/enquiries`, `/admin/enquiries/[id]` | `enquiries.manage` | status, notes |
| `/admin/products`, `/admin/products/[id]` | active staff | stock (`stock.adjust`); everything else `products.edit` (owner controls are rendered only if `can(role, "products.edit")`) |
| `/admin/products/new` | `products.edit` | create |
| `POST /admin/products/[id]/images` | `products.edit` | upload |
| `/admin/plans` | `plans.edit` | plans |
| `/admin/settings` | `shop.settings` | delivery fee, shop open |
| `/admin/staff` | `staff.manage` | staff |
| `/admin/account` | active staff | own password |

- **One action result shape** everywhere: `type ActionResult = { ok: true; message?: string } | { ok: false; error: string; fields?: Record<string, string> }`. Use `toActionError` (Task 3) for every caught error. Messages come from `DomainError.message`; any other error is logged with `console.error` and shown as "Something went wrong. Try again."
- Products and variants are archived, never deleted (stock may be adjusted on archived items, to correct counts). Plans may be deleted.
- Stock changes lock the variant row `FOR UPDATE` and keep `stock >= 0`.
- Money in whole PKR integers ≥ 0, shown with `formatPrice`. Every free-text input is trimmed before validation and length limits.
- **Images:** bucket `product-images`, public read; object path `products/<productId>/<uuid>.<ext>`, with the extension taken from the detected format. Accept only real JPEG, PNG or WebP files, checked by their first bytes (the browser's MIME type and filename are ignored). At most 5,242,880 bytes per file, at most 6 per product. Uploads use the route `POST /admin/products/[id]/images`, not a server action (Server Actions default to a 1 MB body).
- Admin UI: mobile-first and usable at 360px width; no `Motion`, GSAP or Lenis; same tokens and `.btn` classes; every admin page `robots: { index: false, follow: false }`. The tab title is "Golden Hour Admin", prefixed `(N) ` only for authorized staff. Admin pages are dynamic and never `'use cache'` personalized data.
- Supabase service-role key only in `server-only` modules (or the existing factory).
- New server modules use relative `.ts` imports; app components may use `@/`.
- At the end of every task, `npm test` and `npm run test:pg` pass, and `npx tsc --noEmit` and `npx eslint` are clean.
- **Claude never enters passwords.** Claude checks signed-out behaviour; the user does the signed-in walkthrough (Task 10).

## Review Focus

1. A front-desk user posts directly to an owner-only action or route: `forbidden`, nothing changed. (Tasks 5–8, a front-desk `forbidden` test in each.)
2. A staff member is deactivated, demoted or has their password reset while signed in elsewhere: their next request is refused, and a stale actor can't complete a staff mutation. (Tasks 1 and 8.)
3. Two staff act on the same order from stale screens: the second sees the domain message instead of a crash. (Task 3 `toActionError`.)
4. Uploads that are not really images, over 5 MB, a 7th image, two at once, or a storage or database failure part-way: rejected or compensated, no orphan left untracked, and the limit holds. (Task 5.)
5. Blank, negative, decimal or text values for prices, stock and the delivery fee: `invalid_input` naming the field, nothing changed. (Tasks 5–7.)

---

### Task 1: Guards, sign-in, sign-out and account password

**Files:**
- Create: `app/admin/gate.ts`, `app/admin/guard.ts`, `app/admin/login/page.tsx`, `app/admin/login/login-form.tsx`, `app/admin/login/actions.ts`, `app/admin/logout/route.ts`, `app/admin/(portal)/account/page.tsx`, `app/admin/(portal)/account/actions.ts`, `test/admin.gate.test.ts`
- Route layout: signed-in pages live in the route group `app/admin/(portal)/` (its layout comes in Task 2); `login` and `logout` stay outside the group.

**Interfaces:**
- `app/admin/gate.ts` (pure):
  - `type Gate = { kind: "ok"; staff: StaffRecord } | { kind: "signin" } | { kind: "deactivated" } | { kind: "forbidden" }`
  - `staffGate(staff: StaffRecord | null, permission?: Permission): Gate`: `null` → `signin`; `!active` → `deactivated`; a permission is given and `!can(role, permission)` → `forbidden`; otherwise `ok`.
- `app/admin/guard.ts` (`import "server-only"`):
  - `requireStaffPage(permission?: Permission): Promise<StaffRecord>`: `signin` → `redirect("/admin/login")`; `deactivated` → `redirect("/admin/logout?reason=deactivated")`; `forbidden` → `redirect("/admin?denied=1")`.
  - `requireStaffAction(permission?: Permission): Promise<StaffRecord>`: throws `DomainError("unauthenticated", "Sign in to continue.")` or `DomainError("forbidden", …)`; with no permission it requires active staff only (used by the account action).
- `app/admin/logout/route.ts`: `POST` signs out and redirects to `/admin/login` (used by the shell's sign-out button). `GET` signs out only when `reason=deactivated` (the guard's redirect target) and redirects to `/admin/login?reason=deactivated`; any other `GET` → 405.
- Login: server action `signIn(prev: ActionResult, form)` → `signInWithPassword`, then `getStaff()`. No staff row or inactive → sign out and show "This account can't use the admin portal." Bad credentials → "Email or password is incorrect." Success → `redirect("/admin")`. Active staff opening `/admin/login` → redirect to `/admin`. `?reason=deactivated` → "This account is deactivated." The page has its own static title "Sign in · Golden Hour Admin".
- Account: `changePassword(prev, form)` → `requireStaffAction()`. Re-check the current password with `signInWithPassword`; new password at least 10 characters and different from the current one; then `auth.updateUser({ password })`. Messages: "Current password is incorrect." / "At least 10 characters." / "Choose a different password." / "Password changed."

- [ ] **Step 1: Write the failing tests** in `test/admin.gate.test.ts`: `null → signin`; inactive owner → `deactivated` (with and without a permission); `front_desk + products.edit → forbidden`; `front_desk + orders.manage → ok`; owner with any permission → `ok`; active staff with no permission → `ok`.
- [ ] **Step 2:** `node --test test/admin.gate.test.ts` → FAIL. **Step 3:** Implement. **Step 4:** All checks pass (Global Constraints).
- [ ] **Step 5:** Signed-out browser check: `/admin/login` renders; `/admin/account` → login; `GET /admin/logout` without a reason → 405. Never type a password.
- [ ] **Step 6:** Leave changes uncommitted.

### Task 2: Admin shell and dashboard

**Files:** Create `app/admin/(portal)/layout.tsx`, `app/admin/(portal)/nav.tsx`, `app/admin/(portal)/page.tsx`, `app/admin/auto-refresh.tsx`, `app/lib/admin-queries.ts`, `test/admin.queries.test.ts`

**Interfaces:**
- `app/lib/admin-queries.ts`:
  - `const LOW_STOCK_THRESHOLD = 3`
  - `dashboardCounts(db: Db): Promise<{ newOrders: number; newEnquiries: number; lowStock: { variantId: string; productId: string; productName: string; label: string; stock: number }[] }>`. `lowStock` lists non-archived variants of non-archived products with stock ≤ 3, ascending by stock, at most 10.
  - `adminTitle(counts: { newOrders: number; newEnquiries: number }): string` → "Golden Hour Admin", or "(5) Golden Hour Admin" when the sum is greater than 0.
- `(portal)/layout.tsx`: `requireStaffPage()`; renders the nav and `robots` noindex metadata. `generateMetadata` calls `requireStaffPage()` **before** `dashboardCounts`, then returns `adminTitle(...)`.
- Nav: sticky bottom bar on mobile, side list from `md` up. Links: Home; Orders and Enquiries (with New badges); Products; owner-only Plans, Settings and Staff (rendered only if `can`); Account; and a Sign out `<form method="post" action="/admin/logout">`.
- `auto-refresh.tsx` (client): every 60 s calls `router.refresh()` only while `document.visibilityState === "visible"`; refreshes once on becoming visible; clears its interval and listener on unmount. Used by the dashboard and the orders and enquiries lists.
- Dashboard `/admin` (`requireStaffPage()`): tiles for new orders, new enquiries and low stock (links to the filtered lists or products); `?denied=1` → "You don't have access to that page."

- [ ] **Step 1: Write the failing tests:** counts include only New orders and enquiries; low stock includes 0–3, excludes 4, excludes archived variants and products, sorted ascending, capped at 10; `adminTitle` with zero and non-zero counts.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** All checks pass.
- [ ] **Step 5:** Signed-out check: `/admin` → `/admin/login`, and the login tab title has no count. Leave changes uncommitted.

### Task 3: Orders: list, detail, status and notes

**Files:** Create `app/admin/(portal)/orders/page.tsx`, `app/admin/(portal)/orders/[id]/page.tsx`, `app/admin/(portal)/orders/actions.ts`, `app/admin/action-error.ts`, `test/admin.orders.test.ts`; modify `app/lib/admin-queries.ts`, `app/lib/orders.ts`

**Interfaces:**
- `toActionError(e: unknown): { ok: false; error: string; fields?: Record<string, string> }` (pure): a `DomainError` → its message and fields; anything else → `console.error` and "Something went wrong. Try again." Exports the `ActionResult` type.
- `listOrders(db, { status?: OrderStatus; limit?: number }): Promise<OrderRow[]>`: newest first, default 50; `OrderRow = { id; number; status; fulfilment; customerName; total; createdAt }`.
- `getOrderDetail(db, id): Promise<OrderDetail | null>`: the order, its item snapshots, and events oldest first with `staffName` (`null` → "Customer"); `null` for unknown or non-UUID ids.
- `setOrderNotes(db, actor, { orderId: string; notes: string }): Promise<void>`: `orders.manage`; trims; empty allowed (clears); at most 2000 characters after trimming, else `invalid_input` `fields.notes` "Keep notes under 2000 characters."; `not_found` for unknown or non-UUID ids.
- UI: list with status chips (`?status=`) and a New count; detail with number, status, customer, `tel:` and WhatsApp (`https://wa.me/` + digits, `03…` → `923…`) links, fulfilment and address, items table, subtotal, fee and total, notes form, and history ("Confirmed by Nouman · 12 Nov, 3:14 pm"). Status buttons come from `nextStatuses[status]`, filtered by fulfilment; Cancel is an outline button with an in-form two-step confirm (never `window.confirm`); an optional note goes with each status change.
- Actions `changeStatus` and `saveNotes`: `requireStaffAction("orders.manage")` → domain call → `revalidatePath` → `ActionResult`.

- [ ] **Step 1: Write the failing tests:** list filter and order; detail with items and events, including "Customer" for the creation event; `null` cases; notes trimmed, cleared and over the limit; inactive staff → `forbidden`; `toActionError` for a `DomainError` and for a plain `Error`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** All checks pass. **Step 5:** Leave changes uncommitted.

### Task 4: Enquiries: list, detail, status and notes

**Files:** Create `app/admin/(portal)/enquiries/page.tsx`, `app/admin/(portal)/enquiries/[id]/page.tsx`, `app/admin/(portal)/enquiries/actions.ts`, `test/admin.enquiries.test.ts`; modify `app/lib/admin-queries.ts`, `app/lib/enquiries.ts`

**Interfaces:** `listEnquiries(db, { status?; limit? })`; `getEnquiryDetail(db, id)` (events with staff names; `null` cases); `setEnquiryNotes(db, actor, { enquiryId, notes })` (same rules as order notes, permission `enquiries.manage`). The UI mirrors orders: chips All / New / Contacted / Joined / Not interested; detail shows name, phone (`tel:` and WhatsApp), program, message, notes, history, and status buttons from `nextEnquiryStatuses`.

- [ ] **Step 1: Write the failing tests:** filter and order; detail and events; `null` cases; notes rules; inactive staff → `forbidden`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** All checks pass. **Step 5:** Leave changes uncommitted.

### Task 5: Products, variants, images and stock

**Files:** Create `app/lib/products.ts`, `app/lib/image-format.ts`, `app/lib/image-store.ts`, `app/lib/supabase-image-store.ts`, `app/lib/upload.ts`, `app/admin/(portal)/products/page.tsx`, `app/admin/(portal)/products/new/page.tsx`, `app/admin/(portal)/products/[id]/page.tsx`, `app/admin/(portal)/products/actions.ts`, `app/admin/products/[id]/images/route.ts`, `scripts/create-buckets.ts`, `scripts/sweep-images.ts`, `test/products.test.ts`, `test/upload.test.ts`

**Interfaces:**
- `detectImageFormat(bytes: Uint8Array): "jpeg" | "png" | "webp" | null` (`app/lib/image-format.ts`): JPEG starts `FF D8 FF`; PNG starts `89 50 4E 47 0D 0A 1A 0A`; WebP has `RIFF` at bytes 0–3 and `WEBP` at bytes 8–11. Anything else, including SVG, → `null`.
- `interface ImageStore { upload(path: string, bytes: Uint8Array, contentType: string): Promise<string>; remove(path: string): Promise<void>; list(prefix: string): Promise<string[]> /* object paths */; publicUrl(path: string): string; pathFromUrl(url: string): string | null }`. `supabaseImageStore` (`server-only`, bucket `product-images`) implements it.
- `readImageUpload(req: Request, maxBytes: number): Promise<{ bytes: Uint8Array } | { error: string; status: number }>` (`app/lib/upload.ts`, pure). It rejects early with 413 "Images must be 5 MB or smaller." when `Content-Length` exceeds `maxBytes + 64 KB` (multipart overhead), otherwise reads `formData()`, takes field `file`, and enforces `bytes.length <= maxBytes` (413); no file → 400 "Choose an image." The route `POST /admin/products/[id]/images` calls `requireStaffAction("products.edit")`, then `readImageUpload(req, 5_242_880)`, then `addProductImage`; it returns JSON `ActionResult` (status 200, 4xx for validation, 403 for forbidden).
- `const PRODUCTS_TAG = "products"`; every product action calls `updateTag(PRODUCTS_TAG)`.
- `app/lib/products.ts`, each function `authorize`s first:
  - `createProduct(db, actor, { name, description, category }): Promise<string>`: `products.edit`. Name 1–80 characters after trimming; description ≤ 1000; category 1–40. Slug: lowercase, `[^a-z0-9]+` → `-`, trimmed; on a unique violation of `products_slug_unique` only, retry with `-2`, `-3`…, at most 5 attempts (then `invalid_input` `fields.name` "Choose a more distinctive name."), each attempt its own insert, using `ON CONFLICT (slug) DO NOTHING RETURNING id` (never catching errors inside a transaction). Also creates the default variant `{ label: "", price: 0, stock: 0 }` in the same transaction as the successful insert.
  - `updateProduct`, `setProductArchived`, `upsertVariant` (label ≤ 40; price an integer ≥ 0, `fields.price` "Enter a price in whole rupees."; duplicate label → `fields.label` "That option already exists."), `setVariantArchived`: all `products.edit`.
  - `setStock(db, actor, { variantId, stock })`: `stock.adjust`; integer ≥ 0 (`fields.stock` "Enter a whole number, 0 or more."); transaction with the variant `FOR UPDATE`; allowed on archived items.
  - `addProductImage(db, store, actor, { productId, bytes }): Promise<string>`:
    1. Detect the format, else `invalid_input` "Use a JPEG, PNG or WebP image."; size check.
    2. Transaction: `SELECT … FROM products WHERE id = $1 FOR UPDATE`; `not_found` if missing; 6 images already → `invalid_input` "A product can have up to 6 images."
    3. Inside the same transaction (the lock serializes concurrent uploads): `store.upload(path, bytes, mime)`, then `UPDATE products SET images = array_append(images, $url)`.
    4. If anything after the upload throws, or the transaction fails to commit, call `store.remove(path)` (best effort); if that also fails, log `console.error("orphan image", path)` (the sweep script removes it). Rethrow the original error.
  - `removeProductImage(db, store, actor, { productId, url })`: `products.edit`. `store.pathFromUrl(url)` must start with `products/<productId>/` and `url` must be in `products.images`, else `invalid_input` "That image doesn't belong to this product." Transaction with the product `FOR UPDATE` → `array_remove`. After commit, `store.remove(path)`; on failure, log and return `{ storageCleaned: false }` (the sweep retries); success → `{ storageCleaned: true }`.
  - `sweepOrphanImages(db, store): Promise<{ removed: string[]; failed: string[] }>`: lists `products/` objects, removes any whose public URL isn't in any `products.images`, and only touches objects older than 1 hour (so an upload in progress is never removed).
  - `listProductsAdmin(db, { includeArchived?: boolean })`; `getProductAdmin(db, id)` (variants by position; `null` for unknown or non-UUID ids).
- UI: the list shows products, variants, stock and a low-stock flag. Front desk sees stock inputs (Save per variant) only. The owner also gets New product, Edit, Archive/Restore, options (label and price), images (an upload form posting to the route with `fetch`, a progress state, and Remove), and Show archived.
- Scripts (run by the user, or by the controller after the user's go-ahead): `create-buckets.ts` creates the public bucket `product-images` (5 MB limit; MIME types jpeg, png, webp) if it's missing and prints `created` or `exists`; `sweep-images.ts` runs `sweepOrphanImages` and prints the result.

- [ ] **Step 1: Write the failing tests:**
  - `test/upload.test.ts` (real `Request` objects with `FormData`): exactly 5,242,880 bytes accepted; 5,242,881 → 413; a `Content-Length` header far above the limit → 413 without parsing; missing `file` → 400.
  - `test/products.test.ts` (fake `ImageStore` that records calls and can be told to fail `upload`, `remove` or `list`):
    - create: slug `whey-protein`, then `whey-protein-2`; the default variant exists; `concurrent creates with the same name both succeed with different slugs` (`Promise.all` on PGlite plus a `test:pg` case in `test/pg/concurrency.test.ts`); names that are blank or over 80 characters → `fields.name`.
    - variants: price 6500 ok; `-1`, `1.5` and `""` → `fields.price`; duplicate label → `fields.label`.
    - stock: front desk sets 7; `-1`, `2.5` and `"abc"` → `fields.stock`; unchanged after a failure; works on an archived variant.
    - front desk → `forbidden` on create, update, archive, variant and image functions.
    - images: PNG bytes declared as anything → accepted and stored with a `.png` path; HTML bytes → rejected without calling `upload`; an SVG string → rejected; a 7th image → rejected without `upload`; `upload` throws → nothing appended; the DB update fails after upload (force it, e.g. by deleting the product inside a fake upload) → `remove(path)` called; `remove` also fails → the original error is still thrown; remove with another product's URL → rejected; remove where storage delete fails → `{ storageCleaned: false }` and the URL is gone from the DB; sweep removes only old, unreferenced paths.
    - `test:pg` case: two concurrent uploads when 5 images exist → exactly one succeeds and 6 images remain.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** All checks pass (including `test:pg`).
- [ ] **Step 5:** The controller asks the user before running `scripts/create-buckets.ts` against Supabase. Leave changes uncommitted.

### Task 6: Membership plans editor

**Files:** Create `app/lib/plans-admin.ts`, `app/admin/(portal)/plans/page.tsx`, `app/admin/(portal)/plans/actions.ts`, `test/plans-admin.test.ts`

**Interfaces** (all `plans.edit`; all inputs trimmed):
- `savePlan(db, actor, { planId?, name, price, period, description, features: string[], highlighted, visible }): Promise<string>`: name 1–40 non-blank; price an integer ≥ 0; period one of `one_time`, `month`, `quarter`, `year`; description ≤ 200; features: blank lines dropped, each 1–60, at most 8. New plans go to `max(position) + 1`.
- `movePlan(db, actor, { planId, direction: "up" | "down" })`: in one transaction, lock all plan rows `FOR UPDATE ORDER BY id`, then swap `position` with the neighbour in position order (concurrent moves serialize; positions are not unique and need no constraint). The first plan can't move up and the last can't move down (no-op).
- `deletePlan(db, actor, { planId })`.
- Actions call `updateTag(PLANS_TAG)` after every success. UI: ordered list with up/down, edit, show/hide, and delete (two-step confirm); one feature per line.

- [ ] **Step 1: Write the failing tests:** create appends at the end; edit; invalid name (blank or whitespace), price, period, description length and features → `invalid_input` with the field; move swaps, and is a no-op at the ends; delete; front desk → `forbidden`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** All checks pass. **Step 5:** Leave changes uncommitted.

### Task 7: Shop settings

**Files:** Create `app/lib/settings-admin.ts`, `app/admin/(portal)/settings/page.tsx`, `app/admin/(portal)/settings/actions.ts`, `test/settings-admin.test.ts`

**Interfaces:** `const SETTINGS_TAG = "settings"`; `updateShopSettings(db, actor, { deliveryFee: number; shopOpen: boolean })`: `shop.settings`; delivery fee an integer from 0 to 5000 (`fields.deliveryFee` "Enter a delivery fee from Rs 0 to Rs 5,000."). The action calls `updateTag(SETTINGS_TAG)`. UI: fee input and a "Shop is open" toggle, with a note that closing keeps products visible but stops checkout.

- [ ] **Step 1: Write the failing tests:** save 300 and closed; `-1`, `5001`, `2.5` and `""` → `fields.deliveryFee`; front desk → `forbidden`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** All checks pass. **Step 5:** Leave changes uncommitted.

### Task 8: Staff management, fresh-actor checks and session revocation

**Files:** Create `app/admin/(portal)/staff/page.tsx`, `app/admin/(portal)/staff/actions.ts`, `app/lib/session-gate.ts`, `test/session-gate.test.ts`, migration `db/migrations/0005_*` (generated); modify `db/schema.ts`, `app/lib/staff.ts`, `app/lib/auth.ts`, `scripts/create-owner.ts`, `test/staff.test.ts`, `test/pg/concurrency.test.ts`, `test/fixtures.ts`

**Interfaces / changes:**
- **Fresh actor everywhere:** a private `revalidateActor(tx, actor, permission)` in `staff.ts` re-selects the actor's `staff` row inside the transaction and requires it to exist, be `active`, and `can(role, permission)`, else `forbidden` "Your access changed. Reload and try again." Every staff mutation (`createStaff`, `setStaffRole`, `setStaffActive`, `resetStaffPassword`) runs inside a transaction that: (owner-guard ops) takes `pg_advisory_xact_lock(hashtext('staff_owner_guard'))` first; then calls `revalidateActor`; and only then performs any Supabase Auth call. For `createStaff`, the Auth `createUser` call happens after `revalidateActor` inside the transaction, and the staff insert follows in the same transaction (compensation unchanged: on failure, `deleteUser`).
- **Session revocation (supported, app-level):**
  - Schema: `staff.sessionsValidAfter timestamptz` nullable; `npm run db:generate -- --name staff_sessions_valid_after` (adds only that column).
  - `setStaffActive(…, false)`, `setStaffRole` (on a demotion) and `resetStaffPassword` set `sessions_valid_after = now()` in the same transaction. Deactivation still also bans (blocks refresh tokens). Nothing touches the `auth` schema.
  - `sessionAllowed(authTimeSec: number | null, validAfter: Date | null): boolean` (`app/lib/session-gate.ts`, pure): `validAfter` null → `true`; `authTimeSec` null → `false` (fail closed); otherwise `authTimeSec * 1000 >= validAfter.getTime()`.
  - `authTimeFromClaims(claims: { amr?: unknown }): number | null`: the latest `timestamp` among `amr` entries shaped `{ method, timestamp }`; `null` if none. (`amr` is the sign-in time and stays the same across token refreshes, unlike `iat`.)
  - `getStaff()` uses `supabase.auth.getClaims()` (verified) for `sub` and `amr`, reads the staff row, and returns `null` when `!sessionAllowed(authTimeFromClaims(claims), row.sessionsValidAfter)`. `getUser()` is no longer needed.
- `reconcileStaff`: per-row try/catch, returns `{ orphanAuthUsers, rebanned, failed: string[] }`. Export `EMAIL`; `scripts/create-owner.ts` validates with it. `test/staff.test.ts`: add the missing `close()`. `seedStaff` gains `sessionsValidAfter?`.
- UI `/admin/staff` (`staff.manage`): list; create (temporary password, with the note "Share this password in person. They can change it under Account."); per row: change role, deactivate/reactivate, reset password. `authSynced: false` shows an amber note: "Saved, but the ban on their login didn't complete. Run the reconcile script."

- [ ] **Step 1: Write the failing tests:**
  - `test/session-gate.test.ts`: no `validAfter` → allowed; auth time before → refused; equal or after → allowed; `authTime` null with `validAfter` set → refused; `authTimeFromClaims` handles `amr` entries, string arrays (→ `null`) and a missing `amr`.
  - `test/staff.test.ts`: for each of `createStaff`, `setStaffRole`, `setStaffActive` and `resetStaffPassword`: an actor demoted to `front_desk` in the DB but passed as a stale owner `StaffRecord` → `forbidden` and **no** Auth call recorded; the same for an actor deactivated in the DB. Deactivate, demote and password reset set `sessionsValidAfter`. Reconcile records a per-row failure in `failed` and continues. `EMAIL` check.
  - `test/pg/concurrency.test.ts`: an owner demotes owner B while B tries to create staff → B's create is refused if the demotion committed first (run 10×; never a staff row created by a demoted actor).
- [ ] **Step 2:** FAIL. **Step 3:** Implement and generate migration 0005. **Step 4:** All checks pass.
- [ ] **Step 5:** The controller asks the user before running `npm run db:migrate` to apply 0005 to Supabase. Leave changes uncommitted.

### Task 9: Installable admin app and push notifications (added 2026-11-12 at the user's request)

Decisions confirmed with the user: the **admin portal only** is installable; **staff** get a notification for every new order and new enquiry, even when the app is closed; tapping it opens that order or enquiry; iPhones need the app added to the Home Screen first (iOS 16.4+), and the portal says so.

**Files:** Create `public/admin.webmanifest`, `public/admin-sw.js`, `public/icons/admin.svg`, `public/icons/admin-192.png`, `public/icons/admin-512.png`, `public/icons/admin-180.png`, `app/lib/push.ts`, `app/lib/web-push-sender.ts`, `app/admin/(portal)/push-toggle.tsx`, `app/admin/(portal)/push-actions.ts`, `scripts/generate-vapid.ts`, `test/push.test.ts`, migration `db/migrations/0006_*` (generated); modify `db/schema.ts`, `app/admin/(portal)/layout.tsx`, `app/admin/(portal)/account/page.tsx`, `app/admin/(portal)/page.tsx`, `app/actions.ts`, `.env.example`, `package.json`

**Interfaces / decisions:**
- Dependencies: `web-push@3.6.7` and `@types/web-push@3.6.4` (dev), exact versions (4.0.0 is too new).
- Env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (secret, server-only), `VAPID_SUBJECT` (`mailto:` + the owner's email). `scripts/generate-vapid.ts` prints a new key pair for **the user** to paste into `.env` (Claude never handles the private key). With the keys missing, push is silently disabled and the toggle shows "Notifications aren't set up yet."
- Schema `pushSubscriptions` (RLS on): `id`, `staffUserId` FK → `staff` (on delete restrict), `endpoint text unique`, `p256dh text`, `auth text`, `userAgent text`, `createdAt`, `lastSuccessAt nullable`. `npm run db:generate -- --name push_subscriptions` (0006, which only creates this table).
- Manifest `public/admin.webmanifest`: `name` "Golden Hour Admin", `short_name` "GH Admin", `start_url` "/admin", `scope` "/admin/", `display` "standalone", `background_color` "#141210", `theme_color` "#141210", icons 192 and 512 PNG (`purpose: "any maskable"`) plus the SVG. It is linked only from `(portal)/layout.tsx` and the login page via `metadata.manifest`, with `appleWebApp: { capable: true, title: "GH Admin", statusBarStyle: "black-translucent" }` and the 180px `apple-touch-icon`. The public site gets no manifest.
- Icons: `public/icons/admin.svg` is a brass "GH" monogram on matte `#141210` with safe padding for maskable crops; PNGs are rendered from it with `qlmanage -t -s <size> -o`. (The real logo is only 150px; swap later when the owner sends a hi-res one.)
- Service worker `public/admin-sw.js` (served at `/admin-sw.js`, so its scope is `/admin/`): `push` → `self.registration.showNotification(title, { body, tag, data: { url }, icon: "/icons/admin-192.png", badge: "/icons/admin-192.png" })`; `notificationclick` → focus an open `/admin` client and navigate it to `data.url`, else `clients.openWindow(data.url)`. No offline caching (YAGNI).
- Notification content holds **no customer names or phone numbers** (lock screens are visible):
  - order: title "New order GH-1042", body "Rs 5,500 · Pickup" (or "Delivery"), url `/admin/orders/<id>`, tag `order-<id>`;
  - enquiry: title "New enquiry", body the program title, url `/admin/enquiries/<id>`, tag `enquiry-<id>`.
- `app/lib/push.ts` (pure domain, testable):
  - `interface PushSender { send(sub: { endpoint: string; p256dh: string; auth: string }, payload: string): Promise<"ok" | "gone" | "failed"> }`
  - `savePushSubscription(db, actor, { endpoint, p256dh, auth, userAgent })`: active staff only (no permission); `endpoint` must be an `https:` URL of at most 1000 characters, and `p256dh`/`auth` non-empty base64url strings of at most 200 characters (else `invalid_input`); upsert on `endpoint` (re-assigned to the current staff member).
  - `deletePushSubscription(db, actor, { endpoint })`: deletes only the actor's own row.
  - `notifyStaff(db, sender, event: { kind: "order"; id: string; number: string; total: number; fulfilment: "pickup" | "delivery" } | { kind: "enquiry"; id: string; program: string }): Promise<{ sent: number; removed: number; failed: number }>`: recipients are subscriptions of **active** staff whose role `can` `orders.manage` (orders) or `enquiries.manage` (enquiries) and whose `sessionsValidAfter` is null or earlier than the subscription's `createdAt`. Sends in parallel with a 5 s per-send timeout; `gone` deletes the row; `ok` sets `lastSuccessAt`; `failed` is logged. Never throws.
- `app/lib/web-push-sender.ts` (`server-only`): `webPushSender: PushSender | null` (null when VAPID env is missing); maps HTTP 404/410 → `gone`, other errors → `failed`.
- Triggers: in `app/actions.ts`, after `submitEnquiry` returns `created: true`, schedule `notifyStaff` with `after()` from `next/server` (read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`), so the customer's response never waits on push. Plan 3's checkout action must do the same for `placeOrder` (note this in `docs/admin/portal.md`).
- UI `push-toggle.tsx` (client), shown on the dashboard (a dismissible banner until enabled on this device) and on Account:
  - registers `/admin-sw.js` with scope `/admin/`;
  - states:
    - unsupported → "This browser can't show notifications.";
    - iOS and not running as an installed app (`navigator.standalone !== true` and not `display-mode: standalone`) → "On iPhone: tap Share → Add to Home Screen, then open Golden Hour Admin from your Home Screen to turn on notifications.";
    - permission denied → "Notifications are blocked. Allow them in your browser's site settings.";
    - otherwise a "Turn on notifications" button.
  - The button calls `Notification.requestPermission()` **only on that click**, then `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`, then the `savePush` action; "Turn off" unsubscribes and calls `deletePush`.
- Actions in `push-actions.ts`: `savePush` and `deletePush` → `requireStaffAction()` → domain → `ActionResult`.

- [ ] **Step 1:** Install the exact dependencies.
- [ ] **Step 2: Write the failing tests** in `test/push.test.ts` (fake `PushSender` recording calls, configurable per endpoint):
  - save validates the endpoint (`http:` rejected, over 1000 characters rejected) and keys; upsert re-assigns an endpoint to a new staff member;
  - delete removes only your own subscription;
  - order recipients: an owner and a front desk member both get it; an inactive staff member doesn't; a subscription created before `sessionsValidAfter` doesn't;
  - enquiry recipients are the same set (both roles have `enquiries.manage`);
  - `gone` deletes the row and is counted as `removed`; `failed` is counted and nothing throws; `ok` sets `lastSuccessAt`;
  - the payload JSON has the title, body, url and tag above and **contains neither the customer name nor the phone number**.
- [ ] **Step 3:** FAIL. **Step 4:** Implement: schema and migration 0006, domain, sender, service worker, manifest, icons, toggle, actions, `after()` trigger, and the VAPID script.
- [ ] **Step 5:** All checks pass. Signed-out check: `/admin.webmanifest` and `/admin-sw.js` are served (200) with the right content types; Chrome DevTools-equivalent check via `fetch` that the manifest parses.
- [ ] **Step 6:** The controller asks the user to (a) run `node scripts/generate-vapid.ts` themselves and paste the three values into `.env`, and (b) approve applying migration 0006 (`npm run db:migrate`). Leave changes uncommitted.

### Task 10: Docs, build, caching check and the user's walkthrough

**Files:** Modify `docs/admin/authorization.md` (every action and route mapped to its guard and permission, including the route table above); create `docs/admin/portal.md` (routes, who sees what, the 60 s refresh, the image lifecycle and sweep script, session revocation, the reconcile script, installing the app and push notifications incl. the plan-3 `after()` hook for orders).

- [ ] **Step 1:** Update the docs.
- [ ] **Step 2:** `npm test && npm run test:pg && npx tsc --noEmit && npx eslint && npx next build` → all pass. In the build output, every `/admin` route is dynamic (`ƒ`) and `/` stays static with revalidation; confirm no `'use cache'` function reads cookies or staff data (`grep -rn "use cache" app`, then read each hit).
- [ ] **Step 3:** Signed-out browser check: every `/admin/*` route redirects to `/admin/login`; `POST /admin/products/<uuid>/images` without a session → 401/403 JSON; no console errors on the login page.
- [ ] **Step 4: Hand over to the user** for the signed-in walkthrough (Claude doesn't enter passwords):
  1. Sign in; check the dashboard counts and tab title.
  2. Change a plan's price and see it on the home page.
  3. Send a test enquiry from the site and move it to Contacted.
  4. Create a product, upload a ~4.9 MB JPEG and then a 5.1 MB one (rejected), and set stock.
  5. Create a front-desk account and sign in with it in a private window: Plans, Settings and Staff are absent, and `/admin/plans` shows "You don't have access".
  6. Reset that account's password: the private window is signed out on its next click. Deactivate it: same.
  7. Install the portal: Android/desktop Chrome via the install prompt; iPhone via Share → Add to Home Screen. Open it from the icon, turn on notifications, then (on another device or browser) send a test enquiry from the site: a notification arrives within seconds and tapping it opens that enquiry.
  8. Clean up the test data as wanted.
- [ ] **Step 5:** Leave all changes uncommitted; report the list of changed files.
