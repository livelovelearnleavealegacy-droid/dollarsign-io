import { NextResponse } from "next/server";
import { listOpenEnvelopes, expireEnvelope, recordReminder } from "@/lib/db";
import { sendReminder, sendExpiryNotice } from "@/lib/email";
import { REMINDER_DAYS, REMINDER_MAX, REMINDER_WINDOW_DAYS } from "@/lib/shared";

/**
 * The scheduler this app doesn't have.
 *
 * There is no cron inside the container, so an external caller (a
 * GitHub Actions workflow — see .github/workflows/reminders.yml) hits
 * this once a day. Everything it does is idempotent and derived from
 * the envelope's own stored state, so running it twice in a day, or
 * missing a day entirely, changes nothing except when a reminder lands.
 *
 * Gated on CRON_TOKEN and 404s when the variable is unset, matching the
 * orphan report: an endpoint that sends mail and closes envelopes should
 * not even advertise that it exists.
 */

function authorised(req) {
  const expected = process.env.CRON_TOKEN;
  if (!expected) return false;
  const header = req.headers.get("x-cron-token");
  const query = new URL(req.url).searchParams.get("token");
  return header === expected || query === expected;
}

// When the clock started for this envelope: the moment invites actually
// went out, not when the draft was created. An envelope created on
// Monday and paid for on Friday should not arrive with a reminder
// already overdue.
function sentAt(envelope) {
  const paid = (envelope.auditLog || []).find((e) => e.type === "paid");
  return new Date(paid?.at || envelope.createdAt || Date.now()).getTime();
}

function daysSince(ms) {
  return (Date.now() - ms) / (24 * 60 * 60 * 1000);
}

function outstandingSigners(envelope) {
  return envelope.signers.filter((s) => {
    const theirs = envelope.fields.filter((f) => f.signerId === s.id);
    return theirs.length > 0 && !theirs.every((f) => f.value);
  });
}

export async function POST(req) {
  if (!authorised(req)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const now = Date.now();
  const result = { scanned: 0, expired: [], remindersSent: [], errors: [] };

  for (const envelope of listOpenEnvelopes()) {
    result.scanned++;
    try {
      /* ---------- expiry first ---------- */
      if (envelope.expiresAt && now > new Date(envelope.expiresAt).getTime()) {
        const signed = envelope.signers.length - outstandingSigners(envelope).length;
        const updated = expireEnvelope(envelope.id, {
          at: new Date().toISOString(),
          expiresAt: envelope.expiresAt,
          signedCount: signed,
          signerCount: envelope.signers.length,
        });

        // Status is already flipped and the signing links are already
        // dead. A failed notification must not undo that, so mail is
        // sent afterwards and failures are reported, not thrown.
        const recipients = [];
        if (updated?.senderEmail) recipients.push(updated.senderEmail);
        for (const s of (updated?.signers || [])) {
          if (s.email && !recipients.includes(s.email)) recipients.push(s.email);
        }
        const sent = await Promise.allSettled(recipients.map((to) =>
          sendExpiryNotice({
            to,
            senderName: updated.senderName,
            envelopeId: updated.id,
            trackingId: updated.trackingId,
            documentName: updated.documentName,
            signedCount: signed,
            signerCount: updated.signers.length,
          })
        ));
        const failed = sent.filter((r) => r.status === "rejected").length;
        result.expired.push({ trackingId: envelope.trackingId, notified: recipients.length - failed, failed });
        continue; // an expired envelope never also gets a reminder
      }

      /* ---------- reminders ---------- */
      const already = envelope.remindersSent || 0;
      if (already >= REMINDER_MAX) continue;

      const dueAfterDays = REMINDER_DAYS[already];
      const age = daysSince(sentAt(envelope));
      if (age < dueAfterDays) continue;
      // Closed window: too late for this nudge to be useful, and it
      // keeps a backlog of long-stale envelopes from all being mailed
      // on the first run after this feature ships.
      if (age > dueAfterDays + REMINDER_WINDOW_DAYS) {
        result.skippedTooOld = (result.skippedTooOld || 0) + 1;
        continue;
      }

      const targets = outstandingSigners(envelope).filter((s) => s.email && !s.isSelf);
      if (targets.length === 0) continue;

      const sent = await Promise.allSettled(targets.map((s) =>
        sendReminder({
          to: s.email,
          signerName: s.name,
          senderName: envelope.senderName,
          envelopeId: envelope.id,
          signerId: s.id,
          trackingId: envelope.trackingId,
          documentName: envelope.documentName,
          expiresAt: envelope.expiresAt,
        })
      ));
      const ok = sent.filter((r) => r.status === "fulfilled").length;

      // The counter advances even if some mail failed. It is a rate
      // limit, not a delivery receipt — retrying a failed address on
      // tomorrow's run would be indistinguishable from nagging, and the
      // sender can always resend an invite by hand.
      recordReminder(envelope.id, {
        at: new Date().toISOString(),
        reminderNumber: already + 1,
        signerIds: targets.map((s) => s.id),
        signerEmail: targets.map((s) => s.email).join(", "),
        delivered: ok,
        failed: targets.length - ok,
      });
      result.remindersSent.push({ trackingId: envelope.trackingId, reminder: already + 1, delivered: ok, failed: targets.length - ok });
    } catch (err) {
      // One bad envelope must not stop the sweep.
      result.errors.push({ trackingId: envelope.trackingId, error: String(err?.message || err) });
    }
  }

  return NextResponse.json(result);
}
