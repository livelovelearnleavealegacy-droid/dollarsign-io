import { NextResponse } from "next/server";
import crypto from "crypto";
import { getEnvelopeByTrackingId, appendAuditEvent } from "@/lib/db";
import { sendBounceNotice } from "@/lib/email";

/**
 * Resend delivery webhooks — the missing half of email delivery.
 *
 * Until this existed, a signing invitation to a typo'd or dead address
 * simply vanished. The signer never learned there was a document, the
 * sender saw "pending" forever and assumed the signer was slow, and
 * nothing anywhere recorded that the email had failed. On a product
 * with no accounts, where the emailed link IS the delivery mechanism,
 * that is the difference between a stalled envelope and a lost one.
 *
 * Correlation is by the tracking id in the subject line. Every envelope
 * email carries it (see docLabel in lib/email.js), and the alternative —
 * recording Resend's message id at every send site — would mean touching
 * seven call sites to store an id that is only ever read here.
 *
 * Set RESEND_WEBHOOK_SECRET to the signing secret Resend shows when the
 * endpoint is created. Without it this route 404s, like every other
 * privileged endpoint in this app.
 */

// Resend signs with Svix. Verified by hand rather than adding the svix
// package: it is an HMAC over "id.timestamp.body" and pulling in a
// dependency for nine lines of crypto is not a good trade in a repo
// edited through a browser.
function verify(secret, req, rawBody) {
  const id = req.headers.get("svix-id");
  const ts = req.headers.get("svix-timestamp");
  const header = req.headers.get("svix-signature");
  if (!id || !ts || !header) return false;

  // Replay window. Without it, a signature captured once stays valid
  // forever.
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false;

  const key = Buffer.from(String(secret).replace(/^whsec_/, ""), "base64");
  const expected = crypto.createHmac("sha256", key).update(`${id}.${ts}.${rawBody}`).digest("base64");

  // The header carries one or more space-separated "v1,<signature>"
  // pairs — Svix sends several while a secret is being rotated.
  for (const part of header.split(" ")) {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) continue;
    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

const TRACKING = /ENV-[A-Z0-9]{4,12}/;

const EMAIL_IN_TEXT = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

/* Every address this bounce could plausibly be about.

   `data.to` is the obvious one, and for an ordinary typo'd address it
   is the right one. But it cannot be trusted alone: a live test on
   Sept 9 sent an invitation to bounce@simulator.amazonses.com and the
   webhook came back with `to: ["bounced@resend.dev"]` — the provider
   substituted its own address, so nothing matched the signer and the
   bounce was recorded against nobody.

   The real recipient was still in the SMTP diagnostic
   ("550 5.1.1 As requested: user unknown <bounce@simulator.amazonses.com>"),
   so that gets scanned too. Order matters: `to` first, diagnostics
   after, so the ordinary case is unchanged and this is purely a
   fallback. */
function candidateAddresses(data) {
  const out = [];
  const push = (v) => {
    const s = String(v || "").trim().toLowerCase();
    if (s && !out.includes(s)) out.push(s);
  };

  const to = data?.to;
  if (Array.isArray(to)) to.forEach(push);
  else if (typeof to === "string") push(to);

  const diag = data?.bounce?.diagnosticCode;
  const blobs = Array.isArray(diag) ? diag : diag ? [diag] : [];
  for (const blob of blobs) {
    for (const found of String(blob).match(EMAIL_IN_TEXT) || []) push(found);
  }

  return out;
}

// Resend has moved this field around between payload versions, so read
// defensively rather than assuming one shape. A missing reason is
// cosmetic; the bounce itself is what matters.
function reasonOf(data) {
  const b = data?.bounce || {};
  return b.message || b.subType || b.type || data?.reason || null;
}

export async function POST(req) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Raw body first — parsing it would change the bytes the signature
  // was computed over.
  const rawBody = await req.text();
  if (!verify(secret, req, rawBody)) {
    return NextResponse.json({ error: "signature verification failed" }, { status: 400 });
  }

  let event;
  try { event = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "bad payload" }, { status: 400 }); }

  const type = event?.type;
  // Delivered and delayed events are noise here: delayed usually
  // resolves itself, and recording every delivery would bloat the audit
  // trail that the certificate is drawn from.
  if (type !== "email.bounced" && type !== "email.complained") {
    return NextResponse.json({ received: true, ignored: type || "unknown" });
  }

  const data = event.data || {};
  const subject = String(data.subject || "");
  const match = subject.match(TRACKING);
  // Recovery emails carry no tracking id and belong to no envelope.
  // Nothing to attribute, so acknowledge and move on.
  if (!match) return NextResponse.json({ received: true, ignored: "no tracking id in subject" });

  const envelope = getEnvelopeByTrackingId(match[0]);
  if (!envelope) return NextResponse.json({ received: true, ignored: "unknown envelope" });

  const emailId = data.email_id || data.id || null;
  const already = (envelope.auditLog || []).some(
    (e) => e.type === "email_bounced" && emailId && e.emailId === emailId
  );
  // Svix retries on any non-2xx, and will happily deliver the same
  // event twice on a slow response. Recording it twice would put two
  // failures on a certificate for one failure in the world.
  if (already) return NextResponse.json({ received: true, ignored: "already recorded" });

  const senderEmail = String(envelope.senderEmail || "").toLowerCase();
  const candidates = candidateAddresses(data);

  // Whichever candidate address actually belongs to a signer on this
  // envelope is the one worth recording — that is the address the
  // status page and the certificate have to name for the bounce to mean
  // anything to the sender.
  const signer = (envelope.signers || []).find((s) => {
    const e = String(s.email || "").toLowerCase();
    return e && candidates.includes(e);
  });

  // Fall back to what the provider reported, so an unattributable
  // bounce is still recorded rather than silently dropped.
  const address = signer ? String(signer.email) : candidates[0] || "unknown recipient";
  const lower = address.toLowerCase();
  const results = [];

  appendAuditEvent(envelope.id, {
    type: "email_bounced",
    at: new Date().toISOString(),
    email: address,
    signerId: signer?.id || null,
    signerName: signer?.name || null,
    // What the provider called it, when that differs from the address
    // actually on the envelope. Keeps the record honest without showing
    // the sender an address they never typed.
    reportedTo: candidates[0] && candidates[0] !== lower ? candidates[0] : undefined,
    complaint: type === "email.complained",
    reason: reasonOf(data),
    emailId,
    subject: subject.slice(0, 160),
  });

  // Tell the sender — but never the address that just failed, and never
  // when the sender IS that address, which would try to deliver a bounce
  // notice to a mailbox we just learned is unreachable.
  if (envelope.senderEmail && lower !== senderEmail) {
    try {
      await sendBounceNotice({
        to: envelope.senderEmail,
        senderName: envelope.senderName,
        signerName: signer?.name || null,
        signerEmail: address,
        envelopeId: envelope.id,
        trackingId: envelope.trackingId,
        documentName: envelope.documentName,
        reason: reasonOf(data),
      });
      results.push({ address, attributed: !!signer, senderNotified: true });
    } catch (err) {
      // The bounce is already on the audit trail and visible on the
      // status page. A failed notification must not make Resend retry
      // and duplicate the record.
      console.error("bounce notice failed:", err?.message || err);
      results.push({ address, attributed: !!signer, senderNotified: false });
    }
  } else {
    results.push({ address, attributed: !!signer, senderNotified: false });
  }

  return NextResponse.json({ received: true, trackingId: envelope.trackingId, results });
}
