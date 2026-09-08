import { NextResponse } from "next/server";
import { getEnvelope, updateEnvelopeFields, computeDocumentHash, setDocumentHash } from "@/lib/db";
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

  // Signing is not replayable. Without these checks, anyone holding a
  // signing link can re-submit after the fact: each replay appends
  // another "signed" event to the audit log with a fresh timestamp and
  // IP, and — on a completed envelope — re-sends the completion email
  // to every party. The audit trail is the evidentiary value of this
  // whole product, so a spurious event in it is worse than the extra
  // email. Mirrors the idempotency guard in finalizeEnvelopePayment.
  if (before.status === "completed") {
    return NextResponse.json({ error: "this envelope is already complete" }, { status: 409 });
  }
  if (before.status === "declined") {
    return NextResponse.json({ error: "a signer declined this envelope, so it can't be signed" }, { status: 409 });
  }

  const priorFields = before.fields.filter((f) => f.signerId === signerId);
  if (priorFields.length > 0 && priorFields.every((f) => f.value)) {
    return NextResponse.json({ error: "you have already signed this envelope" }, { status: 409 });
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
  if (!signer) {
    return NextResponse.json({ error: "signer not found" }, { status: 404 });
  }

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

  let updated = updateEnvelopeFields(params.id, fields, auditEvent);

  // The document fingerprint is computed here, server-side, from the
  // page files actually on disk plus the final field values — once,
  // at the moment of completion, and then stored. It used to be
  // recomputed in each viewer's browser from canvas output, which meant
  // two people could see two different hashes for the same document and
  // nothing authoritative existed to compare against.
  if (updated.status === "completed" && !updated.documentHash) {
    try {
      const withHash = setDocumentHash(params.id, computeDocumentHash(updated));
      if (withHash) updated = withHash;
    } catch (err) {
      // A missing page file shouldn't cost the signer their signature —
      // the fields are already saved. Record it and carry on unhashed.
      console.error("document hash failed:", err);
    }
  }

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
            documentName: updated.documentName,
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
        documentName: updated.documentName,
      });
    }
  } catch (err) {
    // Field values are already saved — a notification email failing
    // shouldn't roll back the signature. Just report it.
    return NextResponse.json({ envelope: updated, notifyError: String(err.message || err) });
  }

  return NextResponse.json({ envelope: updated });
}
