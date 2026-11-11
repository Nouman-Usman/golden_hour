# Foundation: Data, Authorization and Order Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Revision 2 (2026-11-12), frozen after this revision.** Incorporates the plan review: explicit DB-role/RLS boundary, payload-hashed idempotency with `ON CONFLICT`, staff-management ordering/compensation/reconciliation and owner-lock, real-Postgres concurrency suite, cancel-path locking, constraints/indexes, in-transaction program check, backup-before-migrate, and a reviewed baseline commit.

**Goal:** Build and test the server-side foundation of the admin portal and shop (full schema, roles and permissions, staff management, order placement and status transitions, enquiries in the database) so it can be reviewed before any admin or shop UI exists.

**Architecture:** Drizzle schema in `db/schema.ts` with generated migrations plus a seed migration of today's hard-coded content. Business rules live in plain server modules under `app/lib/` that take a database handle and open their own transactions. Two test suites: fast single-connection tests on PGlite (in-process Postgres) for rules, and a real-Postgres suite (temporary local Postgres 17 cluster, multiple independent connections) for concurrency and RLS. Supabase Auth provides identity only; roles and `active` live in our `staff` table and are checked on every request.

**Tech Stack:** Next.js 16.4.6, React 19.3, Drizzle ORM 0.45.4 + drizzle-kit 0.31.11, postgres (postgres-js) 3.4.7, Supabase Postgres 17 + Auth, `@supabase/ssr` 0.12.7, `@supabase/supabase-js` 2.118.0, `server-only` 0.0.1, `@electric-sql/pglite` 0.5.11 (dev), Homebrew `postgresql@17` binaries (dev, for the concurrency suite), `node:test` on Node 26 (native TypeScript).

**Spec:** `docs/superpowers/specs/2026-11-11-admin-portal-and-shop-design.md`

**Scope:** Plan 1 of 5. Later plans, written after this one is reviewed: (2) admin portal UI, (3) public shop UI, (4) editable content and page copy wired into the public site, (5) backup automation, restore runbook and launch (the point where the Supabase project becomes production).

## Already in the repo (do not recreate)

- `db/index.ts`: postgres-js client from `DATABASE_URL` (Supabase transaction pooler, port 6543, `prepare: false`), Drizzle with `casing: "snake_case"`; exports `db` (null when `DATABASE_URL` is unset).
- `drizzle.config.ts`: dialect postgresql, schema `./db/schema.ts`, out `./db/migrations`, `casing: "snake_case"`, loads `.env`.
- `db/schema.ts`: `planPeriod` enum and `plans` table (managed by these migrations; `plans.edit` covers it). `db/migrations/0000_plans.sql`, `0001_seed_plans.sql` (4 plans) are applied to Supabase.
- `package.json`: `drizzle-orm@0.45.4`, `postgres@3.4.7`, `drizzle-kit@0.31.11`; scripts `db:generate`, `db:migrate`, `db:studio`.
- `.env` (gitignored): `DATABASE_URL`. `app/lib/plans.ts` reads plans with `'use cache'` + `cacheTag("plans")`.

## Global Constraints

