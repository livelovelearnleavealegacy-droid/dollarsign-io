import { NextResponse } from "next/server";
import { getEnvelope, appendAuditEvent } from "@/lib/db";
import { clientIp, clientUserAgent } from "@/lib/request";

// Records a signer's consent to sign electronically as its own audit
// event, distinct from and prior to the signature itself — ESIGN
// requires consent be obtained separately, not bundled into the act
// of signing.
export async function POST(req, { params }) {
  const body = await req.json();
  const { signerId } = body;
  if (!signerId) return NextResponse.json({ error: "signerId is required" }, { status: 400 });

  const envelope = getEnvelope(params.id);
  if (!envelope) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (envelope.status === "pending_payment") {
    return NextResponse.json({ error: "this envelope hasn't been paid for yet" }, { status: 402 });
  }

  const signer = envelope.signers.find((s) => s.id === signerId);
  if (!signer) return NextResponse.json({ error: "signer not found" }, { status: 404 });

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
