# THREAD — An Editorial Clothing E-Commerce Platform

**Project Report**

**Submitted in partial fulfilment of the requirements for the award of the degree of**

**Bachelor of Engineering (Computer Science & Engineering)**

---

| Field | Detail |
|---|---|
| **Project title** | THREAD — An Editorial Clothing E-Commerce Platform |
| **Guide** | Dr. Durgesh Srivastava |
| **Designation** | Professor |
| **Department** | Computer Science & Engineering (CSE) |
| **Institute** | Chitkara University Institute of Engineering and Technology (CUIET) |
| **University** | Chitkara University, Punjab |
| **Team** | Raghav Dixit (2410990667), Rahul Gheek (2410990669), Manav Mandal (241099xxxx), Sameer Aggarwal (2410990704) |
| **Academic session** | 2026–27 |

---

## Declaration

We hereby declare that the work presented in this report, titled **"THREAD — An Editorial Clothing E-Commerce Platform"**, is our own original work. It has been carried out under the supervision of **Dr. Durgesh Srivastava, Professor, Department of Computer Science & Engineering, CUIET, Chitkara University, Punjab**. The work has not been submitted elsewhere for the award of any other degree or diploma.

---

## Acknowledgement

We express our sincere gratitude to our guide, **Dr. Durgesh Srivastava, Professor, Department of Computer Science & Engineering, CUIET, Chitkara University, Punjab**, for continuous guidance, technical review and encouragement throughout the project. We also thank the department faculty and our peers for their feedback during review presentations, and the open-source community whose libraries made this build possible.

---

## Abstract

THREAD is a full-stack e-commerce platform for a small, editorial-style clothing label. It is built as two independently deployable applications: a React single-page storefront and staff console, and a stateless Node.js REST API backed by MongoDB and Redis. The platform covers the complete commercial path a customer takes — browsing a filtered catalogue, choosing a colour and size with real variant stock, maintaining a persistent bag and wishlist, applying coupons, placing cash-on-delivery or online orders, tracking order status, writing verified reviews and managing saved addresses — together with a separate staff portal for order fulfilment and catalogue management.

The engineering focus of the project is correctness and restraint rather than feature volume. Prices and stock are computed and validated on the server, never in the browser. Money is handled in integer paise. Online payments are confirmed only after a server-side HMAC verification of the gateway signature, and a payment that is abandoned or fails leaves the order parked in an explicit unpaid state instead of being silently marked paid. Access control is enforced twice: React route guards shape the user interface, and every privileged API route independently enforces role-based access control. Sessions use a short-lived JWT access token in memory plus a rotating, httpOnly refresh cookie, so no token is ever exposed to JavaScript or stored in `localStorage`.

The storefront uses a paper-and-ink editorial design language: serif display type, generous whitespace, flat surfaces, Bootstrap Icons only, no emoji, and accessibility rules applied as engineering constraints (16 px body text, 44 px touch targets, 12 px minimum labels, semantic landmarks, keyboard-operable controls, URL-encoded filter state). The result is a deployable, testable storefront rather than a demo: the client is hosted on Vercel, the API on a Botkeep (Pterodactyl) container with MongoDB Atlas and managed Redis, and the complete purchase journey — including a Razorpay test-mode card payment — has been exercised end to end on the live deployment.

**Keywords:** e-commerce, MERN, REST API, JWT, RBAC, Razorpay, MongoDB, Redis, React, accessibility, cloud deployment.

---

## Table of Contents

1. Introduction
2. Problem Statement and Objectives
3. Literature and Technology Review
4. System Analysis and Requirements
5. System Design and Architecture
6. Implementation
7. Security Design
8. Testing and Validation
9. Deployment
10. Results and Screenshots
11. Limitations and Future Scope
12. Conclusion
13. References

---

## 1. Introduction