- Read `node_modules/next/dist/docs/` before using any Next.js API (`AGENTS.md`); Next 16 uses `proxy.ts`, not `middleware.ts` (`01-app/01-getting-started/16-proxy.md`).
- Pin new dependencies with `--save-exact` to the versions in Tech Stack.
- **Database role and RLS boundary:** Drizzle connects as Supabase's `postgres` role, which owns the tables and therefore bypasses RLS (RLS is enabled, not forced). The security boundary for app data is server-side authorization (`requirePermission`). RLS is enabled with **no policies** on every table so Supabase's Data API roles `anon` and `authenticated` can read or write nothing; this is asserted by a test. Never add `FORCE ROW LEVEL SECURITY` and never add policies in this plan.
- Money is PKR whole rupees in `integer` columns, every money column `>= 0`; display as `Rs 2,500`.
- Stock never below zero (DB check plus app check).
- Orders: New → Confirmed → Ready for pickup / Out for delivery → Completed, or Cancelled from any non-completed state. Forward-only; no line-item editing.
- Stock decrements on Confirm and restores on cancelling a Confirmed / Ready / Out order. New orders reserve nothing.
- **Lock order:** any transaction that touches stock locks the order row first, then its variant rows `FOR UPDATE` in ascending variant `id`.
- Products and variants are archived, never deleted. A variant is sellable only if neither it nor its product is archived. Order items snapshot name, variant label and unit price.
- Every order and enquiry status change writes an event row in the same transaction.
- **Idempotency:** checkout and enquiry submissions carry a client UUID key plus a server-computed SHA-256 hash of the normalized payload. Same key + same hash → original record; same key + different hash → `idempotency_conflict`. Inserts use `INSERT … ON CONFLICT (idempotency_key) DO NOTHING RETURNING`; never catch a unique violation inside a transaction.
- Roles: `owner`, `front_desk`; matrix per the spec's "Roles and permissions". No self sign-up, no auth emails; the owner sets passwords. Emails stored lowercased with a unique index on `lower(email)`.
- Service-role key is server-only: env `SUPABASE_SERVICE_ROLE_KEY`, never `NEXT_PUBLIC_`, only in files starting with `import "server-only"`.
- Server modules use relative imports with `.ts` extensions (so `node --test` can load them).
- Commits stage explicit paths only (never `git add -A`) after reviewing `git status` / `git diff --stat`; trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Never apply migrations to the Supabase project without the user's explicit go-ahead in chat (Task 9).

## Review Focus

1. Two staff, on separate connections, confirm two New orders that both want the last unit: exactly one succeeds, the other gets `insufficient_stock` naming the item, and stock ends at 0. (Task 6 PGlite + Task 8 real Postgres)
2. A checkout is sent twice with the same key at the same moment on separate connections: one order, both calls get its number; the same key with a different cart gets `idempotency_conflict`. (Task 5 + Task 8)
3. A price changes, or the product or variant is archived, between cart and checkout: the current DB price is used and archived items are `unavailable`. (Task 5)
4. A deactivated staff member with a still-valid session, or an Auth account with no staff row, tries an admin action: refused on that request. (Tasks 3, 4)
5. Two owners each try to demote or deactivate the other at the same moment: at least one active owner always remains. (Task 4 + Task 8)

---

### Task 1: Baseline commit, `Db` type spike and PGlite harness

**Files:**
- Create: `db/types.ts`, `test/db.ts`, `test/harness.test.ts`, `app/lib/errors.ts`
- Modify: `package.json`, `.gitignore`

**Interfaces:**
- Produces: `type Db` (`db/types.ts`), the handle every domain function accepts. Domain functions open their own transactions and never receive a transaction object. The spike decides the definition: first try `PgDatabase<PgQueryResultHKT, typeof schema>`; if `PostgresJsDatabase<typeof schema>` or `PgliteDatabase<typeof schema>` is not assignable to it, make domain functions generic over `D extends PgDatabase<any, typeof schema>` and export `type Db = PgDatabase<any, typeof schema>`. Record the outcome in a comment in `db/types.ts`.
- Produces: `createTestDb(): Promise<{ db: Db; close: () => Promise<void> }>` (`test/db.ts`): fresh in-memory PGlite with all migrations applied (`drizzle-orm/pglite/migrator`).
- Produces: `class DomainError extends Error { code: DomainErrorCode; fields?: Record<string, string> }` with `DomainErrorCode = "invalid_input" | "unauthenticated" | "forbidden" | "not_found" | "shop_closed" | "unavailable" | "insufficient_stock" | "invalid_transition" | "idempotency_conflict" | "misconfigured"`.

