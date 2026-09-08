import { NextResponse } from "next/server";
import { getEnvelope, appendAuditEvent } from "@/lib/db";
import { sendSigningInvite } from "@/lib/email";
import { clientIp, clientUserAgent } from "@/lib/request";
 
// Lets the sender re-send a signing invite to a signer who says they
// never got it — by far the most common support request for any
// e-signature product. Handling it self-serve here means it never
// becomes an email to support.
//
// Abuse control is deliberately conservative: this endpoint sends mail
// to an address chosen by whoever created the envelope, so it is rate
// limited per signer and capped in total. Both limits are derived from
// the envelope's own audit log rather than in-memory state, so they
// survive redeploys and container restarts.
 
export const RESEND_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between resends
export const RESEND_MAX_PER_SIGNER = 5;          // lifetime cap per signer
 
export async function POST(req, { params }) {
  const body = await req.json().catch(() => ({}));
  const { signerId } = body;
  if (!signerId) return NextResponse.json({ error: "signerId is required" }, { status: 400 });
 
  const envelope = getEnvelope(params.id);
  if (!envelope) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (envelope.status === "pending_payment") {
    return NextResponse.json({ error: "This envelope hasn't been paid for yet." }, { status: 402 });
  }
  if (envelope.status === "completed") {
    return NextResponse.json({ error: "This envelope is already complete." }, { status: 409 });
  }
 
  const signer = envelope.signers.find((s) => s.id === signerId);
  if (!signer) return NextResponse.json({ error: "signer not found" }, { status: 404 });
  if (signer.isSelf) {
    return NextResponse.json({ error: "You sign your own fields directly — there's no invite to resend." }, { status: 400 });
  }
  if (!signer.email) {
    return NextResponse.json({ error: "That signer doesn't have an email address on file." }, { status: 400 });
  }
 
  // Nothing to chase if they've already finished their part.
  const theirFields = envelope.fields.filter((f) => f.signerId === signerId);
  if (theirFields.length > 0 && theirFields.every((f) => f.value)) {
    return NextResponse.json({ error: "That signer has already signed." }, { status: 409 });
  }
 
  const priorResends = (envelope.auditLog || []).filter(
    (e) => e.type === "invite_resent" && e.signerId === signerId
  );
 
  if (priorResends.length >= RESEND_MAX_PER_SIGNER) {
    return NextResponse.json({
      error: "You've resent this invite the maximum number of times. Please contact the signer another way, or email support@dollarsign.io.",
    }, { status: 429 });
  }
 
  const last = priorResends[priorResends.length - 1];
  if (last?.at) {
    const elapsed = Date.now() - new Date(last.at).getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      return NextResponse.json({
        error: "That invite was just sent. Please wait a few minutes before sending it again.",
        retryAfterSeconds: waitSeconds,
      }, { status: 429 });
    }
  }
 
  try {
    await sendSigningInvite({
      to: signer.email,
      signerName: signer.name,
      senderName: envelope.senderName,
      envelopeId: params.id,
      signerId: signer.id,
      trackingId: envelope.trackingId,
    });
  } catch (err) {
    return NextResponse.json({
      error: "We couldn't send that email just now. Please try again in a few minutes.",
      detail: String(err?.message || err),
    }, { status: 502 });
  }
 
  // Recorded on the envelope so the audit trail shows every delivery
  // attempt, not just the original one.
  const updated = appendAuditEvent(params.id, {
    type: "invite_resent",
    signerId,
    signerName: signer.name || null,
    signerEmail: signer.email || null,
    ip: clientIp(req),
    userAgent: clientUserAgent(req),
    at: new Date().toISOString(),
  });
 
  return NextResponse.json({
    ok: true,
    sentTo: signer.email,
    resendsUsed: priorResends.length + 1,
    resendsRemaining: RESEND_MAX_PER_SIGNER - (priorResends.length + 1),
    envelope: updated,
  });
}
