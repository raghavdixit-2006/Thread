// seed/policies.js - legal pages served by the backend (docs skill §9: legal requirement to publish policies).
import 'dotenv/config';
import { Policy } from '../models/policyModel.js';
import { logger } from '../core/logger.js';

const mk = (heading, items) => items.map((i) => `- ${i}`).join('\n');
const ref = (url) => url;

const POLICIES = [
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    category: 'privacy',
    version: '1.0.0',
    bodyMarkdown: `# Privacy Policy

**Effective:** ${new Date().toISOString().slice(0, 10)} - THREAD (operated as a demonstration storefront)

THREAD respects your privacy. This policy explains what we collect, why, and the choices you have. By using the site you accept this policy and our Terms of Service.

## 1. Data we collect

- Account data: name, email, hashed password (bcrypt; Google accounts store no password), role, and account preferences.
- Order data: items bought, delivery address snapshot, phone number, order amounts, and payment method. Cash on Delivery orders collect no payment data at all.
- OTP data: six-digit verification codes are stored as SHA-256 hashes in Redis for 10 minutes, then deleted. We never store or log bare codes.
- Technical data: IP address (for rate-limiting and abuse prevention), session identifiers (JWT IDs), and basic request logs (pino, with secrets redacted).
- Legal pages: this policy, our Refund Policy, Terms of Service, Shipping Policy, and Cookie Policy are all served by the backend so their text is auditable and versioned.

## 2. Why we process your data

- To create and secure your account (email verification via OTP, Google sign in, rate limits).
- To fulfil orders (address for delivery, order state machine, invoice records).
- To send transactional email (order confirmation, status changes, OTP codes) via Brevo.
- To prevent fraud and abuse (login throttling, OTP attempt caps).

## 3. Storage and security

- Passwords: bcrypt hashed, never stored or logged in plain text.
- Sessions: short-lived JWT access tokens (15 minutes) plus rotated refresh tokens stored as SHA-256 hashes; reusing an old token revokes the whole session family.
- Transport: served over HTTPS in production; local development runs on localhost only.
- Payments: online payments are tokenized by Razorpay - we never see your card details. Every payment is verified with an HMAC signature, and gateway webhooks are signature-checked before an order is marked paid.

## 4. Sharing

We share the minimum necessary data with: our email provider (Brevo) for transactional messages; our hosting and database providers; and Razorpay (which receives the order amount and identifier, never your password or card details). We do not sell personal data.

## 5. Your rights

- Access or correct your profile and saved addresses from your account page.
- Ask us to delete your account: ${'mailto:support@thread.dev'}.
- Withdraw consent for marketing email at any time (transactional email is not marketing).

## 6. Children

No part of THREAD is directed to children under 13, and we do not knowingly collect their data.

## 7. Contact

Write to support@thread.dev for any privacy question. This policy lives at version ${'1.0.0'}; material changes will bump the version and re-request your consent at sign-in.`,
  },
  {
    slug: 'refund-policy',
    title: 'Return & Refund Policy',
    category: 'legal',
    version: '1.0.0',
    bodyMarkdown: `# Return & Refund Policy

Orders on THREAD are covered by the following commitments.

## Eligible returns (within 7 days of delivery)

- Manufacturing defects, wrong size delivered, or damaged-in-transit items.
- Items must be unworn, with original tags and packaging, unless the defect makes that impossible.

## Non-returnable

- Innerwear, clearance items marked "final sale", and customised products.
- Orders marked **Delivered** more than 7 days ago.

## Refund flow

1. From **Orders → Order details** use Cancel while the order is *Confirmed* or *Packed* for an instant cancellation (stock is restored immediately).
2. Once an order is *Shipped* it can no longer be self-cancelled. Raise a support request with the order number.
3. Cash on Delivery orders refund by UPI or bank transfer within 5-7 working days of the returned item being collected. Orders paid online are refunded to the same payment instrument through Razorpay and confirmed by a gateway webhook.
4. Shipping fees are refunded when the return is our error (wrong or defective item).

## How to start

- Email support@thread.dev with your order number and photographs of the issue.
- We reply within one working day; the refund timeline above starts on approval.`,
  },
  {
    slug: 'terms-of-service',
    title: 'Terms of Service',
    category: 'terms',
    version: '1.0.0',
    bodyMarkdown: `# Terms of Service

Welcome. By using THREAD you agree to these terms.

## Accounts

- You are responsible for activity under your account, and for keeping your credentials private.
- One account per person; fraudulent or abusive accounts (including OTP abuse) may be suspended without notice.
- Registration requires your explicit acceptance of these terms and the Privacy Policy (we store the version you accepted).

## Purchases

- All prices are in Indian Rupees. The price you pay is the price shown at checkout plus shipping, because the server independently recomputes every checkout total from the product database - the browser never sets prices.
- An order is confirmed only after it passes server-side stock and price validation; a "placed" status in your browser does not guarantee stock if the last factor of an item was bought at the same moment.
- Cash on Delivery and online payment via Razorpay (cards, UPI, netbanking) are both available. An online order is confirmed only after the gateway signature is verified on our server.

## Cancellation & changes

- You may cancel while an order is Confirmed or Packed via the Orders page; see the Refund Policy for post-shipment cases.
- We may decline to ship where a pincode is not serviceable, or if an address is invalid.

## Site content

- Product photography is licensed from its dataset creators for demonstration use.
- THREAD owns the brand name, layouts, and copy. Do not scrape or resell site content.

## Liability

THREAD is a demonstration catalog. To the extent permitted by law, our aggregate liability for any order is limited to the order value.

## Governing law

These terms are governed by the laws of India, and disputes are subject to the jurisdiction of courts in Bengaluru, Karnataka.`,
  },
  {
    slug: 'shipping-policy',
    title: 'Shipping Policy',
    category: 'shipping',
    version: '1.0.0',
    bodyMarkdown: `# Shipping Policy

## Options & timelines

| Option | Cost | Speed |
| --- | --- | --- |
| Standard | Free above ₹2,000, otherwise ₹99 | 3-7 working days |
| Express | ₹149 | 1-2 working days in metros |

- Dispatch happens within one working day of a *Packed* status update.
- Timelines exclude Sundays and public holidays; you get an email with every status change (email comes from Brevo transactional API).

## Serviceability

- We ship to valid Indian pincodes only.
- If a pincode is not serviceable the checkout page refuses the order before any payment step (for Cash on Delivery nothing is charged; for online payments the gateway transaction is only created for serviceable addresses).

## COD notes

- Cash on Delivery has no extra fee.
- Please keep exact change if our courier does not carry UPI collection.
- Repeated refusal to accept COD parcels may restrict the option on the account.`,
  },
  {
    slug: 'cancellation-policy',
    title: 'Cancellation Policy',
    category: 'legal',
    version: '1.0.0',
    bodyMarkdown: `# Cancellation Policy

## You can cancel while the order is

- **Confirmed** - not yet packed. (instant, stock restored)
- **Packed** - not yet given to the courier. (instant, stock restored)

## You cannot cancel after

- The order is **Shipped** or **Delivered**. For shipped parcels the Refund Policy return flow applies.

## How

1. Open **Orders → Order details**.
2. Choose *Cancel order* and optionally note the reason.
3. The order state machine records the transition, stock is restored in the same database transaction, and you receive a cancellation email.

## We may cancel an order when

- An address or pincode fails validation.
- Stock turns out to be unavailable (an order without server-side confirmation is never final).
- Payment/OTP or bot behaviour flags an order as suspicious (order says "cash on delivery" but identity looks fraudulent).`,
  },
  {
    slug: 'cookie-policy',
    title: 'Cookie Policy',
    category: 'cookie',
    version: '1.0.0',
    bodyMarkdown: `# Cookie Policy

THREAD uses the smallest set of cookies that works.

## Strictly necessary (always on)

- **thread_rt** - a refresh token cookie. httpOnly, SameSite=Lax, scoped to path /api/auth/. Keeps you signed in for up to 30 days. We cannot read it from JavaScript and the browser never sends it anywhere except the auth endpoints.
- Local storage keys for your guest cart and wishlist. These are not cookies; they stay on your device until you clear them, and they merge into your account cart when you sign in.

## Not used

- advertising cookies, cross-site trackers, fingerprinting.

## Managing cookies

Deleting thread_rt logs you out of this device (other devices stay signed in until their own token expires). Clearing site data removes your guest cart too.`,
  },
];

export async function seedPolicies() {
  let updated = 0;
  for (const policy of POLICIES) {
    await Policy.updateOne(
      { slug: policy.slug },
      { $set: { ...policy, effectiveDate: new Date(), updatedAtBy: 'seeder' } },
      { upsert: true },
    );
    updated += 1;
  }
  logger.info(`policies seeded/refreshed: ${updated}`);
  return updated;
}

if (process.argv[1] && process.argv[1].endsWith('policies.js')) {
  const { ensureDns } = await import('../core/dns.js');
  const { connectDb, disconnectDb } = await import('../core/db.js');
  await ensureDns();
  await connectDb();
  await seedPolicies();
  await disconnectDb();
  process.exit(0);
}