- [ ] **Step 1:** Run `git status` and `git diff --stat`; show the user the list. Add to `.gitignore`: `/media/instagram/`, `/media/google_maps/` (raw scraped source images, ~40MB, not for the repo) and `/backups/` (database dumps, Task 9). Stage explicit paths only (`app/`, `db/`, `public/`, `docs/`, `media/gym_info.md`, `breakdown.md`, `drizzle.config.ts`, `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`, `.env.example`, `next.config.ts`, `eslint.config.mjs`, `AGENTS.md`, `README.md`); confirm `.env` and `data/` are not staged; commit `feat: marketing site, GSAP motion, pricing from Supabase`.
- [ ] **Step 2:** Install `@electric-sql/pglite@0.5.11` (exact, dev). Add scripts `"test": "node --test test/*.test.ts"` and `"test:pg": "node --test test/pg/*.test.ts"`.
- [ ] **Step 3: Write the failing test** `test/harness.test.ts`: `createTestDb()` → `select count(*) from plans` is 4; `close()` resolves. Also a type-level check (in the same file) that both a `drizzle(postgres(...), { schema })` value and the PGlite `db` are accepted where `Db` is expected (`const _a: Db = pgClient; const _b: Db = pgliteClient;`, guarded so it never connects).
- [ ] **Step 4:** Run `npm test`. Expected: FAIL (`./db.ts` not found).
- [ ] **Step 5:** Implement `db/types.ts` per the spike, `test/db.ts`, `app/lib/errors.ts`.
- [ ] **Step 6:** Run `npm test && npx tsc --noEmit`. Expected: PASS, no type errors.
- [ ] **Step 7:** Commit: `test: PGlite harness and shared Db type`.

### Task 2: Full schema, constraints, indexes and content seed

**Files:**
- Modify: `db/schema.ts`
- Create: `db/migrations/0002_*.sql` (generated), `db/migrations/0003_seed_content.sql` (custom), `app/lib/settings.ts`, `test/schema.test.ts`

**Interfaces:**
- Consumes: `createTestDb`, `Db`, `DomainError`.
- Produces in `db/schema.ts` (all `.enableRLS()`, `uuid` ids `defaultRandom()` unless noted, `createdAt`/`updatedAt` `timestamptz default now()`):
  - Enums: `staffRole` `["owner","front_desk"]`; `orderStatus` `["new","confirmed","ready_for_pickup","out_for_delivery","completed","cancelled"]`; `fulfilment` `["pickup","delivery"]`; `enquiryStatus` `["new","contacted","joined","not_interested"]`; `galleryKind` `["floor","members"]`. Export `Role`, `OrderStatus`, `EnquiryStatus`.
  - `staff`: `userId uuid pk` (Supabase Auth id, no FK across schemas), `name`, `email` (stored lowercased; unique index on `lower(email)`), `role`, `active bool default true`, `createdAt`, `updatedAt`.
  - `settings`: `id integer pk` check `id = 1`; `whatsapp`, `phone`, `address`, `instagramUrl`, `mapsUrl`, `mapsEmbedUrl`, `googleRating text`, `googleReviewCount integer >= 0`, `instagramFollowers text`, `deliveryFee integer >= 0`, `shopOpen bool`.
  - `pageCopy` (`key text pk`, `value`, `updatedAt`); `timings` (`label`, `hours`, `position`); `programs` (`title`, `body`, `position`, `visible`); `coach` (`id integer pk` check `id = 1`, `name`, `bio`, `photoUrl`); `galleryImages` (`kind`, `url`, `alt`, `caption nullable`, `position`; index `(kind, position)`); `reviews` (`quote`, `author`, `featured`, `position`, `visible`).
  - `products`: `slug` unique, `name`, `description`, `category`, `images text[]`, `archived bool default false`, `position`, timestamps; index `(archived, position)`.
  - `productVariants`: `productId` FK products `on delete restrict`, `label text default ''`, `price integer >= 0`, `stock integer` with check `product_variants_stock_non_negative` (`stock >= 0`), `archived bool default false`, `position`; unique `(productId, label)`; index `(productId)`.
  - `orderNumberSeq`: `pgSequence("order_number_seq", { startWith: 1001 })`.
  - `orders`: `number text unique`, `idempotencyKey uuid unique`, `requestHash text`, `status default 'new'`, `fulfilment`, `customerName`, `customerPhone`, `address nullable`, `subtotal`, `deliveryFee`, `total` (each `>= 0`), `notes text default ''`, timestamps; index `(status, createdAt desc)`.
  - `orderItems`: `orderId` FK orders `on delete restrict`, `productId` FK products `on delete restrict`, `variantId` FK productVariants `on delete restrict`, `productName`, `variantLabel`, `unitPrice >= 0`, `quantity > 0`, `lineTotal >= 0`; index `(orderId)`.
  - `orderEvents`: `orderId` FK `on delete restrict`, `fromStatus nullable`, `toStatus`, `staffUserId uuid nullable` (null = customer), `note nullable`, `createdAt`; index `(orderId, createdAt)`.
  - `enquiries`: `idempotencyKey uuid unique`, `requestHash`, `name`, `phone`, `program`, `message`, `status default 'new'`, `notes default ''`, `createdAt`; index `(status, createdAt desc)`.
  - `enquiryEvents`: as `orderEvents` with `enquiryId`; index `(enquiryId, createdAt)`.
