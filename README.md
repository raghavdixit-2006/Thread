# THREAD - Full-Stack E-Commerce Platform (MERN)

Clothing store rebuilt on the target stack: React 18 (Vite) + Redux Toolkit / RTK Query on the front,
Express + Mongoose + Redis on the back. The original server-rendered demo is preserved untouched in
`bee1/` and still runs on port 3003 with `npm start`.

## Repos

| Path    | What it is                                    | Port |
| ------- | --------------------------------------------- | ---- |
| `client`| Vite + React SPA (redux toolkit, RTK Query)   | 5173 |
| `server`| Express API + Mongoose + Redis                | 5000 |
| `server/infra` | one-shot Mongo replica-set bootstrap (`server/infra/init-mongo.js`, for hand-run Mongo) | -    |
| `bee1`  | Legacy demo store (preserved)                 | 3003 |

## Quickstart

```bash
# 1. data services live in the CLOUD (or run by hand) - nothing to compose:
#    MONGO_URI = MongoDB Atlas SRV URI (or a local replica set via server/infra/init-mongo.js)
#    REDIS_URL = any cloud/private Redis
#    Elasticsearch = OPTIONAL infra: when its node is unreachable the API serves
#    q search + facets straight from Mongo (see Search in What works today)
#    EMAIL = MAIL_HOST/PORT/USERNAME/PASSWORD/FROM (SMTP) or BREVO_API_KEY; with
#    neither set, dev prints emails to the server console instead of sending

# 2. API
cd server
npm install
cp .env.example .env     # MONGO_URI / REDIS_URL / JWT secrets - .env is gitignored
npm run dev              # http://localhost:5000

# 3. storefront
cd ../client
npm install
npm run dev              # http://localhost:5173
```

> Boot troubleshooting: `querySrv ECONNREFUSED` means Node's resolver is pinned to a dead loopback
> address (usually a stale proxy/VPN); the server probes it and auto-switches to `DNS_SERVERS`
> (default `1.1.1.1,8.8.8.8`). `MONGO_URI` must include the database name (e.g. `.../thread`) -
> without it Mongoose connects to `test` and the shop lists zero products.

Test accounts: `asha@test.com` / `pass1234` (customer) · `thread.admin@gmail.com` / `Admin@12345` (admin, seeded by `npm run seed` - the seeder is a single admin upsert, no catalog/test users).
Seed settings live in `server/.env.example`.

## Deploy

The repo root is an npm project that owns the API install, so a panel that runs
`npm install` at `/home/container` no longer fails with `ENOENT: package.json`.

- `package.json` (root): `npm start` runs the API, `postinstall` installs `server/` dependencies.
- `package-lock.json` (root): empty by design; the API lock lives in `server/package-lock.json`.
- `server/src/core/env.js`: `PORT` falls back to the panel's `SERVER_PORT` when `PORT` is unset.

### API on Botkeep (Pterodactyl)

Startup command, either of these:

```bash
npm start
```

```bash
cd server && npm install && npm start
```

Node 20 or newer is required. Set the environment in the panel (or upload `server/.env`):

```env
NODE_ENV=production
MONGO_URI=mongodb+srv://...
REDIS_URL=rediss://...
ELASTIC_NODE=https://...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
CORS_ORIGINS=https://your-app.vercel.app
CLIENT_URL=https://your-app.vercel.app
```

`ELASTIC_NODE` is optional: without it the API serves search from the Mongo fallback.
Razorpay, SMTP and Cloudinary keys are optional and degrade gracefully when absent.

### Client on Vercel

| Setting | Value |
| --- | --- |
| Root directory | `client` |
| Build command | `npm run build` |
| Output directory | `dist` |
| `VITE_API_URL` | `https://your-botkeep-host` |

The API's `CORS_ORIGINS` must contain the exact Vercel origin. See `docs/CORS.md`.


## What works today

- Catalogue with categories, variants (sku/size/color/stock), slugs, faceted shop with sort and pagination
- Shop filters: independent multi-select category chips behind two toolbar icons (funnel with an active-count badge, cross to clear all) plus sizes, ratings, multi-price bounds and search facets
- Search (`q`) runs WITH or WITHOUT Elasticsearch: the ES read model (typo fuzziness, prefix autocomplete, facet aggregations) when reachable, otherwise the same response contract served from Mongo (weighted text index + title/brand prefix pass + aggregation facets; no fuzziness there) - the API boots and the whole shop stays usable with zero ES, and `/api/health` reports which engine served
- Auth: JWT access token in memory, single-use rotating refresh tokens (httpOnly cookie), silent refresh,
  parallel-tab safe rotation chain, reuse detection with family revocation; guests-only `/auth` (signed-in
  users bounce to the deep-linked `next` target) and an always-visible Sign out control
- Auth UX: mirror of the server's zod rules runs client-side first, so a bad register/login shows
  field-level messages (rules + terms checkbox) with no dead 422 round-trip; a genuine server 422's
  `details` render as human text ("accepted: You must accept the Terms and Privacy Policy") instead of
  `[object Object]`; an expired refresh mid-session bounces to `/auth` with a "Your session ended" notice
- Cart with guest-to-user merge on sign-in, per-user subject-keyed localStorage cache, and a live server badge; wishlist; wishlist-heart on product cards
- Profile essentials: editable name + phone (10-digit Indian mobile), address book, order history;
  change-password is out of the profile on purpose
