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

// Appended to the plain-text body of every email. The HTML shell below
// carries the same links; this keeps them present for clients that
// render text only. Every transactional email is therefore also a
// self-service support entry point, which is the cheapest kind.
const TEXT_FOOTER = `

--
Questions? support@dollarsign.io
FAQ & support: ${APP_URL}/faq
Lost your link? ${APP_URL}/find-my-document`;

// Documents are named now, so say the name where there is one. A person
// with three envelopes in flight can't tell ENV-84QTU2 from ENV-3EMDZ8,
// but they know which one is the lease.
function docLabel(documentName, trackingId) {
  return documentName ? `${documentName} (${trackingId})` : trackingId;
}

function shell(title, bodyHtml) {
  return `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#F7FAFC;padding:32px 0;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #E5E8EC;">
      <div style="font-family:Georgia,serif;font-weight:700;font-size:19px;color:#102A43;margin-bottom:4px;">
        DollarSign<span style="color:#2DD4BF;">.io</span>
      </div>
      <div style="font-size:11px;letter-spacing:1px;color:#8A8F98;text-transform:uppercase;margin-bottom:24px;">${title}</div>
      ${bodyHtml}
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #E5E8EC;font-size:11px;line-height:1.9;color:#9AA0AA;">
        Pay as you go. Sign with confidence.<br/>
        <a href="${APP_URL}/faq" style="color:#9AA0AA;">FAQ &amp; support</a> &middot;
        <a href="${APP_URL}/find-my-document" style="color:#9AA0AA;">Find my document</a> &middot;
        <a href="${APP_URL}/terms" style="color:#9AA0AA;">Terms</a> &middot;
        <a href="${APP_URL}/privacy" style="color:#9AA0AA;">Privacy</a><br/>
        Questions? <a href="mailto:support@dollarsign.io" style="color:#9AA0AA;">support@dollarsign.io</a>
      </div>
    </div>
  </div>`;
}

function button(href, label) {
  return `<a href="${href}" style="display:inline-block;background:#102A43;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:7px;margin-top:8px;">${label}</a>`;
}

function docLine(documentName) {
  if (!documentName) return "";
  return `<p style="font-size:15px;color:#102A43;font-weight:600;margin:0 0 4px;">${escapeHtml(documentName)}</p>`;
}

/** Sent when an envelope is first created, to every non-self signer. */
export async function sendSigningInvite({ to, signerName, senderName, envelopeId, signerId, trackingId, documentName }) {
  const link = `${APP_URL}/sign/${envelopeId}/${signerId}`;
  const html = shell(
    "You've been asked to sign",
    `
    ${docLine(documentName)}
    <p style="font-size:15px;color:#1C2B4A;line-height:1.5;">
      Hi ${escapeHtml(signerName)},<br/><br/>
      ${escapeHtml(senderName || "Someone")} sent you a document to review and sign.
    </p>
    ${button(link, "Review & sign")}
    <p style="font-size:11px;font-family:monospace;color:#9AA0AA;margin-top:20px;">tracking ${trackingId}</p>
    `
  );
  const text = `Hi ${signerName},\n\n${senderName || "Someone"} sent you a document to review and sign.${documentName ? `\n\nDocument: ${documentName}` : ""}\n\nReview & sign: ${link}\n\ntracking ${trackingId}`;
  return client().emails.send({
    from: FROM,
    to,
    subject: `${senderName || "Someone"} sent you a document to sign — ${docLabel(documentName, trackingId)}`,
    html,
    text: text + TEXT_FOOTER,
  });
}

/** Sent to the next signer once it becomes their turn (sequential signing). */
export async function sendTurnNotice({ to, signerName, senderName, envelopeId, signerId, trackingId, documentName }) {
  const link = `${APP_URL}/sign/${envelopeId}/${signerId}`;
  const html = shell(
    "It's your turn to sign",
    `
    ${docLine(documentName)}
    <p style="font-size:15px;color:#1C2B4A;line-height:1.5;">
      Hi ${escapeHtml(signerName)},<br/><br/>
      The other signer${senderName ? " has finished their part on " + escapeHtml(senderName) + "'s envelope" : " has finished their part"}.
      It's your turn now.
    </p>
    ${button(link, "Review & sign")}
    <p style="font-size:11px;font-family:monospace;color:#9AA0AA;margin-top:20px;">tracking ${trackingId}</p>
    `
  );
  const text = `Hi ${signerName},\n\nThe other signer${senderName ? " has finished their part on " + senderName + "'s envelope" : " has finished their part"}. It's your turn now.${documentName ? `\n\nDocument: ${documentName}` : ""}\n\nReview & sign: ${link}\n\ntracking ${trackingId}`;
  return client().emails.send({
    from: FROM,
    to,
    subject: `Your turn to sign — ${docLabel(documentName, trackingId)}`,
    html,
    text: text + TEXT_FOOTER,
  });
}

