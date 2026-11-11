# Golden Hour: admin portal and public shop

Date: 2026-11-11
Status: design, conditionally approved; review requirements added 2026-11-12

## Why

Golden Hour Fitness Planet (Saddar Cantt, Lahore) has a new marketing website (this repo). Today almost everything on it is hard-coded in `app/content.ts`, membership prices already come from Supabase, and join enquiries are written to a local `data/enquiries.jsonl` file that won't survive deployment. The owner wants:

1. To run **everything on the website** from an admin portal instead of asking a developer.
2. A **public shop** to sell supplements (protein, creatine, etc.) to members and the public.
3. To hear about new orders and enquiries **on WhatsApp**.

Success: the owner and front desk can change prices, timings, photos and products themselves; customers can order supplements for cash on delivery or gym pickup; no order or enquiry is ever lost.

## Goals

- Admin portal with login and two roles (owner, front desk).
- Every piece of website content editable from the portal.
- Public shop: browse, product page, cart, guest checkout, confirmation.
- Orders and join enquiries stored in the database and managed in the portal.
- WhatsApp hand-off initiated by the customer after checkout / enquiry.

## Non-goals

- Online payments (JazzCash, Easypaisa, cards). Cash on delivery and pickup only.
- Customer accounts, order history for customers, wishlists, reviews on products.
- Automated WhatsApp sending (Meta Cloud API, CallMeBot). Explicitly rejected in favour of customer-sent messages.
- Member management (attendance, membership expiry, fee collection). Possible later project, not this one.
- Delivery outside Lahore, courier integrations, delivery tracking.
- Multi-language (Urdu) content.

## Anti-goals (would be a failure even if it works)

- An order or enquiry that exists only in a WhatsApp chat and not in the portal.
- Front-desk staff able to change prices, plans or site content.
- Anyone able to sign up for an admin account on their own.
- The public site getting slower or losing the existing GSAP scroll experience.
- Admin UI that's hard to use on a phone (the owner will mostly use it on a phone at the gym).

## Constraints (already decided)

- **Stack**: existing Next.js 16 (App Router, `cacheComponents: true`), React 19, Tailwind v4, GSAP + Lenis on the public site. Read `node_modules/next/dist/docs/` before using Next APIs; this version differs from older docs (see `AGENTS.md`).
- **Database**: Supabase Postgres (project "Golden Hour", ref `lioftiyujtqyqbduqjje`, ap-southeast-1), accessed through **Drizzle ORM** (`db/schema.ts`, `db/index.ts`, migrations in `db/migrations`, `npm run db:generate` / `db:migrate`). Connection string in `.env` as `DATABASE_URL` (transaction pooler, `prepare: false`).
- **RLS**: tables are created with RLS enabled and no public policies; all access goes through the Next.js server via Drizzle. Keep it that way.
- **Auth**: Supabase Auth, email + password. No self sign-up and **no auth emails**: Supabase's built-in mailer only reaches the project team and is heavily rate-limited, so the owner creates staff accounts in the portal with a temporary password (server-side, service role), shares it in person, and can reset it. Staff can change their own password once logged in. The first owner account is created once during setup.
- **Files**: product and site images in Supabase Storage.
- **Caching**: public reads use `'use cache'` + `cacheTag(...)` + `cacheLife('hours')`; admin writes call `updateTag(...)` so changes show immediately (pattern already in `app/lib/plans.ts`).
- **Brand**: matte black `#141210`, brass `#b8913f` / `#e6c77e`, bone `#ece5d6`; Big Shoulders (display) + Archivo (body); button system in `app/globals.css` (`.btn`, `.btn-brass`, `.btn-action`, `.btn-pair`).
- **Currency**: PKR, whole rupees (integers), shown as `Rs 2,500`.
- **Owner's WhatsApp**: +92 321 4220245 (currently `gym.whatsapp` in `app/content.ts`; becomes an editable setting).

## Roles and permissions

| Capability | Owner | Front desk |
|---|---|---|
| View / update orders (status changes, notes) | ✓ | ✓ |
| View / update join enquiries | ✓ | ✓ |
| Toggle product in/out of stock, adjust stock count | ✓ | ✓ |
| Create / edit / archive products, change product prices | ✓ | ✗ |
| Edit membership plans and prices | ✓ | ✗ |
| Edit site content (timings, programs, coach, photos, reviews, contact) | ✓ | ✗ |
| Shop settings (delivery fee, shop open/closed) | ✓ | ✗ |
| Create / remove staff accounts, reset their passwords | ✓ | ✗ |

Permissions are enforced on the server in every server action, not only hidden in the UI.

## Admin portal: what's editable

