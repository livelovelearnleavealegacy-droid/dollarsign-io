import { NextResponse } from "next/server";
import { listAllEnvelopes } from "@/lib/db";
import { REMINDER_DAYS } from "@/lib/shared";

/**
 * The operator view: every envelope, and which ones need a person.
 *
 * Until this existed there was no way to see the business at all — the
 * only window was reading the email log sideways and inferring. That is
 * workable at two envelopes a day and useless at twenty.
 *
 * Read-only. Gated on ADMIN_TOKEN, and 404s when the variable is unset
 * so an unconfigured deploy exposes nothing.
 */
export const dynamic = "force-dynamic";

// An envelope that is merely waiting is normal. These are the states
// where waiting will never resolve on its own, which is the only useful
// definition of "needs attention".
const STALLED_DAYS = 7;

function daysSince(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Number.isFinite(ms) ? +(ms / 864e5).toFixed(1) : null;
}

export async function GET(req) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return NextResponse.json({ error: "not found" }, { status: 404 });
  const url = new URL(req.url);
  const provided = req.headers.get("x-admin-token") || url.searchParams.get("token");
  if (provided !== expected) return NextResponse.json({ error: "not found" }, { status: 404 });

  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit"), 10) || 200, 1), 500);
  const statusFilter = url.searchParams.get("status") || null;

  const envelopes = listAllEnvelopes({ limit, status: statusFilter });
  const now = Date.now();

  const rows = envelopes.map((e) => {
    const log = e.auditLog || [];
    const paid = log.find((x) => x.type === "paid");
    const sentAt = paid?.at || null;

    const signers = (e.signers || []).map((s) => {
      const theirs = (e.fields || []).filter((f) => f.signerId === s.id);
      const done = theirs.length > 0 && theirs.every((f) => f.value);
      // A bounce that was corrected afterwards is history, not a problem.
      const bounce = log.find(
        (x) =>
          x.type === "email_bounced" &&
          (x.signerId === s.id || String(x.email || "").toLowerCase() === String(s.email || "").toLowerCase())
      );
      const correctedAfter =
        bounce && log.some((x) => x.type === "address_corrected" && x.signerId === s.id && x.at > bounce.at);
      return {
        name: s.name || null,
        email: s.email || null,
        isSelf: !!s.isSelf,
        hasFields: theirs.length > 0,
        signed: done,
        undeliverable: !!bounce && !correctedAfter,
      };
    });

    const outstanding = signers.filter((s) => s.hasFields && !s.signed);
    const ageDays = daysSince(e.createdAt);
    const sentDays = daysSince(sentAt);

    // Why a person needs to look, in plain words. An empty list means
    // this envelope is fine and nobody has to think about it.
    const attention = [];
    if (signers.some((s) => s.undeliverable)) attention.push("undeliverable address");
    if (e.status === "pending_payment" && paid) attention.push("paid but never sent");
    if (e.status === "pending_payment" && ageDays !== null && ageDays > 1) attention.push("abandoned before payment");
    if (e.status === "sent" && sentDays !== null && sentDays >= STALLED_DAYS) attention.push(`no movement in ${Math.floor(sentDays)} days`);
    if (e.status === "completed" && !e.documentHash) attention.push("completed without a fingerprint");
    if (log.some((x) => x.type === "email_failed")) attention.push("an email failed to send");

    const expiresInDays = e.expiresAt ? +((new Date(e.expiresAt).getTime() - now) / 864e5).toFixed(1) : null;
    if (e.status === "sent" && expiresInDays !== null && expiresInDays <= 3 && expiresInDays > 0) {
      attention.push(`expires in ${Math.max(0, Math.floor(expiresInDays))} days`);
    }

    return {
      id: e.id,
      trackingId: e.trackingId,
      documentName: e.documentName,
      status: e.status,
      senderName: e.senderName,
      senderEmail: e.senderEmail,
      createdAt: e.createdAt,
      sentAt,
      ageDays,
      sentDays,
      expiresAt: e.expiresAt || null,
      expiresInDays,
      pageCount: (e.pages || []).length,
      fieldCount: (e.fields || []).length,
      signingMode: e.signingMode || "parallel",
      remindersSent: e.remindersSent || 0,
      remindersMax: REMINDER_DAYS.length,
      signers,
      signedCount: signers.filter((s) => s.signed).length,
      signerCount: signers.filter((s) => s.hasFields).length,
      waitingOn: outstanding.map((s) => s.name || s.email || "a signer"),
      hasFingerprint: !!e.documentHash,
      attention,
    };
  });

  const count = (s) => rows.filter((r) => r.status === s).length;
  const last30 = rows.filter((r) => r.ageDays !== null && r.ageDays <= 30);

  return NextResponse.json({
    at: new Date().toISOString(),
    returned: rows.length,
    limit,
    summary: {
      needsAttention: rows.filter((r) => r.attention.length).length,
      awaitingSignature: count("sent"),
      completed: count("completed"),
      unpaidDrafts: count("pending_payment"),
      declined: count("declined"),
      voided: count("voided"),
      expired: count("expired"),
      completedLast30Days: last30.filter((r) => r.status === "completed").length,
      sentLast30Days: last30.filter((r) => r.sentAt).length,
    },
    envelopes: rows,
  });
}