- Produces `getSettings(db: Db): Promise<Settings>` (`app/lib/settings.ts`): throws `DomainError("misconfigured", "Shop settings row is missing")` if the row is absent.
- Seed (`npm run db:generate -- --custom --name seed_content`): settings from today's `gym` in `app/content.ts`, `deliveryFee 250`, `shopOpen true`; 3 timings, 4 programs, coach (`Head coach`, bio = the coach paragraph in `app/page.tsx`, `/images/coach.jpg`), 6 floor + 12 members gallery rows, 3 reviews (first `featured`), verbatim from `app/content.ts`.

- [ ] **Step 1: Write the failing tests** in `test/schema.test.ts`: `rejects negative stock` (error mentions `product_variants_stock_non_negative`); `rejects negative money` (order with `total -1`); `rejects duplicate variant label per product`; `emails are unique case-insensitively` (`A@x.com` then `a@x.com` throws); `products with orders cannot be deleted` (delete throws FK error); `seeds content` (timings 3, programs 4, gallery floor 6 / members 12, reviews 3 with one featured, settings `deliveryFee` 250); `order numbers start at 1001`; `missing settings is misconfigured` (delete the row, `getSettings` throws `misconfigured`).
- [ ] **Step 2:** Run `npm test`. Expected: FAIL.
- [ ] **Step 3:** Extend the schema; `npm run db:generate -- --name foundation`; write the seed; implement `getSettings`. Read the generated SQL and confirm every check, unique, FK action and index above is present.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(db): full schema with constraints and indexes, seed current content`.

### Task 3: Permission matrix and request authorization

**Files:** Create `app/lib/permissions.ts`, `test/permissions.test.ts`, `docs/admin/authorization.md`

**Interfaces:**
- Produces: `type Permission = "orders.manage" | "enquiries.manage" | "stock.adjust" | "products.edit" | "plans.edit" | "content.edit" | "shop.settings" | "staff.manage"`; `const permissions: Record<Permission, readonly Role[]>` (owner all; `front_desk` only `orders.manage`, `enquiries.manage`, `stock.adjust`); `can(role: Role, permission: Permission): boolean`; `type StaffRecord = { userId: string; name: string; email: string; role: Role; active: boolean }`; `authorize(staff: StaffRecord | null, permission: Permission): StaffRecord` (throws `unauthenticated` for null, `forbidden` if inactive or not permitted).

- [ ] **Step 1: Write the failing tests:** full 8-permission check for `front_desk`; owner has all; inactive owner is `forbidden`; `null` is `unauthenticated`.
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** implement. **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Write `docs/admin/authorization.md`: the DB-role/RLS boundary (Global Constraints), the matrix, "every admin page, server action and route handler calls `requirePermission` first and re-reads the staff row", and a table mapping each server action in Tasks 4–7 plus planned plan 2–4 actions to its permission.
- [ ] **Step 6:** Commit: `feat(auth): role permission matrix and authorize()`.

### Task 4: Supabase Auth wiring and staff management with compensation

**Files:**
- Create: `app/lib/staff.ts`, `app/lib/auth.ts`, `app/lib/supabase-server.ts`, `app/lib/supabase-admin.ts`, `proxy.ts`, `scripts/create-owner.ts`, `scripts/reconcile-staff.ts`, `test/staff.test.ts`
- Modify: `package.json`, `.env.example`

**Interfaces:**
- Produces in `app/lib/staff.ts` (no Next imports):
  - `interface AuthAdmin { createUser(email: string, password: string): Promise<string>; deleteUser(userId: string): Promise<void>; setPassword(userId: string, password: string): Promise<void>; setBanned(userId: string, banned: boolean): Promise<void>; listUserIds(): Promise<string[]> }`
  - `createStaff(db, admin, actor, { name, email, role, password }): Promise<string>`. Order: validate → `admin.createUser` → insert staff row. If the insert fails, `admin.deleteUser(newId)` then rethrow; if that also fails, throw an error whose message includes the orphaned user id (fixed later by reconcile). An Auth user without a staff row can never act, because `getStaff` returns null.
  - `setStaffActive(db, admin, actor, userId, active): Promise<{ authSynced: boolean }>`. Deactivate: DB first (access stops on the next request), then `setBanned(true)`; a ban failure returns `authSynced: false` instead of throwing. Reactivate: `setBanned(false)` first; on failure throw and leave the row inactive.
  - `setStaffRole(db, actor, userId, role)`, `resetStaffPassword(db, admin, actor, userId, password)`.
  - Rules: actor needs `staff.manage`; `forbidden` to change your own role or deactivate yourself; `invalid_input` for a password under 10 characters or a malformed email; emails lowercased.
  - **Owner lock:** `setStaffRole` and `setStaffActive` run in a transaction that first takes `pg_advisory_xact_lock(hashtext('staff_owner_guard'))`, then counts active owners, and throws `forbidden` if the change would leave zero.
  - `reconcileStaff(db, admin): Promise<{ orphanAuthUsers: string[]; rebanned: string[] }>`: lists Auth users with no staff row (reported, not auto-deleted) and re-applies `setBanned(true)` for every inactive staff row.
- `app/lib/supabase-admin.ts` (`import "server-only"`): `supabaseAuthAdmin: AuthAdmin` using `auth.admin.createUser({ email, password, email_confirm: true })`, `deleteUser`, `updateUserById(id, { password })`, `updateUserById(id, { ban_duration: banned ? "876000h" : "none" })`, and paged `listUsers`.
- `app/lib/auth.ts` (`import "server-only"`): `getStaff(): Promise<StaffRecord | null>` (`auth.getUser()` from cookies, then a fresh staff row read on every call) and `requirePermission(permission): Promise<StaffRecord>`.
- `proxy.ts`: refreshes the Supabase session cookie for `/admin/:path*`, per `@supabase/ssr` guidance adapted to `proxy.ts`.
- Scripts (run by the user): `node --env-file=.env scripts/create-owner.ts <email> <name>` (password from env `OWNER_PASSWORD`); `node --env-file=.env scripts/reconcile-staff.ts` prints the result.
- `.env.example` adds `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