Small clothing labels sell through social media and messaging apps long after they outgrow that channel. The usual next step — a hosted storefront template — forces the label into someone else's design system, hides the stock truth behind a plugin, and charges a commission on every order. THREAD is an attempt to build the alternative: a storefront that looks like the label, owns its data, and treats money and stock with the discipline of a payments product rather than the informality of a catalogue page.

The project is deliberately scoped to one vertical (apparel with colour × size variants) so that the hard parts can be done properly: variant-level stock, server-derived pricing, coupon rules, order state transitions, and a payment flow that cannot be tricked into marking an unpaid order as paid.

### 1.1 Scope

**In scope**

- Public catalogue with search, category, size, colour, price and rating filters encoded in the URL.
- Product detail with gallery, variant matrix, per-variant stock, related pieces and reviews.
- Customer accounts with email OTP verification, password login, session refresh and password reset.
- Persistent bag (guest bag merges into the account bag on sign-in) and wishlist.
- Checkout with saved addresses, delivery options, coupons, GST, cash on delivery and Razorpay online payment.
- Order history and order detail for the customer; order queue and status transitions for staff.
- Staff console with catalogue CRUD, image upload, dashboard statistics and low-stock inventory.
- Versioned store policies (privacy, terms, refund, shipping, cancellation, cookie).

**Out of scope**

- Multi-vendor marketplace, warehousing, and logistics-provider integration.
- Native mobile applications.
- Automated returns/refund settlement beyond status tracking.

---

## 2. Problem Statement and Objectives

### 2.1 Problem statement

A small label needs a storefront that (a) represents the brand rather than a template, (b) never oversells stock that does not exist, (c) never records a payment that the gateway did not confirm, and (d) lets a two-person team run orders and products without a developer. Off-the-shelf templates fail at least one of these: stock is a single number per product, payments are trusted from the browser, and catalogue edits require code changes.

### 2.2 Objectives

1. Deliver a complete purchase journey — discovery to delivered order — on a single responsive web client.
2. Model stock at the **variant** level (colour × size) and validate it on the server at add-to-bag and at order placement.
3. Derive every monetary value (line totals, discounts, shipping, GST, grand total) on the server from integer paise, and treat the client as a renderer only.
4. Implement online payment with server-side signature verification, idempotent order creation and an explicit unpaid state.
5. Enforce role-based access control on both the client and the API.
6. Apply an editorial visual identity with measurable accessibility constraints.
7. Deploy both halves to production hosting with an explicit origin allowlist and health checks.

---

## 3. Literature and Technology Review

### 3.1 Architecture pattern

The system follows a **three-tier, API-first architecture**: a browser client, a stateless HTTP API, and stateful backing services (document database, key-value store, object storage, payment gateway, SMTP). The API holds no session state in process memory, which is what allows a single container to be restarted at any time without logging users out (sessions are reconstructed from a signed refresh cookie).

### 3.2 Technology choices

| Layer | Technology | Reason |
|---|---|---|
| Client framework | React 19 + Vite | Component reuse, fast dev server, small production bundle |
| Client state | Redux Toolkit + RTK Query | One cache for server data, tag-based invalidation, fewer bespoke hooks |
| Routing | React Router 7 | Nested routes, guards, URL as the state container for filters |
| Styling | Hand-written CSS with design tokens | Full control of the editorial identity; no framework defaults leaking through |
| Icons | Bootstrap Icons | Single icon set, no emoji, consistent stroke weight |
| API | Node.js + Express 5 | Minimal, well-understood HTTP layer, large middleware ecosystem |
| Validation | Zod | One schema per route boundary; parse, don't validate |
| Database | MongoDB + Mongoose | Variant-heavy product documents fit a document model |
| Cache / ephemeral | Redis (ioredis) | OTP storage, rate-limit counters, session rotation records |
| Auth | JWT access token + rotating refresh cookie | Stateless verification, revocable refresh, no tokens in JS storage |
| Payments | Razorpay (test mode) | UPI + cards + net-banking in one integration; signed webhooks |
| Images | Cloudinary + local fallback | No filesystem writes required in production |
| Email | Nodemailer + SMTP | OTP and order lifecycle notifications |
| Logging | Pino + pino-http | Structured JSON logs with request ids |
| Rate limiting | express-rate-limit + Redis store | Per-IP budgets with an in-process fallback |
| Hosting | Vercel (client), Botkeep/Pterodactyl (API) | Static CDN for the SPA, container for the API |

