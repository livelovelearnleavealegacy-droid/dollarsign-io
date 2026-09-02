# DollarSign.io

A real, deployable app: upload a multi-page document, add signers, place
signature/date/text fields, and send it. Signers get a **real email**
with their own signing link, and the sender pays through a **real
Stripe Checkout** — no more of this is simulated.

## What's real vs. simulated

| Piece | Status |
|---|---|
| Upload, place fields, multi-page, multi-signer | Real (client-side) |
| Pricing calculation | Real — computed server-side, not trusted from the client |
| Payment | **Real** — Stripe Checkout, confirmed via webhook |
| Envelope storage | **Real** — SQLite file on disk |
| Signing-invite email | **Real** — sent via Resend, only after payment confirms |
| Signing link / signing page | **Real** — `/sign/[envelopeId]/[signerId]` |
| "Your turn" email (sequential signing) | **Real** |
| Completion email to sender | **Real** |
| Audit trail (IP, timestamp, user agent per signature) | **Real** — captured server-side |
| Certificate of Completion page | **Real** — generated and downloadable from `/e/[id]` |
| ESIGN consent disclosure + attestation | **Real** — required and server-enforced before signing |
| Page-review enforcement | **Real** — must visit every page before submitting |
| Sender status/download page | **Real** — `/e/[envelopeId]` |

## Payments (Stripe)

The "Continue to payment" button in the editor now does this for real:

1. `POST /api/envelopes` saves the envelope with status `pending_payment`
   and a **server-computed price** (`lib/shared.js` → `calcPrice`, run
   against the actual page/signer counts — nothing from the client body
   is trusted for the amount that gets charged).
2. `POST /api/checkout` creates a real Stripe Checkout Session for that
   exact amount and returns its hosted URL. The browser is redirected
   there — card entry happens on Stripe's page, not this app's, so this
   app never touches raw card data.
3. Stripe redirects back to `/checkout/success` or `/checkout/cancel`.
   Nothing is confirmed yet at that point — a successful redirect isn't
   proof of payment, it's just where the browser landed.
4. The **webhook** (`app/api/webhooks/stripe/route.js`) is the actual
   source of truth: Stripe calls it server-to-server once the charge
   really succeeds, its signature is verified, and *only then* does the
   envelope flip to `sent` and the real signing-invite emails go out —
   in one atomic write, so there's no window where status says "sent"
   but emails haven't actually been dispatched yet.
5. `/checkout/success` polls the envelope briefly waiting for that
   webhook to land, then either shows the send confirmation, or — if
   one of the signers checked "this is me" — redirects straight into
   `/sign/[envelopeId]/[signerId]` so they can sign immediately. Self-
   signing now goes through the exact same consent/attestation/page-
   review gates as everyone else, instead of a separate code path.

### Setting it up