- [ ] **Step 1:** Install exact `@supabase/ssr@0.12.7`, `@supabase/supabase-js@2.118.0`, `server-only@0.0.1`.
- [ ] **Step 2: Write the failing tests** (fake `AuthAdmin` that records calls and can be told to fail a method): owner creates front desk; front desk can't create staff (no Auth calls made); `staff insert failure deletes the Auth user` (pre-insert a staff row with the same email to force the failure → `deleteUser` called with the new id); `compensation failure reports the orphan id`; `deactivate bans; ban failure returns authSynced false and staff is still forbidden`; `reactivate unbans first; unban failure leaves staff inactive`; last active owner can't be demoted or deactivated; can't change own role; short password rejected; `reconcile finds orphans and rebans inactive staff`.
- [ ] **Step 3:** `npm test` → FAIL. **Step 4:** implement. **Step 5:** `npm test && npx tsc --noEmit && npx eslint` → pass, clean.
- [ ] **Step 6:** Commit: `feat(auth): Supabase sessions, server-side roles, compensated staff management`.

### Task 5: Idempotent order placement

**Files:** Create `app/lib/orders.ts`, `app/lib/idempotency.ts`, `test/orders.place.test.ts`, `test/fixtures.ts`; modify `app/lib/enquiry.ts`

