import { NextResponse } from "next/server";
import { getEnvelope, updateEnvelopeFields, computeDocumentHash, setDocumentHash } from "@/lib/db";
import { sendTurnNotice, sendCompletionNotice } from "@/lib/email";
import { clientIp, clientUserAgent } from "@/lib/request";
import { blockedReason } from "@/lib/guards";

export async function GET(req, { params }) {
  const envelope = getEnvelope(params.id);
  if (!envelope) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(envelope);
}

// Signers who still owe a signature, in the order the sender listed
// them. In sequential mode the first entry is whose turn it is; in
// parallel mode this is only used to decide who, if anyone, still needs
// chasing.
function outstandingSigners(envelope) {
  return envelope.signers.filter((s) => {
    const theirs = envelope.fields.filter((f) => f.signerId === s.id);
    return theirs.length > 0 && !theirs.every((f) => f.value);
  });
}

// body: { fields: [{ id, value }], signerId, attested: true, reviewedAllPages: true }
// signerId is whoever just submitted, so we know whose turn is next.
export async function PATCH(req, { params }) {
  const body = await req.json();
  const { fields, signerId, attested, reviewedAllPages } = body;
  const before = getEnvelope(params.id);
  if (!before) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Signing is not replayable, and a terminal envelope never reopens.
  // Without this, anyone holding a signing link can re-submit after the
  // fact: each replay appends another "signed" event to the audit log
  // with a fresh timestamp and IP, and — on a completed envelope —
  // re-sends the completion email to every party. The audit trail is
  // the evidentiary value of this whole product, so a spurious event in
  // it is worse than the extra email. The blocked set lives in
  // lib/guards.js so every route agrees on it.
  const blocked = blockedReason(before, {
    pending_payment: "this envelope hasn't been paid for yet",
    completed: "this envelope is already complete",
    declined: "a signer declined this envelope, so it can't be signed",
    voided: "the sender voided this envelope, so it can't be signed",
    expired: "this envelope expired before everyone signed, so it can't be signed",
  });
  if (blocked) return NextResponse.json({ error: blocked.error }, { status: blocked.status });

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

  // Sequential envelopes enforce their order here rather than relying on
  // who happens to hold a link. Until now nothing enforced order at all:
  // every signer was emailed at payment and signer three could sign
  // before signer one, while the emails said "it's your turn" — so the
  // order was a suggestion the product appeared to make and did not
  // keep. Parallel envelopes deliberately skip this check.
  if (before.signingMode === "sequential") {
    const queue = outstandingSigners(before);
    const current = queue[0];
    if (current && current.id !== signerId) {
      return NextResponse.json({
        error: `This document is being signed in order, and it isn't your turn yet. ${current.name || "Another signer"} needs to sign first — you'll be emailed when it reaches you.`,
      }, { status: 403 });
    }
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
  // at the moment of completion, and then stored.
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

  // Whose turn is next. Only meaningful in sequential mode: in parallel
  // mode everybody was invited at payment, so a "your turn" email would
  // be a second, contradictory nudge for a link they already have.
  const nextSigner = updated.signingMode === "sequential" ? outstandingSigners(updated)[0] : null;

  try {
    if (updated.status === "completed") {
      // Everyone who was part of this envelope gets the final document —
      // the sender AND every signer with a real email address.
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
    } else if (nextSigner && nextSigner.email && !nextSigner.isSelf) {
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
