import { NextResponse } from "next/server";
import { getEnvelope, correctSignerEmail, appendAuditEvent } from "@/lib/db";
import { sendSigningInvite } from "@/lib/email";
import { clientIp, clientUserAgent } from "@/lib/request";
import { blockedReason } from "@/lib/guards";

// Fixing a mistyped signer address without paying for a second envelope.
//
// Before this existed, a typo was unrecoverable: the invitation bounced,
// the envelope could never complete, and the only remedy was to buy
// another one. The customer paid and got nothing, over one wrong
// character.
//
// Deliberately narrow. A correction is allowed only when:
//   - the envelope is still open (not paid-pending, not terminal)
//   - the signer exists and has not signed anything yet
//   - delivery to that signer actually failed
//
// That last condition is the important one. Without it this becomes a
// general "change who is signing" endpoint, which anyone holding the
// envelope link could use to redirect an agreement to themselves. A
// recorded bounce is proof that the current address does not work, and
// it is the only thing that justifies changing it.

const MAX_CORRECTIONS = 5;

// Deliberately loose. Strict address validation rejects valid
// addresses, and the real check is whether mail to it bounces — which
// is now recorded either way.
function looksLikeEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export async function POST(req, { params }) {
  const body = await req.json().catch(() => ({}));
  const signerId = body?.signerId;
  const email = String(body?.email || "").trim();

  if (!signerId) return NextResponse.json({ error: "signerId is required" }, { status: 400 });
  if (!looksLikeEmail(email)) {
    return NextResponse.json({ error: "That doesn't look like an email address." }, { status: 400 });
  }

  const envelope = getEnvelope(params.id);
  if (!envelope) return NextResponse.json({ error: "not found" }, { status: 404 });

  const blocked = blockedReason(envelope, {
    pending_payment: "this envelope hasn't been paid for yet",
    completed: "this envelope is already complete",
    declined: "this envelope was declined, so there's nothing left to send",
    voided: "the sender voided this envelope",
    expired: "this envelope expired before everyone signed",
  });
  if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status });

  const signer = envelope.signers.find((s) => s.id === signerId);
  if (!signer) return NextResponse.json({ error: "signer not found" }, { status: 404 });

  const theirFields = envelope.fields.filter((f) => f.signerId === signerId);
  if (theirFields.length > 0 && theirFields.every((f) => f.value)) {
    return NextResponse.json(
      { error: "This signer has already signed, so their address can't be changed." },
      { status: 409 }
    );
  }

  const previousEmail = String(signer.email || "");
  if (previousEmail.toLowerCase() === email.toLowerCase()) {
    return NextResponse.json({ error: "That's the same address it's already going to." }, { status: 400 });
  }

  // Proof that the current address is broken. Matched on the signer id
  // where the webhook could attribute it, and on the address otherwise.
  const log = envelope.auditLog || [];
  const failed = log.some(
    (e) =>
      (e.type === "email_bounced" || e.type === "email_failed") &&
      (e.signerId === signerId ||
        (previousEmail && String(e.email || "").toLowerCase() === previousEmail.toLowerCase()))
  );
  if (!failed) {
    return NextResponse.json(
      {
        error:
          "This address can only be changed after a delivery failure. If the signer simply hasn't responded, resend the invite instead.",
      },
      { status: 409 }
    );
  }

  // Read from the audit log rather than kept in a counter, so it
  // survives redeploys and shows up on the certificate.
  const corrections = log.filter((e) => e.type === "address_corrected" && e.signerId === signerId).length;
  if (corrections >= MAX_CORRECTIONS) {
    return NextResponse.json(
      { error: "This address has been changed too many times. Email support@dollarsign.io and we'll sort it out." },
      { status: 429 }
    );
  }

  const at = new Date().toISOString();
  const updated = correctSignerEmail(params.id, {
    signerId,
    email,
    event: {
      at,
      signerId,
      signerName: signer.name || null,
      previousEmail: previousEmail || null,
      email,
      ip: clientIp(req),
      userAgent: clientUserAgent(req),
    },
  });
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });

  // The address is already changed and on the record. A failed send
  // must not roll that back — the sender can resend from the status
  // page, and rolling back would leave the log claiming a correction
  // that did not stick.
  try {
    await sendSigningInvite({
      to: email,
      signerName: signer.name,
      senderName: envelope.senderName,
      envelopeId: envelope.id,
      signerId,
      trackingId: envelope.trackingId,
      documentName: envelope.documentName,
    });
    appendAuditEvent(params.id, { type: "email_sent", signerId, email, at: new Date().toISOString(), kind: "corrected" });
  } catch (err) {
    return NextResponse.json({
      envelope: getEnvelope(params.id),
      corrected: true,
      sent: false,
      error: `Address updated, but we couldn't send the invitation: ${String(err?.message || err)}. Try "Resend invite".`,
    });
  }

  return NextResponse.json({ envelope: getEnvelope(params.id), corrected: true, sent: true, email });
}