### 3.3 Prior art

Shopify and similar platforms solve this problem commercially but impose templates, transaction fees and plugin-level stock logic. Open-source MERN storefronts exist in abundance, but most treat price as a client value, store a single stock integer per product, and mark orders paid on a client callback. THREAD borrows their familiar structure while deliberately inverting those three decisions.

---

## 4. System Analysis and Requirements

### 4.1 Actors

| Actor | Description | Capabilities |
|---|---|---|
| Guest | Unauthenticated visitor | Browse, search, filter, local bag, sign in/register |
| Customer | Verified account holder | Guest capabilities + persistent bag, wishlist, checkout, orders, reviews, addresses |
| Staff (admin) | Shop operator | Everything in a separate portal: order queue, status transitions, catalogue CRUD, inventory, policies |

### 4.2 Functional requirements

**FR-1 Catalogue** — list, search, filter (category, size, colour, price band, rating), sort, paginate; product detail by slug with variants and stock.

**FR-2 Accounts** — register with email OTP verification, log in, refresh session silently, log out, reset password by OTP, edit profile, manage addresses.

**FR-3 Bag** — add/update/remove line items keyed by SKU, merge a guest bag on sign-in, block quantities beyond available stock.

**FR-4 Wishlist** — toggle products, list saved products, reflect state across pages.

**FR-5 Checkout** — saved or new address, delivery option, coupon, GST, payment method selection, idempotent order placement.

**FR-6 Payments** — create a gateway order for the server-computed amount, open the gateway, verify the signature server-side, verify the amount, handle abandonment and failure.

**FR-7 Orders** — customer list and detail with status timeline; staff queue filtered by status with legal transitions and an audit trail.

**FR-8 Admin** — dashboard statistics, catalogue list including hidden pieces, create/edit/delete products, per-variant stock, image upload, low-stock view, policy editing.

**FR-9 Policies** — versioned, effective-dated policy pages linked from the footer.

### 4.3 Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | Body text ≥ 16 px, labels ≥ 12 px, interactive targets ≥ 44 px |
| NFR-2 | No emoji anywhere in the interface; Bootstrap Icons only |
| NFR-3 | All filter/search/query state reflected in the URL and shareable |
| NFR-4 | Semantic landmarks, labelled controls, visible focus, keyboard operability |
| NFR-5 | Business logic isolated in services/hooks, not in JSX |
| NFR-6 | Money stored and computed as integer paise |
| NFR-7 | Every privileged route authorised server-side |
| NFR-8 | Request bodies validated against schemas at the boundary |
| NFR-9 | Structured logs with a per-request id |
| NFR-10 | Health endpoint exposing dependency status without leaking secrets |

---

## 5. System Design and Architecture

### 5.1 High-level architecture

```
                     ┌──────────────────────────────┐
                     │  Browser (React SPA, Vite)   │
                     │  Vercel CDN + SPA rewrite    │
                     └───────────────┬──────────────┘
                                     │ HTTPS / JSON
                                     │ (credentials: include)
                     ┌───────────────▼──────────────┐
                     │  THREAD REST API (Express)   │
                     │  Node.js container, Botkeep  │
                     │  helmet · cors · pino · zod  │
                     └───┬────────┬────────┬────────┘
                         │        │        │
              ┌──────────▼─┐  ┌───▼────┐  ┌▼─────────────┐
              │ MongoDB    │  │ Redis  │  │ Razorpay     │
              │ Atlas      │  │ OTP,   │  │ orders,      │
              │ (durable)  │  │ limits │  │ verify, hook │
              └────────────┘  └────────┘  └──────────────┘
                         │
              ┌──────────▼─────────┐   ┌──────────────────┐
              │ Cloudinary (media) │   │ SMTP (OTP, mail) │
              └────────────────────┘   └──────────────────┘
```

