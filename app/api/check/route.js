import { NextResponse } from "next/server";
import { getEnvelopeByTrackingId, appendAuditEvent } from "@/lib/db";
import { stripeClient } from "@/lib/stripe";

/**
 * "Something went wrong with my envelope."
 *
 * Reads the envelope's own audit log and answers the question directly,
 * because most of the time the answer is not a refund — it is "your
 * signer got it at 4:32 and hasn't finished yet." Answering that is
 * what keeps the support inbox empty at $1.99 a sale.
 *
 * When it finds a real, recorded failure it issues a single-use
 * free-envelope code instead. A credit costs less than a refund (Stripe
 * keeps its fee on refunds) and keeps the customer, so the automatic
 * path is deliberately the generous one.
 *
 * What it will NOT do is deny anyone. A person whose envelope looks
 * fine to us is shown what happened and pointed at support, where a
 * human says yes. Automating a refusal at this price point only
 * converts refund requests into chargebacks, which cost $15 each.
 */

// Requires the tracking id AND an address on the envelope. A tracking
// id alone is short enough to guess, and the timeline names every
// signer — so the id is not sufficient authority to read it.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const trackingId = String(body?.trackingId || "").trim().toUpperCase();
  const email = String(body?.email || "").trim().toLowerCase();

  if (!trackingId || !email.includes("@")) {
    return NextResponse.json(
      { error: "Enter your tracking number and the email address you used." },
      { status: 400 }
    );
  }

  const envelope = getEnvelopeByTrackingId(trackingId);

  // One response for "no such envelope" and "that address isn't on it",
  // so this can't be used to test which tracking ids exist.
  const onEnvelope =
    envelope &&
    (String(envelope.senderEmail || "").toLowerCase() === email ||
      (envelope.signers || []).some((s) => String(s.email || "").toLowerCase() === email));

  if (!envelope || !onEnvelope) {
    return NextResponse.json({
      found: false,
      message:
        "We couldn't match that tracking number to that email address. Check both — the tracking number looks like ENV-XXXXXX and the email has to be one that's on the envelope. If you're sure they're right, email support@dollarsign.io and we'll look it up.",
    });
  }

  const log = envelope.auditLog || [];
  const findings = [];

  // --- what actually went wrong, if anything ------------------------

  const bounced = log.filter((e) => e.type === "email_bounced");
  for (const b of bounced) {
    // A bounce that was later corrected is not an outstanding failure —
    // the fix already happened and the envelope moved on.
    const correctedAfter = log.some(
      (e) => e.type === "address_corrected" && e.signerId === b.signerId && e.at > b.at
    );
    if (correctedAfter) continue;
    findings.push({
      code: "delivery_failed",
      text: `We couldn't deliver the invitation to ${b.email || "one of your signers"}. Their mail server rejected it, so they never got the link.`,
    });
  }

  for (const f of log.filter((e) => e.type === "email_failed")) {
    findings.push({
      code: "send_failed",
      text: `An invitation to ${f.email || "one of your signers"} failed to send from our side.`,
    });
  }

  // Paid, sent, and yet somebody who should have been emailed never was.
  if (envelope.status !== "pending_payment") {
    for (const s of envelope.signers || []) {
      if (s.isSelf || !s.email) continue;
      const everSent = log.some(
        (e) => e.type === "email_sent" && (e.signerId === s.id || String(e.email || "").toLowerCase() === String(s.email).toLowerCase())
      );
      // Sequential envelopes invite people in turn, so a later signer
      // legitimately has no invitation yet.
      const theirTurnCameUp = envelope.signingMode !== "sequential" || envelope.status === "completed";
      if (!everSent && theirTurnCameUp) {
        findings.push({
          code: "never_sent",
          text: `${s.name || "One of your signers"} was never sent an invitation, though the envelope was paid for.`,
        });
      }
    }
  }

  if (envelope.status === "completed" && !envelope.documentHash) {
    findings.push({
      code: "no_fingerprint",
      text: "This envelope completed without recording a document fingerprint, so its certificate is incomplete.",
    });
  }

  const paidEvent = log.find((e) => e.type === "paid");
  if (envelope.status === "pending_payment" && paidEvent) {
    findings.push({
      code: "payment_not_applied",
      text: "Your payment went through but the envelope was never sent. That's our fault, not yours.",
    });
  }

  // --- the timeline, in plain language ------------------------------

  const when = (at) => {
    try {
      return new Date(at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
    } catch { return at; }
  };
  const label = (e) =>
    e.type === "created" ? `Envelope created by ${e.senderName || "you"}`
    : e.type === "paid" ? "Paid, and invitations sent"
    : e.type === "email_sent" ? `Invitation delivered to ${e.email || e.signerEmail || "a signer"}`
    : e.type === "email_bounced" ? `Delivery FAILED to ${e.email || "a signer"}`
    : e.type === "email_failed" ? `Sending failed to ${e.email || "a signer"}`
    : e.type === "address_corrected" ? `Address corrected to ${e.email || "a new address"}`
    : e.type === "invite_resent" ? `Invitation resent to ${e.signerEmail || "a signer"}`
    : e.type === "reminder_sent" ? `Reminder sent to ${e.signerEmail || "a signer"}`
    : e.type === "consent" ? `${e.signerName || "A signer"} opened it and agreed to sign electronically`
    : e.type === "signed" ? `${e.signerName || "A signer"} signed`
    : e.type === "completed" ? "Everyone signed — completed"
    : e.type === "declined" ? `${e.signerName || "A signer"} declined to sign`
    : e.type === "voided" ? "You voided this envelope"
    : e.type === "expired" ? "Expired before everyone signed"
    : null;

  const timeline = log.map((e) => ({ at: when(e.at), text: label(e) })).filter((x) => x.text);

  const outstanding = (envelope.signers || []).filter((s) => {
    const theirs = (envelope.fields || []).filter((f) => f.signerId === s.id);
    return theirs.length > 0 && !theirs.every((f) => f.value);
  });

  // --- the make-good ------------------------------------------------

  const existingCredit = log.find((e) => e.type === "credit_issued" && e.code);
  let credit = null;
  let creditError = null;

  if (findings.length && existingCredit) {
    // Already made good once. Hand back the same code rather than
    // minting a new one every time the page is refreshed.
    credit = { code: existingCredit.code, reissued: true };
  } else if (findings.length) {
    const coupon = process.env.STRIPE_MAKEGOOD_COUPON;
    if (!coupon) {
      creditError = "email";
    } else {
      try {
        const promo = await stripeClient().promotionCodes.create({
          coupon,
          max_redemptions: 1,
          expires_at: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
          metadata: { envelopeId: envelope.id, trackingId: envelope.trackingId },
        });
        credit = { code: promo.code, reissued: false };
        appendAuditEvent(envelope.id, {
          type: "credit_issued",
          at: new Date().toISOString(),
          code: promo.code,
          reasons: findings.map((f) => f.code),
        });
      } catch (err) {
        console.error("could not create make-good code:", err?.message || err);
        creditError = "email";
      }
    }
  }

  return NextResponse.json({
    found: true,
    trackingId: envelope.trackingId,
    documentName: envelope.documentName || null,
    status: envelope.status,
    waitingOn: outstanding.map((s) => s.name || "a signer"),
    findings,
    credit,
    creditError,
    timeline,
  });
}
