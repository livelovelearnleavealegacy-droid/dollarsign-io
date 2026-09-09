import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createEnvelope } from "@/lib/db";
import {
  calcPrice, randTrackingId, MAX_PAGES, MAX_SIGNERS,
  FIELD_KINDS, SIGNING_MODES, DEFAULT_SIGNING_MODE,
  DEFAULT_EXPIRY_DAYS, MAX_EXPIRY_DAYS,
} from "@/lib/shared";
import { clientIp, clientUserAgent } from "@/lib/request";

const MAX_NAME_LENGTH = 120;

export async function POST(req) {
  const body = await req.json();
  const { senderName, senderEmail, documentName, pages, signers, fields, signingMode, expiresInDays } = body;

  if (!Array.isArray(pages) || pages.length === 0) {
    return NextResponse.json({ error: "at least one page is required" }, { status: 400 });
  }
  if (!Array.isArray(signers) || signers.length === 0) {
    return NextResponse.json({ error: "at least one signer is required" }, { status: 400 });
  }

  // Hard limits are enforced here, server-side — never trust the client's
  // own page/signer counts, since someone could bypass the UI entirely
  // and hit this endpoint directly.
  if (pages.length > MAX_PAGES) {
    return NextResponse.json({ error: `this plan supports up to ${MAX_PAGES} pages` }, { status: 400 });
  }
  if (signers.length > MAX_SIGNERS) {
    return NextResponse.json({ error: `this plan supports up to ${MAX_SIGNERS} signers` }, { status: 400 });
  }

  // Field kinds are validated here for the same reason as the caps: the
  // PDF builder and the signing page both switch on `kind`, and an
  // unknown one would sail through creation and payment only to render
  // as nothing on the finished document — after the customer has paid.
  const badKind = (Array.isArray(fields) ? fields : []).find((f) => !FIELD_KINDS.includes(f?.kind));
  if (badKind) {
    return NextResponse.json(
      { error: `unsupported field type: ${String(badKind.kind)}` },
      { status: 400 }
    );
  }

  const mode = SIGNING_MODES.includes(signingMode) ? signingMode : DEFAULT_SIGNING_MODE;

  // Expiry is stored as an absolute instant computed once, here, rather
  // than as "N days" resolved later against a default that might change.
  // 0 (or an explicit null) means it never expires.
  let expiresAt = null;
  const rawDays = expiresInDays === undefined ? DEFAULT_EXPIRY_DAYS : expiresInDays;
  if (rawDays !== null && rawDays !== 0) {
    const days = Number(rawDays);
    if (!Number.isFinite(days) || days < 1 || days > MAX_EXPIRY_DAYS) {
      return NextResponse.json(
        { error: `expiresInDays must be 0 (never) or between 1 and ${MAX_EXPIRY_DAYS}` },
        { status: 400 }
      );
    }
    expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  }

  const id = randomUUID();
  const trackingId = randTrackingId();

  // Flat pricing — every envelope costs the same as long as it's within
  // the caps checked above. Computed here, server-side, so a tampered
  // client request can't change what Stripe actually charges.
  const price = calcPrice();

  // Status starts as pending_payment: no emails go out and nothing is
  // considered "sent" until the Stripe webhook confirms a real charge.
  const envelope = createEnvelope({
    id, trackingId, senderName, senderEmail, pages, signers, fields, price, status: "pending_payment",
    signingMode: mode,
    expiresAt,
    documentName: typeof documentName === "string" ? documentName.trim().slice(0, MAX_NAME_LENGTH) || null : null,
    creatorIp: clientIp(req),
    creatorUserAgent: clientUserAgent(req),
  });

  return NextResponse.json({ envelope });
}