### 5.2 Client structure

```
client/src
├── App.jsx                 route table + guards + session bootstrap
├── pages/                  one component per route
├── components/
│   ├── layout/             Header, Footer, shell
│   ├── common/             RequireAuth, RequireAdmin, ErrorNote, Toast, Spinner
│   └── features/           AdminProducts, WishlistHeart, ReviewList, …
├── hooks/                  session sync, URL filter state, viewport helpers
├── services/               RTK Query slices (products, cart, orders, wishlist, …)
│   └── axiosBaseQuery.js   single axios instance, credentials + 401 replay
├── store/                  Redux store and slice registration
└── styles/                 design tokens, layout, page styles
```

Route table:

| Path | Access | Page |
|---|---|---|
| `/` | Guest + Customer | Editorial home |
| `/shop` | Guest + Customer | Catalogue with URL filters |
| `/product/:slug` | Guest + Customer | Product detail |
| `/cart` | Guest + Customer | Bag |
| `/auth` | Guest only | Sign in / register / verify / reset |
| `/wishlist` | Customer | Saved pieces |
| `/checkout` | Customer | Address, payment, summary |
| `/orders`, `/orders/:id` | Customer | Order history and detail |
| `/profile` | Customer | Profile and addresses |
| `/policies`, `/policies/:slug` | Public | Policy index and page |
| `/admin/login` | Guest only | Staff sign-in |
| `/admin` | Staff | Order console |
| `/admin/products` | Staff | Catalogue list |
| `/admin/products/new` | Staff | Create piece |
| `/admin/products/:slug/edit` | Staff | Edit piece |
| `*` | Public | Not-found |

### 5.3 API surface

| Group | Endpoints |
|---|---|
| Health / config | `GET /api/health`, `GET /api/config` |
| Auth | `POST /api/auth/register`, `/verify`, `/resend-otp`, `/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`, `GET /api/auth/me` |
| Products | `GET /api/products`, `GET /api/products/featured`, `/categories`, `GET /api/products/:slug`, `GET /api/products/:slug/related` |
| Cart | `GET /api/cart`, `POST /api/cart/items`, `PATCH /api/cart/items`, `DELETE /api/cart/items/:sku`, `DELETE /api/cart`, `POST /api/cart/merge` |
| Wishlist | `GET /api/wishlist`, `GET /api/wishlist/states`, `POST /api/wishlist/toggle` |
| Orders | `POST /api/orders`, `GET /api/orders`, `GET /api/orders/:id`, `GET /api/orders/:id/timeline` |
| Payments | `POST /api/payments/razorpay/order`, `POST /api/payments/razorpay/verify`, `POST /api/payments/razorpay/webhook` |
| Coupons / reviews | `GET /api/coupons/:code`, `GET /api/reviews/:slug`, `POST /api/reviews/:slug` |
| Users | `GET/PATCH /api/users/me`, address CRUD |
| Policies | `GET /api/policies`, `GET /api/policies/:slug` |
| Admin | `POST /api/admin/login`, `GET /api/admin/dashboard`, `GET /api/admin/products`, `POST /api/admin/products`, `GET/PATCH/DELETE /api/admin/products/:slug`, `GET /api/admin/inventory`, `GET /api/admin/orders`, `PATCH /api/admin/orders/:id/status`, `GET/PATCH /api/admin/policies` |

### 5.4 Data model