/** Sent to the sender AND every signer once everyone has completed their fields. */
export async function sendCompletionNotice({ to, senderName, envelopeId, trackingId, documentName }) {
  const link = `${APP_URL}/e/${envelopeId}`;
  const html = shell(
    "Envelope completed",
    `
    ${docLine(documentName)}
    <p style="font-size:15px;color:#1C2B4A;line-height:1.5;">
      Hi ${escapeHtml(senderName || "there")},<br/><br/>
      Everyone has signed. Your document is ready to download.
    </p>
    ${button(link, "View & download")}
    <p style="font-size:11px;font-family:monospace;color:#9AA0AA;margin-top:20px;">tracking ${trackingId}</p>
    `
  );
  const text = `Hi ${senderName || "there"},\n\nEveryone has signed. Your document is ready to download.${documentName ? `\n\nDocument: ${documentName}` : ""}\n\nView & download: ${link}\n\ntracking ${trackingId}`;
  return client().emails.send({
    from: FROM,
    to,
    subject: `Everyone signed — ${docLabel(documentName, trackingId)} is complete`,
    html,
    text: text + TEXT_FOOTER,
  });
}

/**
 * Sent when a signer declines. Goes to the sender and to every other
 * signer with an email address: the rest of them were waiting on a
 * document that is now never going to complete, and silence is the
 * worst possible outcome there.
 */
export async function sendDeclineNotice({ to, declinerName, reason, envelopeId, trackingId, documentName }) {
  const link = `${APP_URL}/e/${envelopeId}`;
  const html = shell(
    "Signing declined",
    `
    ${docLine(documentName)}
    <p style="font-size:15px;color:#1C2B4A;line-height:1.5;">
      ${escapeHtml(declinerName || "A signer")} declined to sign this document, so it won't be completed.
    </p>
    ${reason ? `<p style="font-size:15px;color:#1C2B4A;line-height:1.5;background:#F7FAFC;border-left:3px solid #E5E8EC;padding:10px 14px;margin:14px 0;">${escapeHtml(reason)}</p>` : ""}
    <p style="font-size:15px;color:#1C2B4A;line-height:1.5;">
      No further signatures can be added. If you still need this signed, send a new envelope.
    </p>
    ${button(link, "View status")}
    <p style="font-size:11px;font-family:monospace;color:#9AA0AA;margin-top:20px;">tracking ${trackingId}</p>
    `
  );
  const text = `${declinerName || "A signer"} declined to sign this document, so it won't be completed.${documentName ? `\n\nDocument: ${documentName}` : ""}${reason ? `\n\nReason given: ${reason}` : ""}\n\nNo further signatures can be added. If you still need this signed, send a new envelope.\n\nView status: ${link}\n\ntracking ${trackingId}`;
  return client().emails.send({
    from: FROM,
    to,
    subject: `Signing declined — ${docLabel(documentName, trackingId)}`,
    html,
    text: text + TEXT_FOOTER,
  });
}

/**
 * Sent from the "find my document" recovery flow. Lists every envelope
 * found for the requesting email, each linking to its status/download
 * page. This is the only output of the recovery flow — the page itself
 * never reveals whether anything was found, only this email does.
 */
export async function sendRecoveryLinks({ to, envelopes }) {
  const statusLabelOf = (e) =>
    e.status === "completed" ? "Completed" : e.status === "declined" ? "Declined" : "In progress";

  const rows = envelopes.map((e) => {
    const link = `${APP_URL}/e/${e.id}`;
    return `
      <div style="padding:12px 0;border-bottom:1px solid #E5E8EC;">
        <div style="font-size:14px;color:#1C2B4A;font-weight:600;">${escapeHtml(e.documentName || "Untitled document")}</div>
        <div style="font-size:12px;color:#8A8F98;margin:2px 0 4px;">tracking ${e.trackingId} — ${statusLabelOf(e)}</div>
        ${button(link, "View document")}
      </div>
    `;
  }).join("");

  const html = shell(
    "Your documents",
    `
    <p style="font-size:15px;color:#1C2B4A;line-height:1.5;">
      Here ${envelopes.length === 1 ? "is the document" : "are the documents"} we found for this email address:
    </p>
    ${rows}
    `
  );

  const textLines = envelopes.map((e) =>
    `${e.documentName || "Untitled document"} — tracking ${e.trackingId} (${statusLabelOf(e)}): ${APP_URL}/e/${e.id}`
  );
  const text = `Here ${envelopes.length === 1 ? "is the document" : "are the documents"} we found for this email address:\n\n${textLines.join("\n\n")}`;

  return client().emails.send({
    from: FROM,
    to,
    subject: `Your DollarSign.io document${envelopes.length === 1 ? "" : "s"}`,
    html,
    text: text + TEXT_FOOTER,
  });
}

function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