- Checkout: saved addresses, delivery options, coupon validation, server-recomputed price breakup
  (GST 5%, free standard shipping over Rs 2,000, money handled in paise)
- Orders: COD placement (idempotent - client key honoured, server UUID minted as fallback), order detail,
  cancel flow with a confirm guard, order history; admin cancel/refund restore stock and refund marks
  `paymentStatus: refunded`
- Admin console at `/admin` (`RequireAdmin` guard; `adminRequired` re-checks server-side): incoming-order queue with
  customer essentials (name/phone/email/address/timeline), one-click status transitions, 30-day stats
- Staff portal split (9 Nov): admins no longer browse the storefront like customers. `POST /api/admin/login`
  (own stricter 10-attempts/10-min limiter) serves the dedicated portal page at `/admin/login`, while
  `POST /api/auth/login` rejects admin accounts with 403 `ADMIN_PORTAL_ONLY` - the role gate fires only after
  the password verifies, so the rejection cannot be used to discover which emails are admins - and the
  storefront form shows a link to the portal. Signed-in admins are bounced off every storefront route
  (home, shop, product, cart, wishlist, checkout, orders, profile) straight to `/admin`, see a stripped
  staff header (brand + who + sign out, no retail nav), and staff sign-out reloads into `/admin/login`
- Product management on its own pages (9 Nov): `/admin/products` (catalogue list incl. hidden pieces, search,
  delete with confirm), `/admin/products/new` (dedicated add page) and `/admin/products/:slug/edit` (dedicated
  edit page loading the piece through `GET /api/admin/products/:slug`, available in any state incl. hidden);
  the staff header gains Console / Catalogue links. The form reads: dual-source image gallery - direct upload
  (`POST /api/products/admin/uploads`: multipart, magic-byte content sniffing, 4MB cap, JPEG/PNG/WebP/AVIF)
  to **Cloudinary** when `CLOUDINARY_*` is configured (absolute `https://res.cloudinary.com/...` URLs,
  signed server-side) with a local `server/uploads` fallback when it is not - or pasted image URLs - with
  a main + side ordering (`images[0]` renders as the main image everywhere in the shop), and variant colour
  groups, each with its own price (blank inherits the product price) plus a stock count per size and an
  optional per-size price override. Colours/sizes taxonomy and catalogue-unique SKUs are derived
  server-side; duplicate (colour,size) rows and foreign SKUs are rejected
- Static landing photography (9 Nov): hero slides, category tiles and the story image live in
  `client/public/landing` (served at `/landing/*`) and are independent of the catalogue, admin uploads
  and Cloudinary. Replacing those files changes the landing page without touching product data
- Admin-entered discounts (9 Nov): the form takes MRP + a discount % (0-90, blank = none) and the
  SERVER derives the selling price (`round(mrp x (100 - pct) / 100)`) - no selling price is sent or
  trusted from the client; colour-group and per-size prices stay absolute rupees (blank inherits the
  derived price). The % off shows live in the form, on admin list rows, cards and the PDP (the
  selected variant's price wins, so its badge is computed against that money); legacy rows created
  before the field keep their % off on first edit (integer-% rounding can shift such a price by a
  rupee when saved)
- Variant colour photos (9 Nov): the ordered gallery stays the single store of images; each photo can
  be LINKED to a variant colour (one photo per colour, tagging again moves the link, renaming or
  removing a colour remaps/unlinks automatically). The PDP shows the linked photos for the selected
  colour - a single linked photo keeps the legacy 3-crop view - and cart/order lines show the
  colour's photo first; unlinked gallery photos remain shared by every colour
- Payments (9 Nov): checkout offers COD or Razorpay (UPI, cards, netbanking). An online order parks
  unpaid - stock reserved, cart cleared - until the payment verifies: the checkout callback must pass
  an HMAC the browser cannot forge, and a signature-checked raw-body webhook duplicates the path
  server-side with idempotent replay handling (failed payments stay retryable from the order page,
  the admin panel stops treating "delivered" as cash collected). Money stays in paise; the key
  secret never leaves the server
- Responsive navbar: hamburger drawer under 1024px, Bootstrap Icons only, no emojis
- A UI polish pass on top of the editorial design language: inputs at 16px (no mobile zoom-on-focus),
  visible keyboard focus rings, 44px chip/toggle targets, serif-monogram fallback behind every product
  media frame (cards + PDP, also covers broken images), legible card prices, two-line title clamps,
  gentle card hover lift (reduced-motion respected), centered auth card

## API contract

Envelope responses: `{ success, data, meta }`; errors always
`{ success: false, error: { code, message, details } }`.

## Deliberately out (rest of phase 2)

Invoice PDFs, review flows, refund automation (Razorpay refunds stay dashboard-manual for now).
Transactional email is implemented: SMTP via `MAIL_*` (nodemailer), Brevo REST via
`BREVO_API_KEY` as fallback, console logging in dev when neither is set. Online payments landed
9 Nov - COD default,
Razorpay beside it - with the live test-mode purchase round still pending a reachable server.
Elasticsearch is an OPTIONAL read model: live when its node is up, replaced by the in-server Mongo
fallback (same response contract) when it is not; Mongo is the source of truth either way.
Architecture decisions and their reasoning: `bee1/agents/project.md` (sections 3.6 and 8).