| Collection | Key fields |
|---|---|
| `users` | name, email, phone, passwordHash, role, isEmailVerified, authProvider, addresses[], termsVersion |
| `products` | title, slug, description, images[], category, brand, price, mrp, discountPercent, variants[{sku,size,color,stock,price}], isActive, isFeatured, ratings |
| `carts` | userId, items[{productId, sku, qty}], updatedAt |
| `wishlists` | userId, productIds[] |
| `orders` | orderNumber, userId, items[], shippingAddress, pricing{…}, payment{method,status,gatewayOrderId,paymentId}, status, timeline[] |
| `coupons` | code, type, value, minSubtotal, maxDiscount, expiresAt, isActive |
| `reviews` | productId, userId, rating, title, body, isVerifiedPurchase |
| `policies` | slug, title, version, effectiveAt, body (markdown) |

### 5.5 Order and payment state model

```
Order created ──► Payment pending ──► Paid ──► Confirmed ──► Packed ──► Shipped ──► Delivered
     │                  │
     │                  └──► Failed / Abandoned (order stays unpaid, stock released)
     └──► Cancelled ──► Refunded
```

Cash-on-delivery orders move straight from *created* to *confirmed*. Online orders move to *confirmed* only after `/verify` (or the webhook) returns a valid signature and a matching amount.

### 5.6 Design system

| Token | Value | Use |
|---|---|---|
| Paper | `#f6f2ea` | Page background |
| Ink | `#1b1a17` | Primary text |
| Muted ink | `#6b665c` | Secondary text |
| Rule | `#dcd5c7` | Hairlines, dividers |
| Display face | Cormorant Garamond | Headings, product titles |
| Text face | Instrument Sans | Body, controls, labels |
| Radius | 0–2 px | Flat editorial surfaces |
| Shadow | none / 1 px hairline | Elevation through rules, not blur |

Constraints applied as rules: body ≥ 16 px, labels ≥ 12 px with letter-spacing, targets ≥ 44 px, icon-only controls carry `aria-label`, focus is always visible, and every list/table has a text alternative.

---

## 6. Implementation

### 6.1 Session lifecycle

1. On boot the SPA calls `POST /api/auth/refresh` with the httpOnly `thread_rt` cookie.
2. The API validates the refresh record in Redis, rotates the token, sets a new cookie, and returns a short-lived access token plus the public user.
3. The access token lives **only** in Redux memory and is attached by the axios base query.
4. A `401` triggers one replay: refresh, then retry the original request.
5. Logout clears the Redis record and the cookie.

Guests receive a `401` on the first refresh; the client treats it as "continue as guest" and renders the storefront. The interface shows `CHECKING YOUR SESSION` while this resolves so guards never flash the wrong state.

### 6.2 Catalogue and search

The product list query is built from URL search params, so every filter combination is a shareable link and the back button behaves. Search runs against a MongoDB text index for relevance plus a word-start prefix pass on title, brand, category and colour names, so typing `jack`, `blue` or `THREAD` all resolve. No external search service is required: an earlier Elasticsearch read model was removed after measurement showed it added a network dependency and an index-sync surface without improving this catalogue's result quality.

### 6.3 Variant stock and pricing

- A product owns an array of variants, each with a SKU, size, colour, stock and optional price override.
- The product page derives the selectable matrix from that array; sold-out combinations are disabled.
- `POST /api/cart/items` re-reads the variant, rejects quantity above stock, and stores the SKU only.
- Checkout recomputes every line from the database: unit price, discount, line total, shipping, GST and grand total. The client-supplied total is never trusted.
- Placing an order decrements variant stock inside a transaction; a failed payment path releases it.

### 6.4 Bag merging

A guest bag lives in `localStorage` keyed by SKU. On sign-in the client posts it to `/api/cart/merge`; the server unions quantities, caps at available stock, and returns the authoritative bag. The local copy is then cleared, so a shared device does not leak one customer's bag into another's session.

### 6.5 Razorpay integration

```
Client                        API                         Razorpay
  │  POST /payments/razorpay/order                          │
  ├──────────────────────────►│  create order (amount,     │
  │                           ├───────────────────────────►│
  │   {gatewayOrderId, key}   │                            │
  │◄──────────────────────────┤                            │
  │  open checkout modal ─────────────────────────────────►│
  │                           │                            │
  │   {paymentId, signature}  │                            │
  ├──────────────────────────►│  HMAC-SHA256 verify        │
  │                           │  compare amount + currency │
  │                           │  mark paid, confirm order  │
  │   order confirmed         │                            │
  │◄──────────────────────────┤                            │
```

