// Real email delivery via Resend (https://resend.com).
// Requires RESEND_API_KEY in your environment — see .env.example.

import { Resend } from "resend";

function client() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set — see .env.example");
  }
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = process.env.EMAIL_FROM || "DollarSign.io <envelopes@resend.dev>";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

function shell(title, bodyHtml) {
  return `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#F7FAFC;padding:32px 0;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #E5E8EC;">
      <div style="font-family:Georgia,serif;font-weight:700;font-size:19px;color:#102A43;margin-bottom:4px;">
        DollarSign<span style="color:#2DD4BF;">.io</span>
      </div>
      <div style="font-size:11px;letter-spacing:1px;color:#8A8F98;text-transform:uppercase;margin-bottom:24px;">${title}</div>
      ${bodyHtml}
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #E5E8EC;font-size:11px;color:#9AA0AA;">
        Pay as you go. Sign with confidence.
      </div>
    </div>
  </div>`;
}

function button(href, label) {
  return `<a href="${href}" style="display:inline-block;background:#102A43;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:7px;margin-top:8px;">${label}</a>`;
}

/** Sent when an envelope is first created, to every non-self signer. */
export async function sendSigningInvite({ to, signerName, senderName, envelopeId, signerId, trackingId }) {
  const link = `${APP_URL}/sign/${envelopeId}/${signerId}`;
  const html = shell(
    "You've been asked to sign",
    `
    <p style="font-size:15px;color:#1C2B4A;line-height:1.5;">
      Hi ${escapeHtml(signerName)},<br/><br/>
      ${escapeHtml(senderName || "Someone")} sent you a document to review and sign.
    </p>
    ${button(link, "Review & sign")}
    <p style="font-size:11px;font-family:monospace;color:#9AA0AA;margin-top:20px;">tracking ${trackingId}</p>
    `
  );
  const text = `Hi ${signerName},\n\n${senderName || "Someone"} sent you a document to review and sign.\n\nReview & sign: ${link}\n\ntracking ${trackingId}`;
  return client().emails.send({
    from: FROM,
    to,
    subject: `${senderName || "Someone"} sent you a document to sign — ${trackingId}`,
    html,
    text,
  });
}

/** Sent to the next signer once it becomes their turn (sequential signing). */
export async function sendTurnNotice({ to, signerName, senderName, envelopeId, signerId, trackingId }) {
  const link = `${APP_URL}/sign/${envelopeId}/${signerId}`;
  const html = shell(
    "It's your turn to sign",
    `
    <p style="font-size:15px;color:#1C2B4A;line-height:1.5;">
      Hi ${escapeHtml(signerName)},<br/><br/>
      The other signer${senderName ? " has finished their part on " + escapeHtml(senderName) + "'s envelope" : " has finished their part"}.
      It's your turn now.
    </p>
    ${button(link, "Review & sign")}
    <p style="font-size:11px;font-family:monospace;color:#9AA0AA;margin-top:20px;">tracking ${trackingId}</p>
    `
  );
  const text = `Hi ${signerName},\n\nThe other signer${senderName ? " has finished their part on " + senderName + "'s envelope" : " has finished their part"}. It's your turn now.\n\nReview & sign: ${link}\n\ntracking ${trackingId}`;
  return client().emails.send({
    from: FROM,
    to,
    subject: `Your turn to sign — ${trackingId}`,
    html,
    text,
  });
}

/** Sent to the original sender once every signer has completed their fields. */
export async function sendCompletionNotice({ to, senderName, envelopeId, trackingId }) {
  const link = `${APP_URL}/e/${envelopeId}`;
  const html = shell(
    "Envelope completed",
    `
    <p style="font-size:15px;color:#1C2B4A;line-height:1.5;">
      Hi ${escapeHtml(senderName || "there")},<br/><br/>
      Everyone has signed. Your document is ready to download.
    </p>
    ${button(link, "View & download")}
    <p style="font-size:11px;font-family:monospace;color:#9AA0AA;margin-top:20px;">tracking ${trackingId}</p>
    `
  );
  const text = `Hi ${senderName || "there"},\n\nEveryone has signed. Your document is ready to download.\n\nView & download: ${link}\n\ntracking ${trackingId}`;
  return client().emails.send({
    from: FROM,
    to,
    subject: `Everyone signed — ${trackingId} is complete`,
    html,
    text,
  });
}

function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
