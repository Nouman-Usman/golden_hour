# Admin portal

Phone-first portal at `/admin` for the owner and front desk. Install it as an app ("Golden Hour Admin") from the browser.

## Who sees what

Front desk: dashboard, orders, enquiries, products (stock only), account. Owner: everything, plus plans, shop settings and staff. Every page and action checks permissions on the server; hidden links are just convenience. Full route and action table: `docs/admin/authorization.md`.

## Signing in and out

No self sign-up and no emails. The owner creates staff with a temporary password under **Staff**; staff change it under **Account**. Deactivating, demoting or resetting someone's password stamps `staff.sessions_valid_after`: any sign-in that started earlier is treated as signed out on its next request (the sign-in time comes from the verified token's `amr` claim, which doesn't change on refresh; if it's missing the session is refused). Deactivation also bans the Supabase login. If a ban fails, the portal says so: run `node --env-file=.env scripts/reconcile-staff.ts`.

## Live updates and notifications

The dashboard and the order and enquiry lists refresh every 60 seconds while visible; the tab title shows the count of new orders + enquiries.

Push notifications: turn them on per device (dashboard banner or Account). iPhone needs the app added to the Home Screen first (iOS 16.4+). A new enquiry notifies every active owner and front-desk device; content is "New enquiry · <program>" (no names or phone numbers). Notifications are sent with `after()` once the visitor's response is done, so they never slow the site. **Plan 3:** the checkout action must do the same for `placeOrder` (`notifyStaff(db, webPushSender, { kind: "order", id, number, total, fulfilment })` inside `after()` when `created`). Setup: run `node scripts/generate-vapid.ts` and put the three values in `.env`. Subscriptions a browser reports as gone are deleted automatically.

## Product images

Uploaded through `POST /admin/products/[id]/images` (not a server action: those cap bodies at 1 MB). Only real JPEG, PNG or WebP files (checked by their bytes), at most 5 MB each and 6 per product; stored in the public Supabase bucket `product-images` at `products/<productId>/<uuid>.<ext>`. The product row is locked during an upload, so the 6-image limit holds under concurrent uploads; if saving fails after the file is stored, the file is deleted. Leftovers (e.g. a failed delete) are removed by `node --env-file=.env scripts/sweep-images.ts`, which only touches unreferenced files older than an hour. Create the bucket once with `node --env-file=.env scripts/create-buckets.ts`.

## Stock

Front desk and owner set stock counts directly (row-locked; never below 0). Stock also moves when orders are confirmed or cancelled (`docs/admin/order-lifecycle.md`). Items at 3 or fewer show on the dashboard.