If the customer closes the modal, the order remains in *payment pending* with stock held for a bounded window; the reconciliation path (webhook / expiry job) either confirms or releases it. A signature mismatch is logged and rejected — the order is never marked paid on the strength of a client callback.

### 6.6 Admin console

- **Order console** — 30-day counters, status filters, one-click legal transitions, customer name/phone/address inline.
- **Catalogue** — list including hidden pieces, search, delete with confirmation.
- **Product form** — gallery (direct Cloudinary upload or pasted URLs), variant matrix, per-size stock, price override, MRP plus discount where the **server** derives the selling price.
- **Inventory** — low-stock view across variants.
- **Policies** — versioned editing with effective dates.

### 6.7 Accessibility and interface rules

- Skip link, `main` landmark with `tabIndex={-1}`, one `h1` per page, ordered headings.
- Icon-only buttons carry `aria-label`; toggles expose `aria-pressed`; live regions announce bag and wishlist changes.
- Forms use real `label` elements, inline `role="alert"` errors and `aria-invalid`.
- Focus is moved to the first invalid field on submit.
- Motion is limited to state transitions; no autoplaying carousels.

---

## 7. Security Design

| Control | Implementation |
|---|---|
| Password storage | `@node-rs/bcrypt`, cost 10, never reversible |
| Access token | JWT, short TTL, held in memory only |
| Refresh token | Random 256-bit value, httpOnly cookie, Redis-backed record, rotated on every use, path-scoped to `/api/auth` |
| OTP | 6 digits, SHA-256 + pepper, 10-minute TTL, 5 attempts, resend cooldown, per-email and per-IP daily caps |
| RBAC | `adminRequired` on every `/api/admin/*` route; admin credentials rejected by the customer login with `403 ADMIN_PORTAL_ONLY` |
| Rate limits | General 300/5 min; auth 30/10 min; OTP verify 10/10 min; refresh 60/10 min; writes 100/5 min; admin login 10/10 min; uploads 30/10 min; payments 30/10 min — all per IP, Redis-backed with an in-process fallback |
| Input validation | Zod schemas at body, query and params boundaries; `.strict()` where extra keys are a risk |
| Headers | Helmet: HSTS, `X-Content-Type-Options`, referrer policy, frame options |
| CORS | Explicit origin allowlist from `CORS_ORIGINS`, credentials on, unknown origins rejected with `CORS_REJECTED` |
| Idempotency | `Idempotency-Key` accepted on order creation to prevent duplicate orders on retry |
| Webhooks | Raw-body HMAC verification before any state change |
| Logging | Structured request logs with ids; secrets and tokens never logged |
| Error shape | Uniform `{success:false,error:{code,message}}`; internal details stay server-side |

---

## 8. Testing and Validation

### 8.1 Strategy

Testing was layered: schema-level checks, service-level checks against a local database, HTTP-level checks against the running API, and scripted end-to-end browser journeys against the deployed site.

### 8.2 Executed checks

