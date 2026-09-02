import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createEnvelope } from "@/lib/db";
import { calcPrice, randTrackingId } from "@/lib/shared";
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

  const id = randomUUID();
  const trackingId = randTrackingId();

  // Price is computed here, server-side, from the actual page count and
  // signer count — never trusted from the client. This is what Stripe
  // will charge, so a client sending a fabricated price can't matter.
  const price = calcPrice(signers, pages.length);

  // Status starts as pending_payment: no emails go out and nothing is
  // considered "sent" until the Stripe webhook confirms a real charge.
  const envelope = createEnvelope({
    id, trackingId, senderName, senderEmail, pages, signers, fields, price, status: "pending_payment",
    creatorIp: clientIp(req),
    creatorUserAgent: clientUserAgent(req),
  });

  return NextResponse.json({ envelope });
}
