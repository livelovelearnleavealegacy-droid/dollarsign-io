import { NextResponse } from "next/server";
import crypto from "crypto";
import { getEnvelope, setVoidToken, appendAuditEvent } from "@/lib/db";
import { sendVoidLink } from "@/lib/email";
import { clientIp, clientUserAgent } from "@/lib/request";
import { blockedReason } from "@/lib/guards";

// Step one of two. Anyone holding the envelope link can ask to void it;
// the token that actually authorises the void goes only to senderEmail.
// That asymmetry is the entire authorisation model, because there are no
// accounts and no other way to tell the sender from a signer.
//
// Rate limited because this endpoint sends mail to an address the caller
// does not control — without a cap it would be a way to pester the
// sender. Limits are derived from the envelope's own audit log so they
// survive redeploys, same as the resend endpoint.

export const VOID_REQUEST_COOLDOWN_MS = 5 * 60 * 1000;
export const VOID_REQUEST_MAX = 5;

export async function POST(req, { params }) {
  const envelope = getEnvelope(params.id);
  if (!envelope) return NextResponse.json({ error: "not found" }, { status: 404 });

  const blocked = blockedReason(envelope, {
    pending_payment: "This envelope hasn't been paid for yet.",
    completed: "This envelope is already complete and can't be voided.",
    declined: "A signer already declined this envelope.",
    voided: "This envelope has already been voided.",
    expired: "This envelope already expired, so there is nothing left to void.",
  });
  if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status });

  // Without a sender address there is nobody to authorise the void, so
  // the flow simply cannot run. Say so plainly rather than failing oddly.
  if (!envelope.senderEmail) {
    return NextResponse.json({
      error: "This envelope has no sender email on file, so we can't confirm who is allowed to void it. Email support@dollarsign.io and we'll help.",
    }, { status: 409 });
  }

  const priorRequests = (envelope.auditLog || []).filter((e) => e.type === "void_requested");
  if (priorRequests.length >= VOID_REQUEST_MAX) {
    return NextResponse.json({
      error: "You've requested this too many times. Email support@dollarsign.io and we'll void it for you.",
    }, { status: 429 });
  }
  const last = priorRequests[priorRequests.length - 1];
  if (last?.at) {
    const elapsed = Date.now() - new Date(last.at).getTime();
    if (elapsed < VOID_REQUEST_COOLDOWN_MS) {
      return NextResponse.json({
        error: "We just emailed a confirmation link. Check the inbox, then try again in a few minutes if it hasn't arrived.",
        retryAfterSeconds: Math.ceil((VOID_REQUEST_COOLDOWN_MS - elapsed) / 1000),
      }, { status: 429 });
    }
  }

  // 32 bytes of CSPRNG output. Replaces any previous token, so asking
  // again invalidates the earlier link rather than leaving several live.
  const token = crypto.randomBytes(32).toString("hex");
  setVoidToken(params.id, token);

  const signedCount = envelope.signers.filter((s) => {
    const theirs = envelope.fields.filter((f) => f.signerId === s.id);
    return theirs.length > 0 && theirs.every((f) => f.value);
  }).length;

  try {
    await sendVoidLink({
      to: envelope.senderEmail,
      senderName: envelope.senderName,
      envelopeId: params.id,
      token,
      trackingId: envelope.trackingId,
      documentName: envelope.documentName,
      signedCount,
      signerCount: envelope.signers.length,
    });
  } catch (err) {
    return NextResponse.json({
      error: "We couldn't send the confirmation email just now. Please try again in a few minutes.",
      detail: String(err?.message || err),
    }, { status: 502 });
  }

  appendAuditEvent(params.id, {
    type: "void_requested",
    ip: clientIp(req),
    userAgent: clientUserAgent(req),
    at: new Date().toISOString(),
  });

  // The masked address confirms the link went somewhere plausible
  // without disclosing the full sender address to a signer.
  const [user, domain] = envelope.senderEmail.split("@");
  const masked = `${user.slice(0, 2)}${"•".repeat(Math.max(1, user.length - 2))}@${domain}`;

  return NextResponse.json({ ok: true, sentTo: masked });
}