| Area | Check | Result |
|---|---|---|
| Health | `GET /api/health` reports mongo, redis, search, razorpay | Pass — `healthy`, `search: "mongo"` |
| Search | `q=jacket`, `jack`, `rah`, `blue`, `THREAD` each return the matching piece; `zzz` returns none | Pass |
| Auth | Guest refresh returns `401` and the storefront continues as guest | Pass |
| Auth | Customer login issues an access token and a refresh cookie | Pass |
| Auth | Admin login on the customer endpoint returns `403 ADMIN_PORTAL_ONLY` | Pass |
| Catalogue | Variant stock reflected in the size selector; sold-out sizes disabled | Pass |
| Bag | Add to bag persists per account; badge count updates | Pass |
| Wishlist | Heart toggles and survives navigation | Pass |
| Checkout | Address saved, totals recomputed server-side (₹9,000 + 5% GST = ₹9,450) | Pass |
| Orders | COD order placed, appears in history and detail with a timeline | Pass |
| Admin | Dashboard, catalogue list, create and edit forms render with live data | Pass |
| Access control | Customer visiting `/admin` is redirected out; staff visiting `/shop` are redirected to the console | Pass |
| Payments | Razorpay test card journey | See §10.6 |
| Deployment | Deep links such as `/admin/login` and `/product/:slug` resolve on Vercel | Pass — SPA rewrite |
| Deployment | API boots on the panel container without a manual install step | Pass |

### 8.3 Defects found and fixed during the project

| Defect | Fix |
|---|---|
| Catalogue search depended on an Elasticsearch node that did not exist in production | Removed the read model; Mongo text + prefix search is the only path |
| Deep links returned Vercel's own `404 NOT_FOUND` | Added `client/vercel.json` SPA rewrite to `index.html` |
| Container booted but could not install dependencies | Root manifest + `postinstall` + pre-start dependency guard + `SERVER_PORT` fallback |
| API crashed when the Elasticsearch key was absent | Made the key optional, then removed it entirely |
| Refresh cookie rejected across sites in production | Cookie must be issued with `SameSite=None; Secure` in production (see §11) |

---

## 9. Deployment

### 9.1 Topology

| Component | Host | Notes |
|---|---|---|
| Client | Vercel | Static build of `client/`, SPA rewrite, environment-driven API base URL |
| API | Botkeep (Pterodactyl container) | `npm start` runs `node src/server.js`, panel-injected `SERVER_PORT` honoured |
| Database | MongoDB Atlas | Managed replica set, transaction support for order placement |
| Cache | Managed Redis | OTP, rate-limit counters, refresh records |
| Media | Cloudinary | Signed uploads from the admin form; local disk only as a development fallback |
| Mail | SMTP provider | OTP, verification and order notifications |

### 9.2 Configuration

The API reads configuration exclusively from environment variables and fails fast with a readable message when a required key is missing. Required in production: `MONGODB_URI`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `CLOUDINARY_*`, `SMTP_*`, `CORS_ORIGINS`.

`CORS_ORIGINS` accepts a JSON array or a comma-separated list; wildcards are ignored in production so a misconfiguration cannot silently open the API.

### 9.3 Operational checks

- `GET /api/health` — dependency status, no secrets, safe for uptime probes.
- Boot log — single line per subsystem: mongo, redis, mail transport, image storage, CORS origins, listening port.
- Structured logs — every request logs method, path, status, duration and a request id.

---

## 10. Results and Screenshots

Screenshots were captured from the live deployment at 1440 px width, full page, with real data: a signed-in customer with a populated bag and order history, and staff credentials for the admin console.

### 10.1 Storefront

**Home** — editorial hero, featured pieces, category rail, brand story.

![Home page](../images/home.png){width=6.3in}

**Shop** — URL-driven filters, honest variant stock, sort control.

![Shop page](../images/shop.png){width=6.3in}

**Product detail** — gallery, colour and size matrix, per-variant stock, reviews, related pieces.

![Product detail](../images/product-detail.png){width=6.3in}

### 10.2 Bag and wishlist

![Bag](../images/cart.png){width=6.3in}

![Wishlist](../images/wishlist.png){width=6.3in}

### 10.3 Checkout and orders

![Checkout](../images/checkout.png){width=6.3in}

![Order confirmation](../images/order-confirmation.png){width=6.3in}

![Orders](../images/orders.png){width=6.3in}

![Order detail](../images/order-detail.png){width=6.3in}

### 10.4 Account

![Sign in](../images/auth-sign-in.png){width=6.3in}

![Register](../images/auth-register.png){width=6.3in}