**Interfaces:**
- `normalizePkMobile(raw: string): string | null` (`app/lib/enquiry.ts`): accepts `03xxxxxxxxx`, `923xxxxxxxxx`, `+923xxxxxxxxx` with spaces or dashes; returns digits without separators (keeping a leading `+` if typed), or `null`.
- `requestHash(payload: unknown): string` (`app/lib/idempotency.ts`): SHA-256 hex of a canonical JSON (object keys sorted recursively; arrays keep order).
- `isUuid(s: string): boolean` (same file).
- `type PlaceOrderInput = { idempotencyKey: string; customerName: string; customerPhone: string; fulfilment: "pickup" | "delivery"; address?: string; items: { variantId: string; quantity: number }[] }`
- `placeOrder(db: Db, input: PlaceOrderInput): Promise<{ id: string; number: string; created: boolean }>`:
  1. `invalid_input` if `idempotencyKey` isn't a UUID.
  2. Normalize: trim strings, normalize the phone, merge duplicate `variantId` lines, sort lines by `variantId`, drop `address` for pickup. Hash the normalized payload.
  3. Look up the key: if found with the same hash → `{ created: false }`; different hash → `idempotency_conflict`.
  4. Validate → `invalid_input` with `fields` (empty name, name over 80, bad phone, delivery without address, no items, quantity not an integer ≥ 1, more than 20 lines).
  5. Transaction: `getSettings` (`shop_closed` if closed); read variants joined to products; `unavailable` if any is missing, the variant is archived, or its product is archived; `insufficient_stock` if a quantity exceeds current stock (message names product and variant); prices, names and labels from the DB; delivery fee from settings for delivery, 0 for pickup; `INSERT INTO orders … ON CONFLICT (idempotency_key) DO NOTHING RETURNING id` with number `'GH-' || nextval('order_number_seq')`. If no row comes back, end the transaction without inserting anything else, then re-run step 3 (same hash → `created: false`, different → `idempotency_conflict`). Otherwise insert the item snapshots and an event `{ fromStatus: null, toStatus: "new", staffUserId: null }`.
- `test/fixtures.ts`: `seedProduct(db, { name, price, stock, label?, archived?, variantArchived? })`, `setShopOpen(db, open)`, `newKey(): string`.

- [ ] **Step 1: Write the failing tests:** snapshot and `GH-` number (Strength 2,500 × 2 pickup → subtotal 5000, fee 0, one `new` event); delivery needs an address and adds 250; same key + same payload → same order, `created` false, 1 row; `same key, different cart → idempotency_conflict`; `non-UUID key → invalid_input`; uses the DB price after a change to 2,800; archived product → `unavailable`; archived variant on an active product → `unavailable`; duplicate lines merged (1 + 2 → 3) and quantities 0 and 1.5 → `invalid_input`; over stock → `insufficient_stock` with the product name; shop closed → `shop_closed`; phone formats (`0321 422-0245`, `+923214220245` ok; `123` → `fields.customerPhone`).
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit: `feat(shop): payload-hashed idempotent order placement`.

### Task 6: Order status transitions with consistent locking

**Files:** Modify `app/lib/orders.ts`; create `test/orders.status.test.ts`, `docs/admin/order-lifecycle.md`

**Interfaces:**
- `const nextStatuses: Record<OrderStatus, readonly OrderStatus[]>`: `new → [confirmed, cancelled]`; `confirmed → [ready_for_pickup, out_for_delivery, cancelled]`; `ready_for_pickup → [completed, cancelled]`; `out_for_delivery → [completed, cancelled]`; `completed`, `cancelled` → `[]`.
- `changeOrderStatus(db: Db, input: { orderId: string; to: OrderStatus; staffUserId: string; note?: string }): Promise<void>`, in one transaction:
  1. `SELECT … FROM orders WHERE id = $1 FOR UPDATE`; `not_found` if missing.
  2. `invalid_transition` if `to` isn't in `nextStatuses[status]`, or if it's `ready_for_pickup` on a delivery order or `out_for_delivery` on a pickup order.
  3. If the change moves stock (to `confirmed`; or to `cancelled` from `confirmed`, `ready_for_pickup` or `out_for_delivery`): lock the order's variant rows `FOR UPDATE ORDER BY id`. Confirm: any `stock < quantity` → `insufficient_stock` naming the product and variant, nothing changed; else decrement. Cancel: increment.
  4. Update `status` and `updatedAt`; insert an `orderEvents` row.

