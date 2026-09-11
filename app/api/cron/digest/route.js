import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Resend } from "resend";
import { listAllEnvelopes, countTestEnvelopes, listPageFileRows, listSourceFileRows } from "@/lib/db";
import { FLAT_PRICE } from "@/lib/shared";

/**
 * The daily digest.
 *
 * Every other alarm on this system only speaks when something is wrong:
 * UptimeRobot on a failed health check, GitHub on a failed workflow. That
 * is correct for alarms and useless for knowing how the business is
 * doing. This is the other half — a short note every morning saying what
 * happened and whether anything needs a person.
 *
 * The design constraint for a DAILY report is that most days are quiet,
 * and a quiet report nobody needs to open must still be readable without
 * opening it. So the subject line carries the whole story:
 *
 *   DollarSign daily — all clear · 2 sent, 1 completed
 *   DollarSign daily — 1 needs you · 0 sent, 0 completed
 *
 * If the subject says "all clear", the body is a formality. That is the
 * point. A report that requires opening to learn nothing happened is a
 * report you stop reading inside a fortnight.
 *
 * Gated on CRON_TOKEN and 404s when unset, matching the reminders cron:
 * an endpoint that sends mail should not advertise that it exists.
 */

const WINDOW_HOURS = 24;
const STALLED_DAYS = 7;
// Same fixed cutoff as the operator view: envelopes completed before
// server-side fingerprinting shipped carry documentHash: null forever and
// there is nothing to fix. See app/api/admin/envelopes/route.js.
const FINGERPRINT_SINCE = Date.parse("2026-09-09T00:00:00Z");

function authorised(req) {
  const expected = process.env.CRON_TOKEN;
  if (!expected) return false;
  const header = req.headers.get("x-cron-token");
  const query = new URL(req.url).searchParams.get("token");
  return header === expected || query === expected;
}

const at = (log, type) => log.find((x) => x.type === type)?.at || null;
const inWindow = (iso, since) => {
  const t = Date.parse(iso || "");
  return Number.isFinite(t) && t >= since;
};

// Why a person needs to look. Deliberately the same list as /admin —
// every flag has an action attached, because a number that is mostly
// noise trains you to stop reading it.
function attentionFor(e, now) {
  const log = e.auditLog || [];
  const signers = e.signers || [];
  const out = [];
  if (e.status === "sent" && signers.some((s) => s.undeliverable && !s.signed)) out.push("undeliverable address");
  if (e.status === "pending_payment" && at(log, "paid")) out.push("paid but never sent");
  const sentAt = Date.parse(at(log, "paid") || "");
  if (e.status === "sent" && Number.isFinite(sentAt)) {
    const days = (now - sentAt) / 864e5;
    if (days >= STALLED_DAYS) out.push(`no movement in ${Math.floor(days)} days`);
  }
  const completedAt = Date.parse(at(log, "completed") || "");
  if (e.status === "completed" && !e.documentHash && Number.isFinite(completedAt) && completedAt >= FINGERPRINT_SINCE) {
    out.push("completed without a fingerprint");
  }
  if (log.some((x) => x.type === "email_failed")) out.push("an email failed to send");
  if (e.status === "sent" && e.expiresAt) {
    const d = (Date.parse(e.expiresAt) - now) / 864e5;
    if (d > 0 && d <= 3) out.push(`expires in ${Math.floor(d)} days`);
  }
  return out;
}

function volumeUsage() {
  try {
    const root = path.dirname(process.env.DB_PATH || path.join(process.cwd(), "dollarsign.db"));
    const s = fs.statfsSync(root);
    const total = s.blocks * s.bsize;
    const free = s.bfree * s.bsize;
    return { usedPct: Math.round(((total - free) / total) * 100), totalGb: +(total / 1073741824).toFixed(1) };
  } catch {
    return null;
  }
}

