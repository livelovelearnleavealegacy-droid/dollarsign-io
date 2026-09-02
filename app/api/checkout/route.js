import { NextResponse } from "next/server";
import { getEnvelope } from "@/lib/db";
import { stripeClient } from "@/lib/stripe";

export async function POST(req) {
  const { envelopeId } = await req.json();
  if (!envelopeId) return NextResponse.json({ error: "envelopeId is required" }, { status: 400 });

  const envelope = getEnvelope(envelopeId);
  if (!envelope) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (envelope.status !== "pending_payment") {
    return NextResponse.json({ error: "this envelope has already been paid for" }, { status: 400 });
  }

  const appUrl = process.env.APP_URL || "http://localhost:3000";

  // Amount comes from the envelope record we already computed server-side
  // at creation time (lib/shared.js calcPrice) — never recalculated from
  // anything the client sends at checkout time.
  const amountCents = Math.round(envelope.price.total * 100);

  let session;
  try {
    session = await stripeClient().checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: `DollarSign.io envelope — ${envelope.trackingId}`,
            description: `${envelope.signers.length} signer${envelope.signers.length > 1 ? "s" : ""} · ${envelope.pages.length} page${envelope.pages.length !== 1 ? "s" : ""}`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      metadata: { envelopeId: envelope.id },
      success_url: `${appUrl}/checkout/success?envelope=${envelope.id}`,
      cancel_url: `${appUrl}/checkout/cancel?envelope=${envelope.id}`,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}