- [ ] **Step 1: Write the failing tests:** confirm decrements and logs the staff user; the last unit goes to the first confirm only, the second gets `insufficient_stock` and stays `new`; cancel after confirm restores stock; cancel from new leaves stock alone; `cancel from out_for_delivery restores stock`; no going backwards or skipping; fulfilment-specific step; completed and cancelled are final; a direct `update … stock = -1` throws.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** Write `docs/admin/order-lifecycle.md` (one page): the state diagram, the stock rules, the lock order (order → variants by id), idempotency, events.
- [ ] **Step 6:** Commit: `feat(shop): forward-only status changes with ordered row locks`.

### Task 7: Enquiries in the database

**Files:** Create `app/lib/enquiries.ts`, `test/enquiries.test.ts`; modify `app/lib/enquiry.ts`, `app/actions.ts`, `app/join-form.tsx`, `app/page.tsx`; delete `app/lib/enquiry.check.ts` (its cases move into the new test)

**Interfaces:**
- `parseEnquiry(form: FormData): { data?: { idempotencyKey: string; name: string; phone: string; program: string; message: string }; errors?: Partial<Record<"name" | "phone" | "program" | "message", string>> }`: field `program` (was `session`); same messages and limits; checks shape only.
- `getVisibleProgramTitles(db: Db): Promise<string[]>` (by `position`), for rendering the form.
- `submitEnquiry(db: Db, data): Promise<{ id: string; created: boolean }>`: same idempotency algorithm as `placeOrder` (UUID check, `requestHash`, lookup, `ON CONFLICT DO NOTHING RETURNING`, `idempotency_conflict`). Inside the transaction, `SELECT 1 FROM programs WHERE title = $1 AND visible FOR SHARE`; if there's no row, throw `invalid_input` with `fields.program`. Writes a `new` event.
- `nextEnquiryStatuses`: `new → [contacted, joined, not_interested]`; `contacted → [joined, not_interested]`; `joined`, `not_interested` → `[]`. `changeEnquiryStatus(db, { enquiryId, to, staffUserId, note? })`: `FOR UPDATE` on the enquiry, event in the same transaction.
- `enquiryWhatsAppUrl(ownerWhatsApp: string, e: { name: string; phone: string; program: string; message: string }): string` → `https://wa.me/<digits>?text=<encoded>`, with the lines `New enquiry from <name>`, `Phone: <phone>`, `Interested in: <program>` and, if present, `Message: <message>`.
- Server action `submitEnquiry` in `app/actions.ts` returns `{ ok: true, whatsappUrl }`; no `data/enquiries.jsonl` writes. `JoinForm` takes a `programs: string[]` prop, sends a hidden `idempotencyKey` (`crypto.randomUUID()` once per mount, reused on retry), and on success shows an **"Also message us on WhatsApp"** `.btn .btn-outline` link.

- [ ] **Step 1: Write the failing tests:** the old check cases rewritten for `program`; same key stored once; same key with a different message → `idempotency_conflict`; hidden program → `invalid_input` (`fields.program`); status forward-only with events; WhatsApp URL contains `wa.me/923214220245` and `Interested%20in%3A%20Personal%20training`.
- [ ] **Step 2:** FAIL. **Step 3:** implement, update the action, form and page, delete the old check. **Step 4:** `npm test && npx tsc --noEmit && npx eslint` → pass, clean.
- [ ] **Step 5:** Commit: `feat(enquiries): enquiries in Supabase with idempotency, statuses and WhatsApp hand-off`.

### Task 8: Real-Postgres concurrency and RLS suite

