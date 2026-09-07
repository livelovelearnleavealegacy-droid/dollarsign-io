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
export async function sendSigningInvite({
