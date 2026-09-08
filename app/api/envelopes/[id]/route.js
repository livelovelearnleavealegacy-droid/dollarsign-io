import { NextResponse } from "next/server";
import { getEnvelope, updateEnvelopeFields } from "@/lib/db";
import { sendTurnNotice, sendCompletionNotice } from "@/lib/email";
import { clientIp, clientUserAgent } from "@/lib/request";

export async function GET(req, { params }) {
  const envelope = getEnvelope(params.id);
  if (!envelope) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(envelope);
}

// body: { fields: [{ id, value }], signerId, attested: true, reviewedAllPages: true }
// signerId is whoever just submitted, so we know whose turn is next.
export async function PATCH(req, { params }) {
  const body = await req.json();
  const { fields, signerId, attested, reviewedAllPages } = body;
  const before = getEnvelope(params.id);
  if (!before) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (before.status === "pending_payment") {
    return NextResponse.json({ error: "this envelope hasn't been paid for yet" }, { status: 402 });
  }

  // ESIGN requires consent be obtained separately from the act of
  // signing, and requires clear intent to sign. Both are enforced here
  // server-side — a client that skips the consent screen or the
  // attestation checkbox simply gets rejected, it isn't just hidden UI.
  const hasConsented = (before.auditLog || []).some((e) => e.type === "consent" && e.signerId === signerId);
  if (!hasConsented) {
    return NextResponse.json({ error: "signer has not consented to sign electronically" }, { status: 403 });
  }
  if (attested !== true) {
    return NextResponse.json({ error: "signer must affirm intent to sign" }, { status: 400 });
  }
  if (reviewedAllPages !== true) {
    return NextResponse.json({ error: "signer must review all pages before signing" }, { status: 400 });
  }

  const signer = before.signers.find((s) => s.id === signerId);

  // Server-recorded, not client-reported — this is what gives the audit
  // trail evidentiary weight. The signer's browser never gets a say in
  // what IP or timestamp gets written down.
  const auditEvent = {
    signerId,
    signerName: signer?.name || null,
    signerEmail: signer?.email || null,
    ip: clientIp(req),
    userAgent: clientUserAgent(req),
    at: new Date().toISOString(),
    fieldIds: fields.map((f) => f.id),
    attested: true,
    reviewedAllPages: true,
  };

  const updated = updateEnvelopeFields(params.id, fields, auditEvent);

  // Figure out signing order from the signers array and notify whoever is next.
  const order = updated.signers.map((s) => s.id);
  const currentIdx = order.indexOf(signerId);
  const nextSigner = updated.signers[currentIdx + 1];
  const currentSignerDone = updated.fields
    .filter((f) => f.signerId === signerId)
    .every((f) => f.value);

  try {
    if (updated.status === "completed") {
      // Everyone who was part of this envelope gets the final document —
      // the sender AND every signer with a real email address. Previously
      // this only notified the sender, leaving signers with no way to
      // ever receive their own copy of what they signed.
      const recipients = [];
      if (updated.senderEmail) recipients.push(updated.senderEmail);
      for (const s of updated.signers) {
        if (s.email && !recipients.includes(s.email)) recipients.push(s.email);
      }

      const results = await Promise.allSettled(
        recipients.map((to) =>
          sendCompletionNotice({
            to,
            senderName: updated.senderName,
            envelopeId: params.id,
            trackingId: updated.trackingId,
          })
        )
      );
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length) {
        return NextResponse.json({
          envelope: updated,
          notifyError: failures.map((f) => String(f.reason?.message || f.reason)).join("; "),
        });
      }
    } else if (currentSignerDone && nextSigner && nextSigner.email && !nextSigner.isSelf) {
      await sendTurnNotice({
        to: nextSigner.email,
        signerName: nextSigner.name,
        senderName: updated.senderName,
        envelopeId: params.id,
        signerId: nextSigner.id,
        trackingId: updated.trackingId,
      });
    }
  } catch (err) {
    // Field values are already saved — a notification email failing
    // shouldn't roll back the signature. Just report it.
    return NextResponse.json({ envelope: updated, notifyError: String(err.message || err) });
  }

  return NextResponse.json({ envelope: updated });
}
