import { NextResponse } from "next/server";
import { getEnvelope, declineEnvelope } from "@/lib/db";
import { sendDeclineNotice } from "@/lib/email";
import { clientIp, clientUserAgent } from "@/lib/request";
import { blockedReason } from "@/lib/guards";

// A signer refusing to sign. Authorization comes from the signing link
// itself: only someone holding this signer's URL can decline as them,
// which is the same basis on which they'd be allowed to sign.
//
// Declining is terminal. The alternative — leaving the envelope open —
// means the sender waits forever with no signal, which is the worst
// outcome for everyone involved.
export async function POST(req, { params }) {
  const body = await req.json().catch(() => ({}));
  const { signerId, reason } = body;
  if (!signerId) return NextResponse.json({ error: "signerId is required" }, { status: 400 });

  const envelope = getEnvelope(params.id);
  if (!envelope) return NextResponse.json({ error: "not found" }, { status: 404 });
  const blocked = blockedReason(envelope, {
    pending_payment: "this envelope hasn't been paid for yet",
    completed: "this envelope is already complete",
    declined: "this envelope has already been declined",
    voided: "the sender voided this envelope",
    expired: "this envelope expired before everyone signed",
  });
  if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status });

  const signer = envelope.signers.find((s) => s.id === signerId);
  if (!signer) return NextResponse.json({ error: "signer not found" }, { status: 404 });

  const updated = declineEnvelope(params.id, {
    signerId,
    signerName: signer.name || null,
    signerEmail: signer.email || null,
    reason: typeof reason === "string" ? reason.trim().slice(0, 500) || null : null,
    ip: clientIp(req),
    userAgent: clientUserAgent(req),
    at: new Date().toISOString(),
  });

  // Everyone waiting on this document needs to know it's over: the
  // sender, and every other signer who was queued behind this one.
  const recipients = [];
  if (updated.senderEmail) recipients.push(updated.senderEmail);
  for (const s of updated.signers) {
    if (s.id !== signerId && s.email && !recipients.includes(s.email)) recipients.push(s.email);
  }

  const results = await Promise.allSettled(
    recipients.map((to) =>
      sendDeclineNotice({
        to,
        declinerName: signer.name,
        reason: typeof reason === "string" ? reason.trim().slice(0, 500) : null,
        envelopeId: params.id,
        trackingId: updated.trackingId,
        documentName: updated.documentName,
      })
    )
  );
  const failures = results.filter((r) => r.status === "rejected");

  // The decline is already recorded — a failed notification email must
  // not roll it back. Report it and move on.
  return NextResponse.json({
    envelope: updated,
    ...(failures.length ? { notifyError: failures.map((f) => String(f.reason?.message || f.reason)).join("; ") } : {}),
  });
}