1. Sign up at [stripe.com](https://stripe.com), stay in **test mode**.
2. Dashboard → Developers → API keys → copy the secret key (`sk_test_…`)
   into `STRIPE_SECRET_KEY` in `.env.local`.
3. For local development, install the
   [Stripe CLI](https://docs.stripe.com/stripe-cli) and run:
   ```
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   It prints a webhook signing secret (`whsec_…`) — put that in
   `STRIPE_WEBHOOK_SECRET`. Leave this running alongside `npm run dev`
   whenever you're testing locally; without it, Stripe has nowhere to
   deliver the webhook and envelopes will sit at `pending_payment`
   forever.
4. Test with Stripe's [test card](https://docs.stripe.com/testing)
   `4242 4242 4242 4242`, any future expiry, any CVC.
5. **Going live**: switch to live-mode keys, and create a real webhook
   endpoint in the Stripe dashboard (Developers → Webhooks → Add
   endpoint) pointed at `https://yourdomain.com/api/webhooks/stripe`,
   subscribed to `checkout.session.completed`. Use the signing secret
   *it* gives you, not the CLI's.

## Audit trail & Certificate of Completion

Every time someone signs — including the sender creating the envelope —
the API route records, **server-side** (so the signer's own browser has
no say in what gets written down):

- their IP address (read from proxy headers, not client-reported)
- a server timestamp
- their user agent
- which fields they submitted

This is stored as `auditLog` on the envelope. Once every signer is done,
`/e/[id]` generates a one-page **Certificate of Completion** (see
`lib/compositePages.js` → `buildCertificatePage`) listing every signing
event, plus a SHA-256 fingerprint of the final flattened pages so any
later edit to the document would produce a different hash. It downloads
alongside the signed pages.

**What this is and isn't:** this is the same kind of audit trail
DocuSign/HelloSign attach to a completed envelope, and it gives you real
evidentiary backing — a server-recorded IP and timestamp are much harder
to dispute than "trust me." It is **not** a substitute for legal review.
Whether a signature is enforceable also depends on things this app
doesn't yet do: showing signers clear consent-to-sign language before
they start, retention/tamper-evidence policy for the stored envelope
itself (not just the flattened image), and jurisdiction-specific
requirements. Treat the certificate as strong supporting evidence, not
a legal guarantee — and get an actual lawyer's sign-off before relying
on this for anything that matters.

## Setup

1. **Install dependencies**
   ```
   npm install
   ```

2. **Get a Resend API key**
   - Sign up free at [resend.com](https://resend.com)
   - Create an API key (Dashboard → API Keys)
   - For quick local testing you can send from their shared `resend.dev`
     domain, but it will only deliver to *your own* Resend account email.
     To actually email other people, verify a domain you own
     (Dashboard → Domains — it's a few DNS records, takes minutes).

3. **Get Stripe test keys** — see "Payments (Stripe)" above for the
   full walkthrough; you need `STRIPE_SECRET_KEY` and, for local dev,
   `stripe listen` running to get `STRIPE_WEBHOOK_SECRET`.

4. **Configure environment variables**
   ```
   cp .env.example .env.local
   ```
   Fill in `RESEND_API_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET`.
   Once you've verified a Resend domain, update `EMAIL_FROM` too (e.g.
   `DollarSign.io <envelopes@yourdomain.com>`).

5. **Run it** (two terminals)
   ```
   npm run dev
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
   Open http://localhost:3000, upload a document, add a signer with an
   email address you can check, pay with the Stripe test card
   `4242 4242 4242 4242`, and the invite email should land for real.

## How the pieces fit together

- `app/page.js` — the sender app (upload → editor → Stripe Checkout)
- `app/api/envelopes/route.js` — saves a pending-payment envelope draft
  with a server-computed price
- `app/api/checkout/route.js` — creates the real Stripe Checkout session
- `app/api/webhooks/stripe/route.js` — confirms payment, flips the
  envelope to `sent`, and dispatches the real invite emails, all
  server-to-server
- `app/checkout/success/page.js` / `app/checkout/cancel/page.js` — where
  Stripe redirects back to
- `app/api/envelopes/[id]/route.js` — fetches an envelope, accepts signed
  field values, emails the next signer or the sender on completion
- `app/api/envelopes/[id]/consent/route.js` — records ESIGN consent
- `app/sign/[envelopeId]/[signerId]/page.js` — what a signer sees when
  they click the link in their email (also used for self-signing)
- `app/e/[id]/page.js` — sender-facing status page, linked from the
  completion email; lets you download the flattened pages once everyone's signed
- `lib/db.js` — storage (see note below)
- `lib/email.js` — the actual Resend integration and email templates
- `lib/stripe.js` — the Stripe client

## ESIGN Act compliance

The [ESIGN Act](https://www.congress.gov/bill/106th-congress/senate-bill/761)
(15 U.S.C. § 7001) is the U.S. federal law governing electronic signatures.
It has a handful of real requirements, and this build now covers most of
them:

| ESIGN requirement | How it's handled |
|---|---|
| Consent obtained separately from signing | `components/ConsentScreen.jsx` — every signer sees a disclosure and must explicitly consent before they can even view the document. Recorded as its own `consent` audit event. |
| Right to a paper copy / withdraw consent, disclosed | Stated on the consent screen, with the sender's contact info. |
| Clear intent to sign | A required attestation checkbox at the moment of signing ("I intend this electronic mark to be my legal signature…"), separate from just drawing a signature. Rejected server-side if missing. |
| Opportunity to review the record | Signers must visit every page of the document before the submit button unlocks — tracked and enforced, not just suggested. |
| Attribution to the signer | The audit trail (IP, timestamp, user agent, all server-recorded) established in the previous milestone. |
| Accurate, reproducible record | The Certificate of Completion + SHA-256 document hash, also from the previous milestone. |

**Enforcement is server-side, not just UI.** `PATCH /api/envelopes/[id]`
rejects a signature submission with a 403/400 if there's no `consent`
event on record for that signer, or if `attested`/`reviewedAllPages`
weren't sent — a client that skips the consent screen or attestation
checkbox gets refused, it isn't just hidden behind app state.

**What ESIGN does *not* apply to** — the editor now shows this as a
standing notice: wills and testamentary trusts, family law matters
(divorce, adoption, etc.), court orders and filings, eviction /
foreclosure / repossession notices, utility service cancellation
notices, health or life insurance cancellations, product recall
notices, and documents required to accompany the transport of
hazardous materials. None of those can be signed electronically under
ESIGN regardless of what this app does — keep them on paper.

**What this still doesn't cover, and isn't code:**
- **State law.** Most states have adopted UETA (Uniform Electronic
  Transactions Act) alongside or instead of relying on ESIGN — broadly
  similar, but check your state's specific version.
- **Identity verification.** Right now, "attribution" means "whoever
  clicked the unique emailed link." That's standard practice and
  usually sufficient, but higher-stakes documents sometimes want
  stronger verification (SMS code, ID check, knowledge-based
  authentication) — not built here.
- **Record retention policy.** ESIGN requires the record be
  *accurately reproducible* later, which this satisfies technically,
  but you still need an actual retention policy (how long you keep
  signed envelopes, backups, deletion on request, etc.) — that's a
  business decision, not a code change.
- **This is not legal advice.** Get an actual lawyer to review your
  specific use case before relying on this for anything that matters.

## Before real users touch this

- **Storage**: `lib/db.js` uses SQLite (a single file on disk). That's
  fine for local dev and single-server hosts (Railway, Render, Fly.io,
  a VPS). It is **not durable on Vercel's default serverless runtime**,
  which wipes local disk between invocations. Swap in Postgres (Vercel
  Postgres, Supabase, Neon — any of them) before deploying there. The
  three exported functions (`createEnvelope`, `getEnvelope`,
  `updateEnvelopeFields`) are the entire surface the rest of the app
  talks to, so this is a contained swap.
- **Page images as base64**: pages are currently stored as base64 data
  URLs inside the envelope JSON. Fine for an MVP with a handful of
  pages; once you're comfortable, move to real object storage (S3,
  Cloudflare R2, Vercel Blob) and store URLs instead — keeps envelope
  rows small and pages load faster.
- **Refunds/disputes**: there's no cancellation or refund flow if a
  sender pays and then wants to void an envelope before anyone signs —
  worth adding once this has real users.
- **Auth**: there's no login. Anyone with a signing link can sign;
  anyone with an envelope ID can view `/e/[id]`. Fine for a demo, not
  for production — add at minimum a per-envelope signing token check,
  and eventually real sender accounts.
- **Legal/compliance**: for this to hold up as a real e-signature
  product, you'll want an audit trail (timestamp, IP, consent
  language) to meet ESIGN Act requirements. Worth a conversation with
  an actual lawyer, not just more code.

## Deploying to Railway (recommended first production home)

This gets you live with the current SQLite setup — no database
migration needed yet. Budget about 15 minutes.

### 1. Get the code onto GitHub

Railway deploys from a GitHub repo, not a zip file. If you haven't already:
```
cd dollarsign-io
git init
git add .
git commit -m "Initial commit"
```
Create an empty repo on GitHub, then:
```
git remote add origin https://github.com/YOUR_USERNAME/dollarsign-io.git
git push -u origin main
```

### 2. Create the Railway project

1. Sign up at [railway.app](https://railway.app) (GitHub login is easiest).
2. **New Project → Deploy from GitHub repo** → pick `dollarsign-io`.
3. Railway will detect it as a Node app (via `railway.toml` /
   Nixpacks) and attempt a build immediately — it'll fail at this
   point because env vars aren't set yet. That's expected, continue.

### 3. Add a persistent volume for the database

Without this step, the SQLite file gets wiped on every redeploy.

1. In the service → **Settings → Volumes → New Volume**.
2. Mount path: `/data`
3. Any size (1GB is plenty to start).

### 4. Set environment variables

Service → **Variables** → add these:

| Variable | Value |
|---|---|
| `DB_PATH` | `/data/dollarsign.db` (matches the volume mount above) |
| `RESEND_API_KEY` | from resend.com |
| `EMAIL_FROM` | `DollarSign.io <envelopes@yourdomain.com>` (or `resend.dev` address for initial testing) |
| `STRIPE_SECRET_KEY` | start with the **test-mode** key (`sk_test_…`) |
| `STRIPE_WEBHOOK_SECRET` | see step 6 — you'll come back and set this after the first deploy |
| `APP_URL` | see step 5 — you'll come back and set this too |

Railway also sets `PORT` automatically; Next.js reads it without any
extra config.

### 5. Deploy, then get your domain

1. Trigger a deploy (Railway usually does this automatically once
   variables are saved — or hit **Deploy** manually).
2. Once it's live, **Settings → Networking → Generate Domain** gives
   you a free `something.up.railway.app` URL.
3. Copy that URL, go back to **Variables**, set `APP_URL` to it
   (include `https://`, no trailing slash), and redeploy. This matters —
   it's what gets used to build the links inside signing-invite emails.

### 6. Point Stripe's webhook at production

The Stripe CLI (`stripe listen`) was for local dev only — production
needs a real webhook endpoint:

1. [Stripe Dashboard](https://dashboard.stripe.com) → **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://your-app.up.railway.app/api/webhooks/stripe`
3. Events to send: `checkout.session.completed`
4. Copy the **signing secret** it gives you (`whsec_…`), set it as
   `STRIPE_WEBHOOK_SECRET` in Railway, redeploy.

### 7. Test the whole thing for real

Visit your Railway URL, upload a document, add a signer with an email
you can check, and pay with Stripe's test card `4242 4242 4242 4242`.
Confirm: the payment completes, the invite email actually lands, the
signing link works, and `/e/[id]` shows the right status.

### 8. Go live for real money

Once the test-mode run-through works end to end:
1. Switch Stripe to **live mode**, get live keys, update
   `STRIPE_SECRET_KEY` in Railway.
2. Repeat step 6 for a *live-mode* webhook endpoint (test and live mode
   have separate webhooks) — update `STRIPE_WEBHOOK_SECRET`.
3. Verify a real sending domain in Resend (Dashboard → Domains) if you
   haven't — the shared `resend.dev` domain only delivers to your own
   account, not real signers.
4. If you have a custom domain: **Settings → Networking → Custom
   Domain** in Railway, add the CNAME it gives you at your DNS
   provider, then update `APP_URL` to match and redeploy.

### If the build fails on `better-sqlite3`

It's a native module compiled at install time. Nixpacks (Railway's
default builder) handles this fine in almost all cases — if it doesn't,
check the build logs for a missing build-tool error and let me know
what it says.

## Moving to Vercel + Postgres later

Vercel's serverless functions don't have persistent disk, so the
SQLite approach above won't survive there. When you're ready:
1. Create a Postgres database (Vercel Postgres, Supabase, or Neon).
2. Rewrite the functions in `lib/db.js` — `createEnvelope`,
   `getEnvelope`, `updateEnvelopeFields`, `appendAuditEvent`,
   `finalizeEnvelopePayment` — to use `pg` or an ORM instead of
   `better-sqlite3`. Every other file in the app calls only these five
   functions, so nothing else needs to change.
3. Deploy on Vercel, set the same env vars (minus `DB_PATH`, plus your
   Postgres connection string) in Project Settings → Environment Variables.