| Area | Currently | Becomes |
|---|---|---|
| Membership plans | `plans` table (exists) | CRUD + reorder + show/hide; existing schema |
| Timings | `timings` in `content.ts` | Rows: label (e.g. "Women"), hours text, order |
| Programs ("Ways to train") | `programs` in `content.ts` | Rows: title, body, order |
| Head coach | Hard-coded in `page.tsx` | Single record: name, titles/bio text, photo |
| Floor photos | `floor` in `content.ts` (6 images) | Ordered gallery: image, caption, alt text |
| Member photo wall | `members` in `content.ts` (12 images) | Ordered gallery: image |
| Reviews | `reviews` in `content.ts` (3) | Rows: quote, author, featured flag (one shown big), order |
| Contact & business info | `gym` in `content.ts` | Settings: phone, WhatsApp number, address, Instagram, map link, Google rating + review count, Instagram follower count |
| Shop settings | none | Delivery fee (PKR), shop open/closed toggle |
| **Page copy** (owner's decision: everything) | Hard-coded in `app/page.tsx` | Every headline, intro line and button label on the public pages: hero line, marquee phrases, "House of beasts" stack words + brush line + subtitle, section headings ("The floor", "Coached by a champion", "Ways to train", "Timings", "Membership", "Your first visit is on us"), section intros, CTA labels, footer tagline, SEO title/description |

Everything hard-coded today is seeded into the database from current values, so the site looks identical on day one.

**Page copy rules** (protect the layout and animations):
- Edited in the portal grouped by page section, in page order, each field showing where it appears.
- Each field has a max length sized to its slot (e.g. statement stack words ~10 chars each, giant display headings ~30); the editor shows a live character count and blocks saving over the limit.
- Plain text only; no HTML or markdown.
- Missing/empty value falls back to the seeded default, so the page never renders blank.
- GSAP split-text effects must keep working with edited text (split runs on whatever text is rendered).
- Structural content (number of stack words = 3, number of marquee phrases = 2) stays fixed; only the words change.

## Public shop

Routes (builder may adjust names): `/shop`, `/shop/[slug]`, `/cart` (or a drawer), `/checkout`, `/order/[number]`.

- **Product**: name, slug, description, category (e.g. Protein, Creatine, Pre-workout, Accessories), images (one or more), base price, active flag.
- **Variants**: optional per product (flavour and/or size), each with its own price and stock count. A product without options has a single default variant.
- **Listing**: grid with category filter; out-of-stock items shown as such, not hidden.
- **Cart**: stored in the browser (no account). Quantities capped at available stock.
- **Checkout (guest)**: name, mobile number (same Pakistani mobile validation as the join form, `app/lib/enquiry.ts`), fulfilment choice:
  - **Pickup at gym**: free.
  - **Cash on delivery**: Lahore only, address required, flat delivery fee from settings.
- **Order placement**: server re-checks prices and stock (never trust the cart), creates the order with a short human-friendly number (e.g. `GH-1042`), stores line items with the price at time of order. Idempotent: see "Hardening requirements".
- **Confirmation page**: order number, items, total, fulfilment, and a primary **"Send order on WhatsApp"** button: `wa.me/<owner number>?text=<prefilled order summary>`.
- **Shop closed** setting: listing still visible, checkout disabled with a short message.
- Website nav and pages get a Shop link; the shop uses the same brand and button system. Scroll animations on shop pages are optional and lighter than the home page.

## Orders

- Status flow: **New → Confirmed → Ready for pickup / Out for delivery → Completed**, or **Cancelled** from any non-completed state.
- **Stock**: decremented when staff mark an order **Confirmed** (staff confirm COD orders by phone first, since fake COD orders are common); restored if a confirmed order is cancelled. *(Builder-check decisions, my call:)*
  - Stock can never go below zero (database check). If an order can't be covered when staff press Confirm, confirmation is blocked with a clear message naming the short item; staff cancel and call the customer.
  - "Available" for the cart cap and checkout re-check = current stock count (New orders are not reserved).
  - Status only moves forward, or to Cancelled. No moving back, no editing line items; mistakes are fixed by cancelling and placing a new order.
  - Status changes that touch stock run in a single transaction with row locks.
- Order list in portal: newest first, filter by status, prominent count of New; order detail shows customer, items, total, address, fulfilment, internal notes, status buttons, and a "Call" / "WhatsApp customer" link.

## Join enquiries

- Move from `data/enquiries.jsonl` to a database table (same fields: name, phone, session, message, created time) plus status **New → Contacted → Joined / Not interested** and internal notes.
- After submitting, the success message adds an **"Also message us on WhatsApp"** button with the enquiry pre-filled.
- *(My call:)* The form's "I want to join" choices come from the visible Programs. The enquiry stores the chosen program's title as text (snapshot), so renaming or deleting a program never breaks old enquiries; the server validates against currently visible programs. `app/lib/enquiry.check.ts` is updated accordingly.

## Notifications

- Customer-initiated WhatsApp only (see above). No server-side sending.
- Portal shows counts of New orders and New enquiries on its home screen so nothing is missed if the customer never taps the WhatsApp button.
- WhatsApp is a courtesy, not a delivery guarantee, so the portal is the source of truth: the admin home and the orders/enquiries lists refresh themselves about once a minute, and New counts appear in the nav badge and the browser tab title (e.g. `(3) Golden Hour Admin`).

## Hardening requirements (from design review, 2026-11-12)

### 1. Checkout idempotency
- The checkout page generates a random idempotency key (UUID) once per checkout attempt and sends it with the order.
- `orders.idempotency_key` is unique. Placing an order with a key that already exists returns the original order instead of creating a second one, so a dropped connection plus retry, or a double tap, can never create duplicates.
- The same applies to join enquiries.

### 2. Authorization and sessions
- **Role storage**: roles (`owner`, `front_desk`) live in a server-controlled table keyed by the Supabase Auth user id (plus an `active` flag). Never in user-editable metadata, never trusted from the client or from JWT claims alone.
- **Every protected read and write** (every admin page, server action and route handler) re-checks on the server: valid session, user exists in the roles table, `active = true`, and role allows the action (matrix above). Hiding UI is never the control.
- **No escalation**: nobody can change their own role; only an owner can create, edit, deactivate or reset staff. The last active owner can't be demoted or deactivated.
- **Removal is immediate**: deactivating a staff member sets `active = false` (checked on every request, so access stops on their next click), and also signs them out by revoking their sessions / banning the user in Supabase Auth.
- **Service-role key** (needed to create users and reset passwords) is server-only: never `NEXT_PUBLIC_`, never imported into client components, used only inside owner-only server actions.

### 3. Product archival and immutable order snapshots
- Products and variants are never hard-deleted; "delete" becomes **archive** (hidden from the shop, still in the database). Archived items can be restored.
- Order line items store a snapshot at time of order: product name, variant label (flavour/size), unit price, quantity, line total, plus the product/variant ids for reference. Old orders display from the snapshot even if the product is renamed, repriced or archived.
- Order totals (subtotal, delivery fee, total) are stored on the order, not recalculated.

### 4. Order audit history
- `order_events` table: order, previous status, new status, staff user, timestamp, optional note. One row per status change (including creation and cancellation), written in the same transaction as the change.
- Order detail shows this history ("Confirmed by Ali, 12 Nov 3:14 pm").
- Same pattern for enquiry status changes (`enquiry_events`).

### 5. Backup and recovery
- **Requirement**: automated daily database backups with at least 7 days' retention, and a written, tested restore procedure in `docs/`.
- **Recovery objective**: lose at most one day of orders/enquiries (RPO 24h); be back online within a few hours (RTO ~4h). Appropriate for a single gym with low order volume.
- **How** (owner's choice before launch; verify current Supabase plan features at the time): Supabase's paid plan includes daily backups; on the free plan, add a scheduled `pg_dump` (e.g. nightly GitHub Action) to off-site storage. Uploaded images in Supabase Storage are included in the plan.
- Do one test restore into a scratch project before launch and note the result in the restore doc.

## Admin UX

- Lives under `/admin`, behind login; `noindex`.
- Mobile-first: usable one-handed on a phone. Same brand colours, but plain and functional: no scroll animations.
- Home screen: New orders, New enquiries, low-stock products, quick links.

## Left to the builder

- Exact table/column names and Drizzle schema details (following the existing `plans` pattern).
- Route names, component structure, cart storage mechanism, admin layout.
- How Supabase Auth sessions are wired into Next.js 16 (check bundled Next docs and current Supabase SSR guidance) and how the owner/staff role is stored.
- Image upload UX and resizing.
- Order number format, as long as it's short and readable aloud.
- Seed/migration strategy for moving current hard-coded content into tables.
- Test coverage, in line with the repo's existing lightweight check style (`app/lib/enquiry.check.ts`).

## Calls made by the designer (check these)

- No reservation of stock for New orders; stock moves only on Confirm / Cancel. Confirm is blocked when stock is short.
- Orders are forward-only; no line-item editing.
- Join form options follow the editable Programs; enquiries store a text snapshot.
- Page-copy fields have per-slot length limits and fall back to seeded defaults.
- Structural counts in animated sections (3 stack words, 2 marquee phrases) stay fixed.
- Design review (2026-11-12) added: checkout/enquiry idempotency keys, server-controlled roles with per-request checks and immediate deactivation, archive-not-delete with order snapshots, `order_events` / `enquiry_events` audit history, daily backups with a tested restore (RPO 24h, RTO ~4h), self-refreshing admin counts.

## Next step

Before any UI is built, the build plan's first milestone produces, for review: the full database schema and migration plan, the authorization matrix mapped to server actions, and the transactional order-confirmation / cancellation design (locking, stock checks, event writes, idempotency).
