import { NextResponse } from "next/server";
import { getEnvelope, appendAuditEvent } from "@/lib/db";
import { clientIp, clientUserAgent } from "@/lib/request";
import { blockedReason } from "@/lib/guards";

// Records a signer's consent to sign electronically as its own audit
// event, distinct from and prior to the signature itself — ESIGN
// requires consent be obtained separately, not bundled into the act
// of signing.
export async function POST(req, { params }) {
  const body = await req.json().catch(() => ({}));
  const { signerId } = body;
  if (!signerId) return NextResponse.json({ error: "signerId is required" }, { status: 400 });

  const envelope = getEnvelope(params.id);
  if (!envelope) return NextResponse.json({ error: "not found" }, { status: 404 });
  // Terminal envelopes take no further audit events. Without this,
  // anyone holding a signing link could append consent events to a
  // finished document forever — each one stamped with their own IP and
  // timestamp, on the very record the Certificate of Completion is
  // built from. Same failure mode as the replayed-signature bug.
  const blocked = blockedReason(envelope, {
    pending_payment: "this envelope hasn't been paid for yet",
    completed: "this envelope is already complete",
    declined: "a signer declined this envelope",
    voided: "the sender voided this envelope",
    expired: "this envelope expired before everyone signed",
  });
  if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status });

  const signer = envelope.signers.find((s) => s.id === signerId);
  if (!signer) return NextResponse.json({ error: "signer not found" }, { status: 404 });

  // Consent happens once per signer. Re-posting is a no-op rather than
  // an error: the signing page can retry safely, and a refreshed tab
  // won't add a duplicate. The FIRST consent is the one with
  // evidentiary meaning, so it must never be overwritten or joined by
  // near-identical siblings at different timestamps.
  const already = (envelope.auditLog || []).some(
    (e) => e.type === "consent" && e.signerId === signerId
  );
  if (already) {
    return NextResponse.json({ envelope, alreadyConsented: true });
  }

  const updated = appendAuditEvent(params.id, {
    type: "consent",
    signerId,
    signerName: signer.name || null,
    signerEmail: signer.email || null,
    ip: clientIp(req),
    userAgent: clientUserAgent(req),
    at: new Date().toISOString(),
  });

  return NextResponse.json({ envelope: updated });
}
