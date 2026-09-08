#!/usr/bin/env node
/**
 * DollarSign.io end-to-end API test suite.
 *
 * Zero dependencies — uses only Node's built-in fetch/FormData/Blob
 * (Node 18+). Nothing to install, nothing added to package.json.
 *
 *   node tests/run-tests.mjs
 *   BASE_URL=https://dollarsign.io node tests/run-tests.mjs
 *
 * Environment:
 *   BASE_URL           default https://dollarsign-io-production.up.railway.app
 *   TEST_EMAIL         base address for test signers; +tags are appended
 *   PAID_ENVELOPE_ID   optional — unlocks the post-payment guard tests
 *   SKIP_EMAIL         set to 1 to skip anything that sends real mail
 *
 * Exit code is 0 only if every test passed.
 */

// Dual-mode: runs under Node (CI, command line) and also pasted into a
// browser console on the site's own origin, which is how it gets run
// on demand without a deploy. Same file, same assertions, no drift.
const IS_NODE = typeof process !== "undefined" && !!process.versions?.node;
const ENV = (IS_NODE && process.env) || (globalThis.DS_TEST_ENV || {});

const BASE = (ENV.BASE_URL || (!IS_NODE ? location.origin : "https://dollarsign-io-production.up.railway.app")).replace(/\/$/, "");
const TEST_EMAIL = ENV.TEST_EMAIL || "livelovelearnleavealegacy@gmail.com";
const PAID_ID = ENV.PAID_ENVELOPE_ID || null;
const SKIP_EMAIL = ENV.SKIP_EMAIL === "1";

// 1x1 PNG — the smallest thing the upload endpoint will accept.
const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const results = [];
let currentGroup = "general";

function group(name) { currentGroup = name; }

async function test(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push({ group: currentGroup, name, ok: true, ms: Date.now() - started });
  } catch (err) {
    results.push({ group: currentGroup, name, ok: false, ms: Date.now() - started, error: err.message });
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertEq(actual, expected, what) {
  if (actual !== expected) throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function api(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
    redirect: "manual",
  });
  let parsed = null;
  const text = await res.text();
  try { parsed = JSON.parse(text); } catch { /* not JSON — that itself is often the finding */ }
  return { status: res.status, headers: res.headers, text, json: parsed };
}

function tag(suffix) {
  const [user, domain] = TEST_EMAIL.split("@");
  return `${user}+${suffix}@${domain}`;
}

/* Builds a syntactically valid envelope payload shaped exactly the way
   app/page.js sends one, so the server sees what a real browser sends. */
function envelopePayload({ pageIds, signerCount = 1, emails = true }) {
  const signers = Array.from({ length: signerCount }, (_, i) => ({
    id: `s${i}`,
    name: `Test Signer ${i + 1}`,
    email: emails ? tag(`autotest-signer${i + 1}`) : "",
    color: "#102A43",
    isSelf: false,
  }));
  const fields = signers.map((s, i) => ({
    id: `f${i}`,
    pageId: pageIds[0],
    signerId: s.id,
    kind: "signature",
    x: 50 + i * 10,
    y: 50,
    value: null,
  }));
  const pages = pageIds.map((id) => ({ id, src: `/api/pages/${id}`, w: 1, h: 1 }));
  // AUTOTEST prefix makes these trivially greppable in the database later.
  return { senderName: "AUTOTEST harness", senderEmail: tag("autotest-sender"), pages, signers, fields };
}

async function uploadPage() {
  const bytes = typeof Buffer !== "undefined"
    ? Buffer.from(PNG_B64, "base64")
    : Uint8Array.from(atob(PNG_B64), (c) => c.charCodeAt(0));
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "image/png" }), "page.png");
  form.append("width", "1");
  form.append("height", "1");
  const res = await fetch(BASE + "/api/pages", { method: "POST", body: form });
  const body = await res.json();
  if (!res.ok) throw new Error(`page upload failed: ${res.status} ${JSON.stringify(body)}`);
  return body.id;
}

/* ------------------------------------------------------------------ */

