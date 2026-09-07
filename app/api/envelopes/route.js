import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createEnvelope } from "@/lib/db";
import { calcPrice, randTrackingId, MAX_PAGES, MAX_SIGNERS } from "@/lib/shared";
import { clientIp, clientUserAgent } from "@/lib/request";

export async function POST(req) {
  const body = await req.json();
  const { senderName, senderEmail, pages, signers, fields } = body;

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
    creatorIp: clientIp(req),
    creatorUserAgent: clientUserAgent(req),
  });

  return NextResponse.json({ envelope });
}