export async function GET(req) {
  if (!authorised(req)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const now = Date.now();
  const since = now - WINDOW_HOURS * 3600e3;
  // A generous window: enough to cover every open envelope plus a day of
  // completions, without paging. Raise it if volume ever makes it tight.
  const envelopes = listAllEnvelopes({ limit: 1000 });

  const created = [], paid = [], completed = [], ended = [];
  for (const e of envelopes) {
    const log = e.auditLog || [];
    if (inWindow(e.createdAt, since)) created.push(e);
    if (inWindow(at(log, "paid"), since)) paid.push(e);
    if (inWindow(at(log, "completed"), since)) completed.push(e);
    for (const t of ["declined", "voided", "expired"]) {
      if (inWindow(at(log, t), since)) ended.push({ e, how: t });
    }
  }

  const open = envelopes.filter((e) => e.status === "sent").length;
  const awaitingPayment = envelopes.filter((e) => e.status === "pending_payment").length;

  const needsYou = [];
  for (const e of envelopes) {
    const reasons = attentionFor(e, now);
    if (reasons.length) needsYou.push({ trackingId: e.trackingId, name: e.documentName || null, reasons });
  }

  const creditsIssued = envelopes.filter((e) => inWindow(at(e.auditLog || [], "credit_issued"), since)).length;
  const bounces = envelopes.filter((e) =>
    (e.auditLog || []).some((x) => (x.type === "email_bounced" || x.type === "email_failed") && inWindow(x.at, since))
  ).length;

  const vol = volumeUsage();
  const revenue = paid.length * FLAT_PRICE;

  const summary = {
    windowHours: WINDOW_HOURS,
    created: created.length,
    paid: paid.length,
    completed: completed.length,
    ended: ended.length,
    revenue: +revenue.toFixed(2),
    open,
    awaitingPayment,
    needsYou: needsYou.length,
    creditsIssued,
    bounces,
    testDrafts: countTestEnvelopes(),
    storage: vol ? { usedPct: vol.usedPct, totalGb: vol.totalGb, pageFiles: listPageFileRows().length, sourcePdfs: listSourceFileRows().length } : null,
  };

  // The subject IS the report on a quiet day.
  const verdict = needsYou.length
    ? `${needsYou.length} ${needsYou.length === 1 ? "needs" : "need"} you`
    : "all clear";
  const subject = `DollarSign daily — ${verdict} · ${paid.length} sent, ${completed.length} completed`;

  const lines = [];
  lines.push(`Last ${WINDOW_HOURS} hours`);
  lines.push(`  Sent (paid):     ${paid.length}`);
  lines.push(`  Completed:       ${completed.length}`);
  lines.push(`  Started:         ${created.length}`);
  if (ended.length) lines.push(`  Ended early:     ${ended.length} (${ended.map((x) => x.how).join(", ")})`);
  lines.push(`  Revenue:         $${revenue.toFixed(2)}`);
  if (creditsIssued) lines.push(`  Credits issued:  ${creditsIssued}`);
  if (bounces) lines.push(`  Delivery issues: ${bounces}`);
  lines.push("");
  lines.push("Right now");
  lines.push(`  Out for signature: ${open}`);
  lines.push(`  Awaiting payment:  ${awaitingPayment}`);
  if (vol) lines.push(`  Volume:            ${vol.usedPct}% of ${vol.totalGb} GB · ${summary.storage.pageFiles} page files, ${summary.storage.sourcePdfs} source PDFs`);
  lines.push("");
  if (needsYou.length) {
    lines.push("NEEDS YOU");
    for (const n of needsYou) {
      lines.push(`  ${n.trackingId}${n.name ? ` — ${n.name}` : ""}`);
      for (const r of n.reasons) lines.push(`      · ${r}`);
    }
    lines.push("");
    lines.push(`Open the operator view: ${process.env.APP_URL || "https://dollarsign.io"}/admin`);
  } else {
    lines.push("Nothing needs you today.");
  }
  const text = lines.join("\n");

  const html = `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#F7FAFC;padding:32px 0;">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #E5E8EC;">
      <div style="font-family:Georgia,serif;font-weight:700;font-size:19px;color:#102A43;">DollarSign<span style="color:#2DD4BF;">.io</span></div>
      <div style="font-size:11px;letter-spacing:1px;color:#8A8F98;text-transform:uppercase;margin:4px 0 20px;">Daily digest</div>
      <div style="font-size:15px;font-weight:700;color:${needsYou.length ? "#C1440E" : "#4E8B5A"};margin-bottom:16px;">${verdict}</div>
      <pre style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;line-height:1.6;color:#3C4655;white-space:pre-wrap;margin:0;">${text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</pre>
    </div>
  </div>`;

  const to = process.env.DIGEST_TO || "support@dollarsign.io";
  let delivered = false, error = null;
  try {
    if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "DollarSign.io <envelopes@resend.dev>",
      to,
      subject,
      text,
      html,
    });
    delivered = true;
  } catch (err) {
    // Never fail the request on a send error — the workflow log should
    // still carry the numbers, so a broken mailer doesn't also blind you.
    error = err?.message || String(err);
    console.error("digest send failed:", error);
  }

  return NextResponse.json({ ok: true, delivered, to, subject, error, summary });
}