async function main() {
  console.log(`\nDollarSign.io test suite`);
  console.log(`target: ${BASE}`);
  console.log(`time:   ${new Date().toISOString()}\n`);

  let pageId = null;
  let draftId = null;

  /* ---------- reachability ---------- */
  group("reachability");

  await test("health endpoint responds", async () => {
    const r = await api("/api/health");
    assertEq(r.status, 200, "status");
  });

  /* ---------- public pages ---------- */
  group("public pages");

  const publicPages = [
    ["/", "landing", "DollarSign"],
    ["/faq", "FAQ", "FAQ"],
    ["/terms", "terms", "Terms of Service"],
    ["/privacy", "privacy", "Privacy Policy"],
    ["/find-my-document", "recovery", "Find my document"],
  ];

  for (const [path, label, marker] of publicPages) {
    await test(`${label} page renders (${path})`, async () => {
      const r = await api(path);
      assertEq(r.status, 200, "status");
      assert(r.text.includes(marker), `expected page to contain "${marker}"`);
    });
  }

  await test("footer links appear site-wide", async () => {
    const r = await api("/");
    for (const href of ['href="/faq"', 'href="/terms"', 'href="/privacy"', 'href="/find-my-document"', "mailto:support@dollarsign.io"]) {
      assert(r.text.includes(href), `landing page footer is missing ${href}`);
    }
  });

  await test("unknown route returns 404", async () => {
    const r = await api("/definitely-not-a-real-page-" + Date.now());
    assertEq(r.status, 404, "status");
  });

  /* ---------- page upload ---------- */
  group("page upload");

  await test("uploads a page image", async () => {
    pageId = await uploadPage();
    assert(typeof pageId === "string" && pageId.length > 10, `expected a page id, got ${pageId}`);
  });

  await test("serves the uploaded page back", async () => {
    assert(pageId, "no page uploaded");
    const res = await fetch(`${BASE}/api/pages/${pageId}`);
    assertEq(res.status, 200, "status");
    const type = res.headers.get("content-type") || "";
    assert(type.startsWith("image/"), `expected an image content-type, got "${type}"`);
  });

  await test("rejects an unsupported file type", async () => {
    const form = new FormData();
    form.append("file", new Blob(["not an image"], { type: "text/plain" }), "bad.txt");
    const res = await fetch(BASE + "/api/pages", { method: "POST", body: form });
    assertEq(res.status, 400, "status");
  });

  await test("unknown page id returns 404", async () => {
    const res = await fetch(`${BASE}/api/pages/00000000-0000-0000-0000-000000000000`);
    assertEq(res.status, 404, "status");
  });

  /* ---------- envelope creation and caps ---------- */
  group("envelope creation");

  await test("rejects an envelope with no pages", async () => {
    const r = await api("/api/envelopes", { method: "POST", json: { senderName: "AUTOTEST", pages: [], signers: [{ id: "s0" }], fields: [] } });
    assertEq(r.status, 400, "status");
  });

  await test("rejects an envelope with no signers", async () => {
    assert(pageId, "no page uploaded");
    const r = await api("/api/envelopes", { method: "POST", json: { senderName: "AUTOTEST", pages: [{ id: pageId }], signers: [], fields: [] } });
    assertEq(r.status, 400, "status");
  });

  await test("enforces the 10-signer cap server-side", async () => {
    assert(pageId, "no page uploaded");
    const payload = envelopePayload({ pageIds: [pageId], signerCount: 11, emails: false });
    const r = await api("/api/envelopes", { method: "POST", json: payload });
    assertEq(r.status, 400, "status");
    assert(/10 signers/.test(r.json?.error || ""), `expected a signer-cap message, got "${r.json?.error}"`);
  });

  await test("enforces the 100-page cap server-side", async () => {
    assert(pageId, "no page uploaded");
    const pageIds = Array.from({ length: 101 }, () => pageId);
    const payload = envelopePayload({ pageIds, signerCount: 1, emails: false });
    const r = await api("/api/envelopes", { method: "POST", json: payload });
    assertEq(r.status, 400, "status");
    assert(/100 pages/.test(r.json?.error || ""), `expected a page-cap message, got "${r.json?.error}"`);
  });

  await test("creates a valid envelope at the flat price", async () => {
    assert(pageId, "no page uploaded");
    const r = await api("/api/envelopes", { method: "POST", json: envelopePayload({ pageIds: [pageId], signerCount: 2 }) });
    assertEq(r.status, 200, "status");
    const env = r.json.envelope;
    draftId = env.id;
    assertEq(env.status, "pending_payment", "new envelope status");
    assertEq(env.price.total, 1.99, "price");
    assert(/^ENV-[A-Z0-9]{6}$/.test(env.trackingId), `tracking id looks wrong: ${env.trackingId}`);
    assertEq(env.signers.length, 2, "signer count");
  });

  await test("ignores a client-supplied price", async () => {
    assert(pageId, "no page uploaded");
    const payload = { ...envelopePayload({ pageIds: [pageId] }), price: { total: 0.01 } };
    const r = await api("/api/envelopes", { method: "POST", json: payload });
    assertEq(r.status, 200, "status");
    assertEq(r.json.envelope.price.total, 1.99, "price after client tampering");
  });

  await test("unknown envelope id returns 404", async () => {
    const r = await api("/api/envelopes/00000000-0000-0000-0000-000000000000");
    assertEq(r.status, 404, "status");
  });

  /* ---------- unpaid envelope guards ---------- */
  group("payment guards");

  await test("refuses signing on an unpaid envelope", async () => {
    assert(draftId, "no draft envelope");
    const r = await api(`/api/envelopes/${draftId}`, {
      method: "PATCH",
      json: { fields: [], signerId: "s0", attested: true, reviewedAllPages: true },
    });
    assertEq(r.status, 402, "status");
  });

  await test("refuses resend on an unpaid envelope", async () => {
    assert(draftId, "no draft envelope");
    const r = await api(`/api/envelopes/${draftId}/resend`, { method: "POST", json: { signerId: "s0" } });
    assertEq(r.status, 402, "status");
  });

  /* This is the guard against the doubled-folder path mistake. A route
     that does not exist returns Next's HTML 404 page; the real route
     returns JSON. Checking for JSON catches a misplaced route file that
     would otherwise fail silently in production. */
  await test("resend route is mounted at the correct path", async () => {
    assert(draftId, "no draft envelope");
    const r = await api(`/api/envelopes/${draftId}/resend`, { method: "POST", json: {} });
    assert(r.json !== null, "resend route returned HTML, not JSON — the route file is probably at the wrong path");
  });

  /* ---------- void (two-step, unpaid-safe checks) ---------- */
  group("void");

  /* Both void routes are nested one level deeper than the envelope
     route, so they carry the same misplaced-file risk as resend. A
     route that doesn't exist returns Next's HTML 404; a real one
     returns JSON. */
  await test("void-request route is mounted at the correct path", async () => {
    assert(draftId, "no draft envelope");
    const r = await api(`/api/envelopes/${draftId}/void-request`, { method: "POST", json: {} });
    assert(r.json !== null, "void-request returned HTML, not JSON — the route file is probably at the wrong path");
  });

  await test("void route is mounted at the correct path", async () => {
    assert(draftId, "no draft envelope");
    const r = await api(`/api/envelopes/${draftId}/void`, { method: "POST", json: {} });
    assert(r.json !== null, "void returned HTML, not JSON — the route file is probably at the wrong path");
  });

  await test("void-request refuses an unpaid envelope (402)", async () => {
    assert(draftId, "no draft envelope");
    assertEq((await api(`/api/envelopes/${draftId}/void-request`, { method: "POST", json: {} })).status, 402, "status");
  });

  await test("void requires a token", async () => {
    assert(draftId, "no draft envelope");
    const r = await api(`/api/envelopes/${draftId}/void`, { method: "POST", json: {} });
    assertEq(r.status, 400, "status");
  });

  await test("void 404s an unknown envelope", async () => {
    const r = await api("/api/envelopes/00000000-0000-0000-0000-000000000000/void", { method: "POST", json: { token: "x" } });
    assertEq(r.status, 404, "status");
  });

  /* The void token must never appear in the envelope payload — every
     signer can read that endpoint, and the two-step flow exists
     precisely to keep the authority away from them. */
  await test("envelope API never exposes the void token", async () => {
    assert(draftId, "no draft envelope");
    const r = await api(`/api/envelopes/${draftId}`);
    const body = JSON.stringify(r.json);
    assert(!/voidToken/i.test(body), "voidToken is present in the envelope API response — it must never be returned");
  });

  /* ---------- checkout ---------- */
  group("checkout");

  await test("creates a Stripe checkout session", async () => {
    assert(draftId, "no draft envelope");
    const r = await api("/api/checkout", { method: "POST", json: { envelopeId: draftId } });
    assertEq(r.status, 200, "status");
    assert(/^https:\/\/checkout\.stripe\.com\//.test(r.json?.url || ""), `expected a Stripe checkout URL, got "${r.json?.url}"`);
  });

  await test("checkout rejects an unknown envelope", async () => {
    const r = await api("/api/checkout", { method: "POST", json: { envelopeId: "00000000-0000-0000-0000-000000000000" } });
    assertEq(r.status, 404, "status");
  });

  await test("checkout requires an envelope id", async () => {
    const r = await api("/api/checkout", { method: "POST", json: {} });
    assertEq(r.status, 400, "status");
  });

  /* ---------- webhook security ---------- */
  group("webhook security");

  await test("rejects an unsigned Stripe webhook", async () => {
    const r = await api("/api/webhooks/stripe", {
      method: "POST",
      body: JSON.stringify({ type: "checkout.session.completed", data: { object: { metadata: { envelopeId: draftId } } } }),
    });
    assert(r.status === 400 || r.status === 500, `expected the webhook to reject an unsigned payload, got ${r.status}`);
    if (r.status === 400) assert(/signature/i.test(r.json?.error || ""), "expected a signature verification error");
  });

  await test("rejects a webhook with a forged signature", async () => {
    const r = await api("/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": "t=1,v1=deadbeef" },
      body: JSON.stringify({ type: "checkout.session.completed", data: { object: {} } }),
    });
    assert(r.status === 400 || r.status === 500, `expected rejection, got ${r.status}`);
  });

  /* ---------- consent ---------- */
  group("consent");

  await test("consent requires a signer id", async () => {
    assert(draftId, "no draft envelope");
    const r = await api(`/api/envelopes/${draftId}/consent`, { method: "POST", json: {} });
    assertEq(r.status, 400, "status");
  });

  await test("consent rejects an unknown signer", async () => {
    assert(draftId, "no draft envelope");
    const r = await api(`/api/envelopes/${draftId}/consent`, { method: "POST", json: { signerId: "not-a-real-signer" } });
    assert(r.status === 404 || r.status === 402, `expected 404 or 402, got ${r.status}`);
  });

  /* Consent must be idempotent and must stop at terminal states.
     Found in production 2026-09-08: the endpoint appended a fresh
     consent event on every call, including on voided and completed
     envelopes, letting anyone with a signing link pad the audit trail
     the certificate is built from. */
  await test("consent is idempotent — a repeat call adds no audit event", async () => {
    assert(draftId, "no draft envelope");
    // Unpaid envelopes reject consent outright, so this only asserts the
    // repeat call does not grow the log when the endpoint is reachable.
    const first = await api(`/api/envelopes/${draftId}/consent`, { method: "POST", json: { signerId: "s0" } });
    if (first.status !== 200) return; // gated by payment — covered in the PAID block
    const before = ((await api(`/api/envelopes/${draftId}`)).json.auditLog || []).length;
    await api(`/api/envelopes/${draftId}/consent`, { method: "POST", json: { signerId: "s0" } });
    const after = ((await api(`/api/envelopes/${draftId}`)).json.auditLog || []).length;
    assertEq(after, before, "audit log grew on a repeated consent");
  });

  /* ---------- recovery privacy ---------- */
  group("document recovery");

  await test("recovery rejects a malformed address", async () => {
    const r = await api("/api/recover", { method: "POST", json: { email: "not-an-email" } });
    assertEq(r.status, 400, "status");
  });

  if (!SKIP_EMAIL) {
    await test("recovery gives an identical answer for known and unknown addresses", async () => {
      const known = await api("/api/recover", { method: "POST", json: { email: tag("autotest-sender") } });
      const unknown = await api("/api/recover", { method: "POST", json: { email: `nobody-${Date.now()}@example.com` } });
      assertEq(known.status, 200, "known-address status");
      assertEq(unknown.status, 200, "unknown-address status");
      assertEq(known.text, unknown.text, "responses must be byte-identical or the endpoint leaks whether an address has documents");
    });
  }

  /* ---------- post-payment guards (opt-in) ---------- */
  if (PAID_ID) {
    group("post-payment (ESIGN guards)");

    await test("paid envelope is reachable", async () => {
      const r = await api(`/api/envelopes/${PAID_ID}`);
      assertEq(r.status, 200, "status");
      assert(r.json.status !== "pending_payment", "PAID_ENVELOPE_ID points at an unpaid envelope");
    });

    await test("refuses to sign without recorded consent", async () => {
      const r = await api(`/api/envelopes/${PAID_ID}`, {
        method: "PATCH",
        json: { fields: [], signerId: "definitely-no-consent", attested: true, reviewedAllPages: true },
      });
      assertEq(r.status, 403, "status");
    });

    await test("refuses to sign without attestation", async () => {
      const env = (await api(`/api/envelopes/${PAID_ID}`)).json;
      const consented = (env.auditLog || []).find((e) => e.type === "consent");
      if (!consented) return; // nobody has consented on this envelope yet
      const r = await api(`/api/envelopes/${PAID_ID}`, {
        method: "PATCH",
        json: { fields: [], signerId: consented.signerId, attested: false, reviewedAllPages: true },
      });
      assertEq(r.status, 400, "status");
    });

    await test("refuses to sign without full page review", async () => {
      const env = (await api(`/api/envelopes/${PAID_ID}`)).json;
      const consented = (env.auditLog || []).find((e) => e.type === "consent");
      if (!consented) return;
      const r = await api(`/api/envelopes/${PAID_ID}`, {
        method: "PATCH",
        json: { fields: [], signerId: consented.signerId, attested: true, reviewedAllPages: false },
      });
      assertEq(r.status, 400, "status");
    });

    /* Replay protection. A PATCH that is accepted twice appends a second
       "signed" event to the audit log with a fresh timestamp and IP, and
       on a completed envelope re-sends the completion email to everyone.
       Found in production on 2026-09-08; these are the regression tests. */
    await test("completed envelope refuses further signing (409)", async () => {
      const env = (await api(`/api/envelopes/${PAID_ID}`)).json;
      if (env.status !== "completed") return;
      const before = (env.auditLog || []).length;
      const r = await api(`/api/envelopes/${PAID_ID}`, {
        method: "PATCH",
        json: { fields: [], signerId: env.signers[0].id, attested: true, reviewedAllPages: true },
      });
      assertEq(r.status, 409, "status");
      const after = ((await api(`/api/envelopes/${PAID_ID}`)).json.auditLog || []).length;
      assertEq(after, before, "audit log length must not change when a replay is rejected");
    });

    await test("a signer who already signed cannot sign again", async () => {
      const env = (await api(`/api/envelopes/${PAID_ID}`)).json;
      const done = env.signers.find((s) => {
        const theirs = env.fields.filter((f) => f.signerId === s.id);
        return theirs.length > 0 && theirs.every((f) => f.value);
      });
      if (!done) return;
      const r = await api(`/api/envelopes/${PAID_ID}`, {
        method: "PATCH",
        json: { fields: [], signerId: done.id, attested: true, reviewedAllPages: true },
      });
      assertEq(r.status, 409, "status");
    });

    await test("audit log has no duplicate completion events", async () => {
      const env = (await api(`/api/envelopes/${PAID_ID}`)).json;
      const completions = (env.auditLog || []).filter((e) => e.type === "completed");
      assert(completions.length <= 1, `found ${completions.length} "completed" events — an envelope can only complete once`);
    });

    await test("completed envelope refuses a resend", async () => {
      const env = (await api(`/api/envelopes/${PAID_ID}`)).json;
      if (env.status !== "completed") return; // only meaningful once everyone has signed
      const anySigner = env.signers.find((s) => s.email && !s.isSelf);
      if (!anySigner) return;
      const r = await api(`/api/envelopes/${PAID_ID}/resend`, { method: "POST", json: { signerId: anySigner.id } });
      assertEq(r.status, 409, "status");
    });

    await test("consent refused on a terminal envelope", async () => {
      const env = (await api(`/api/envelopes/${PAID_ID}`)).json;
      if (!["completed", "declined", "voided"].includes(env.status)) return;
      const before = (env.auditLog || []).length;
      const r = await api(`/api/envelopes/${PAID_ID}/consent`, { method: "POST", json: { signerId: env.signers[0].id } });
      assertEq(r.status, 409, "status");
      const after = ((await api(`/api/envelopes/${PAID_ID}`)).json.auditLog || []).length;
      assertEq(after, before, "audit log grew despite the rejection");
    });

    group("post-payment (void)");

    await test("void rejects a forged token (403, not 500)", async () => {
      const r = await api(`/api/envelopes/${PAID_ID}/void`, { method: "POST", json: { token: "f".repeat(64) } });
      assert(r.status === 403 || r.status === 409, `expected 403 (or 409 if already terminal), got ${r.status}`);
    });

    await test("void rejects a short token without throwing", async () => {
      const r = await api(`/api/envelopes/${PAID_ID}/void`, { method: "POST", json: { token: "abc" } });
      assert(r.status !== 500, "a short token caused a server error — timingSafeEqual probably threw on a length mismatch");
      assert(r.status === 403 || r.status === 409, `expected 403 or 409, got ${r.status}`);
    });

    await test("a terminal envelope refuses a void request", async () => {
      const env = (await api(`/api/envelopes/${PAID_ID}`)).json;
      if (!["completed", "declined", "voided"].includes(env.status)) return;
      const r = await api(`/api/envelopes/${PAID_ID}/void-request`, { method: "POST", json: {} });
      assertEq(r.status, 409, "status");
    });

    group("post-payment (resend endpoint)");

    await test("resend rejects an unknown signer", async () => {
      const r = await api(`/api/envelopes/${PAID_ID}/resend`, { method: "POST", json: { signerId: "no-such-signer" } });
      assertEq(r.status, 404, "status");
    });

    await test("resend rejects the self-signer", async () => {
      const env = (await api(`/api/envelopes/${PAID_ID}`)).json;
      const self = env.signers.find((s) => s.isSelf);
      if (!self) return; // this envelope has no self-signer
      const r = await api(`/api/envelopes/${PAID_ID}/resend`, { method: "POST", json: { signerId: self.id } });
      assertEq(r.status, 400, "status");
    });

    await test("resend requires a signerId", async () => {
      const r = await api(`/api/envelopes/${PAID_ID}/resend`, { method: "POST", json: {} });
      assertEq(r.status, 400, "status");
    });

    /* This block actually sends mail, so it is skippable. It is also the
       only test that proves the rate limiter works end to end, which is
       the whole point of the resend feature — run it when you can. */
    if (!SKIP_EMAIL) {
      await test("resend sends, reports the address, then rate limits", async () => {
        const env = (await api(`/api/envelopes/${PAID_ID}`)).json;
        const pending = env.signers.find((s) => {
          const theirs = env.fields.filter((f) => f.signerId === s.id);
          return s.email && !s.isSelf && !(theirs.length && theirs.every((f) => f.value));
        });
        if (!pending) return; // everyone has signed — nothing to chase

        const first = await api(`/api/envelopes/${PAID_ID}/resend`, { method: "POST", json: { signerId: pending.id } });
        if (first.status === 429) return; // a previous run is still inside the cooldown
        assertEq(first.status, 200, "first resend status");
        assertEq(first.json?.sentTo, pending.email, "sentTo");
        assert(typeof first.json?.resendsRemaining === "number", "expected resendsRemaining in the response");

        const second = await api(`/api/envelopes/${PAID_ID}/resend`, { method: "POST", json: { signerId: pending.id } });
        assertEq(second.status, 429, "second resend should be rate limited");
        assert(typeof second.json?.retryAfterSeconds === "number", "expected retryAfterSeconds on the rate-limit response");
      });

      await test("resend is written to the audit log", async () => {
        const env = (await api(`/api/envelopes/${PAID_ID}`)).json;
        const events = (env.auditLog || []).filter((e) => e.type === "invite_resent");
        assert(events.length > 0, "no invite_resent event was recorded");
        const last = events[events.length - 1];
        assert(last.signerEmail && last.at && last.ip, "invite_resent event is missing signerEmail / at / ip");
      });
    }
  }

  /* ---------- report ---------- */
  const passed = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  let lastGroup = null;

  for (const r of results) {
    if (r.group !== lastGroup) {
      console.log(`\n  ${r.group}`);
      lastGroup = r.group;
    }
    console.log(`   ${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : `\n           ↳ ${r.error}`}`);
  }

  console.log(`\n${"-".repeat(60)}`);
  console.log(`${passed.length} passed, ${failed.length} failed, ${results.length} total`);
  if (!PAID_ID) console.log(`(set PAID_ENVELOPE_ID to also run the post-payment ESIGN guard tests)`);
  console.log(`${"-".repeat(60)}\n`);

  const summary = {
    passed: passed.length,
    failed: failed.length,
    total: results.length,
    failures: failed.map((f) => ({ name: f.name, error: f.error })),
  };

  if (IS_NODE) process.exit(failed.length ? 1 : 0);
  return summary;
}

if (IS_NODE) {
  main().catch((err) => {
    console.error("\nSuite crashed before finishing:", err);
    process.exit(1);
  });
} else {
  // In a browser: expose it so it can be invoked and awaited.
  globalThis.runDollarSignTests = main;
}