![Profile](../images/profile.png){width=6.3in}

### 10.5 Policies and error states

![Policies](../images/policies.png){width=6.3in}

![Privacy policy](../images/policy-privacy.png){width=6.3in}

![Not found](../images/not-found.png){width=6.3in}

### 10.6 Payment gateway

![Checkout — pay online](../images/checkout-pay-online.png){width=6.3in}

![Razorpay gateway](../images/razorpay-gateway.png){width=6.3in}

### 10.7 Staff console

![Admin console](../images/admin-console.png){width=6.3in}

![Admin catalogue](../images/admin-products.png){width=6.3in}

![New piece](../images/admin-product-new.png){width=6.3in}

![Edit piece](../images/admin-product-edit.png){width=6.3in}

---

## 11. Limitations and Future Scope

### 11.1 Known limitations

1. **Cross-site refresh cookie.** The client and API are on different sites, so the refresh cookie must be issued with `SameSite=None; Secure` in production. With the current `Lax` setting, browsers reject the cookie and a signed-in customer is logged out on refresh or when opening a deep link. The fix is a one-line attribute change plus a redeploy.
2. **Single-currency, single-country.** GST and shipping rules are India-specific and hard-coded into the pricing service.
3. **Catalogue media.** Older products may still reference local `/uploads/...` paths that do not exist on the serverless host; they must be re-uploaded to Cloudinary.
4. **No automated test suite in CI.** Validation is scripted but runs on demand.
5. **Stock reservation window.** An abandoned payment holds stock until the reconciliation sweep; there is no customer-facing "resume payment" screen yet.

### 11.2 Future scope

- Automated integration and end-to-end tests in CI, with seeded fixtures and a mocked gateway.
- Webhook-first payment confirmation with replay-safe event storage.
- Returns and refund workflow with partial refunds.
- Size-guide and fit-feedback capture to reduce returns.
- Multi-currency and international shipping.
- Server-side rendering or hydration for catalogue pages to improve first paint and sharing previews.
- Image pipeline: responsive `srcset`, AVIF/WebP negotiation, blur placeholders.
- Observability: OpenTelemetry traces across the API and gateway callbacks.

---

## 12. Conclusion

THREAD demonstrates that a small label can own its commerce stack without owning a payments team. The project delivers the complete journey — discovery, variant-accurate stock, persistent bag, checkout, verified payment, order fulfilment and catalogue operation — on a three-tier architecture that is cheap to host, simple to reason about, and safe with money and identity.

The engineering value is in the decisions that are invisible in a screenshot: prices derived on the server from integer paise, stock enforced at the variant level, payments confirmed only by signature verification, authorisation enforced twice, sessions kept out of JavaScript, and a rate-limit budget on every sensitive door. Those decisions are what separate a storefront that can take an order from one that can be trusted with one.

The remaining work is narrow and known: correct the production cookie attributes, move legacy media to object storage, and put the validation scripts into CI so every future change is checked the same way it was checked here.

---

## 13. References

1. React documentation — https://react.dev
2. Redux Toolkit and RTK Query — https://redux-toolkit.js.org
3. React Router — https://reactrouter.com
4. Express — https://expressjs.com
5. Mongoose — https://mongoosejs.com
6. MongoDB Manual — https://www.mongodb.com/docs
7. Redis documentation — https://redis.io/docs
8. Razorpay Payments API and webhooks — https://razorpay.com/docs
9. JSON Web Tokens (RFC 7519) — https://datatracker.ietf.org/doc/html/rfc7519
10. OWASP Application Security Verification Standard — https://owasp.org/www-project-application-security-verification-standard/
11. MDN Web Docs — HTTP cookies, SameSite, CORS — https://developer.mozilla.org
12. W3C Web Content Accessibility Guidelines 2.2 — https://www.w3.org/TR/WCAG22/
13. Zod — https://zod.dev
14. Cloudinary documentation — https://cloudinary.com/documentation
15. Helmet — https://helmetjs.github.io
