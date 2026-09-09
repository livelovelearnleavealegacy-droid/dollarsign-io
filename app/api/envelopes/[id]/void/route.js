import { NextResponse } from "next/server";
import { getEnvelope, voidTokenMatches, voidEnvelope } from "@/lib/db";
import { sendVoidNotice } from "@/lib/email";
import { clientIp, clientUserAgent } from "@/lib/request";
import { blockedReason } from "@/lib/guards";

// Step two. Requires the token emailed to senderEmail, so only whoever
// controls that address can get here.
//
// Deliberately POST, not GET. Mail scanners at Outlook and Gmail
// prefetch links to check them for malware; a GET that voided would
// fire on delivery, before the sender ever read the message. The
// emailed link opens a confirmation page, and that page posts here.
export async function POST(req, { params }) {
  const body = await req.json().catch(() => ({}));
  const { token, reason } = body;
  if (!token) return NextResponse.json({ error: "This link is missing its confirmation code." }, { status: 400 });

  const envelope = getEnvelope(params.id);
  if (!envelope) return NextResponse.json({ error: "not found" }, { status: 404 });

  const blocked = blockedReason(envelope, {
    pending_payment: "This envelope hasn't been paid for yet.",
    completed: "This envelope finished before the void went through, so there was nothing left to cancel.",
    declined: "A signer declined this envelope, so it's already closed.",
    voided: "This envelope has already been voided.",
    expired: "This envelope expired before the void went through, so it is already closed.",
  });
  if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status });

  // Constant-time comparison plus a 24-hour expiry, both in the db layer.
  if (!voidTokenMatches(params.id, token)) {
    return NextResponse.json({
      error: "This confirmation link is no longer valid. It may have expired, already been used, or been replaced by a newer request. Start the void again from the envelope's status page.",
    }, { status: 403 });
  }

  const cleanReason = typeof reason === "string" ? reason.trim().slice(0, 500) || null : null;

  const updated = voidEnvelope(params.id, {
    reason: cleanReason,
    ip: clientIp(req),
    userAgent: clientUserAgent(req),
    at: new Date().toISOString(),
  });

  // Everyone who was asked to sign needs to know the document is dead —
  // otherwise they click a stale link later and get an error with no
  // explanation. The sender isn't emailed; they are looking at the
  // confirmation right now.
  const recipients = [];
  for (const s of updated.signers) {
    if (s.email && !s.isSelf && !recipients.includes(s.email)) recipients.push(s.email);
  }

  const results = await Promise.allSettled(
    recipients.map((to) =>
      sendVoidNotice({
        to,
        senderName: updated.senderName,
        envelopeId: params.id,
        reason: cleanReason,
        trackingId: updated.trackingId,
        documentName: updated.documentName,
      })
    )
  );
  const failures = results.filter((r) => r.status === "rejected");

  // The void is already recorded — a failed notification must not undo it.
  return NextResponse.json({
    ok: true,
    envelope: updated,
    notifiedCount: recipients.length - failures.length,
    ...(failures.length ? { notifyError: failures.map((f) => String(f.reason?.message || f.reason)).join("; ") } : {}),
  });
}