**Files:** Create `test/pg/server.ts`, `test/pg/concurrency.test.ts`, `test/pg/rls.test.ts`

**Interfaces:**
- `startPostgres(): Promise<{ url: string; stop: () => Promise<void> }>` (`test/pg/server.ts`): uses `TEST_DATABASE_URL` if set; otherwise `initdb` into a `mkdtemp` directory and `pg_ctl start` on a free port, binaries from `PG_BIN` (default `/opt/homebrew/opt/postgresql@17/bin`). Creates the roles `anon` and `authenticated` (NOLOGIN) and grants them `USAGE` on `public` plus `ALL` on all tables, as Supabase does by default; runs every migration with postgres-js; returns a URL for a non-superuser that owns the tables (mirroring Supabase's `postgres`).
- `connect(url): Db`: a new postgres-js client (its own connections) per simulated user.

- [ ] **Step 1: Write the tests**, each racing separate clients with `Promise.allSettled`, then asserting from a third client:
  - `same checkout key from two connections creates one order`: both results have the same `number`; `count(*)` 1.
  - `two staff confirming the last unit`: exactly one fulfilled and one `insufficient_stock`; stock 0.
  - `confirm and cancel on overlapping variants don't deadlock`: two orders sharing two variants, confirm A while cancelling confirmed B, 20 iterations, all settle within 5 s.
  - `two owners demoting each other leave one owner`: active owners ≥ 1.
  - `same enquiry key from two connections stores once`.
  - `rls: anon and authenticated see and change nothing` (`rls.test.ts`): `SET ROLE anon`, then `select count(*) from orders` → 0 and an insert into `orders` → error; same for `authenticated`; the owner role sees the rows.
- [ ] **Step 2:** `npm run test:pg`. Expected: all pass. If one fails, fix the domain code (not the test) and rerun `npm test` as well.
- [ ] **Step 3:** Commit: `test: real Postgres concurrency and RLS suite`.

### Task 9: Backup, rehearse, then apply to the Supabase project

The Supabase "Golden Hour" project isn't live yet (only the 4 seeded plans), so it's pre-launch. It becomes production in plan 5, after backup automation. Even so, back it up and rehearse first.

- [ ] **Step 1:** Ask the user for the go-ahead in chat. They add `DIRECT_DATABASE_URL` (session pooler, port 5432, for `pg_dump`/`pg_restore`) and `SUPABASE_SERVICE_ROLE_KEY` to `.env` themselves; never print either.
- [ ] **Step 2:** Back up: `pg_dump --format=custom` with the Postgres 17 binaries to `backups/pre-foundation-<date>.dump` (gitignored). Verify the backup by restoring it into a fresh local cluster (`startPostgres`) and checking that `select count(*) from plans` is 4.
- [ ] **Step 3:** Rehearse: on that restored copy, run `npm run db:migrate` (pointing `DATABASE_URL` at the local copy), then `npm test` and `npm run test:pg`. Expected: migrations apply cleanly on top of the real data; all tests pass. Show the user the new migration SQL for review.
- [ ] **Step 4:** Recovery note in `docs/admin/restore.md`: how to restore the dump with `pg_restore --clean --if-exists` to the session URL. Plan 5 replaces this with automated backups.
- [ ] **Step 5:** With the user's go-ahead, `npm run db:migrate` against Supabase. Expected: `migrations applied successfully!`
- [ ] **Step 6:** The user creates the owner: `OWNER_PASSWORD=… node --env-file=.env scripts/create-owner.ts <email> <name>` (Claude never enters passwords). Then `node --env-file=.env scripts/reconcile-staff.ts` → no orphans.
- [ ] **Step 7:** `npx next build` succeeds and the pricing section still shows plans; submit the join form on localhost with test data → the success state shows the WhatsApp button, the row is visible in `npm run db:studio`; delete the test row.
- [ ] **Step 8:** Hand over for review: `db/schema.ts` plus the migration SQL, `docs/admin/authorization.md`, `docs/admin/order-lifecycle.md`, `docs/admin/restore.md`, and the output of `npm test` and `npm run test:pg`. Plans 2–5 are written after this review.
