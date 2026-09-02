import { NextResponse } from "next/server";
import { stripeClient } from "@/lib/stripe";
import { getEnvelope, finalizeEnvelopePayment } from "@/lib/db";
import { sendSigningInvite } from "@/lib/email";

// Stripe requires the RAW request body to verify the webhook signature —
// don't call req.json() before this, it would consume the stream and
// break signature verification.
export async function POST(req) {
  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not set" }, { status: 500 });
  }

  let event;
  try {
    event = stripeClient().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    // Signature didn't verify — this request didn't really come from
    // Stripe. Reject it rather than trusting an unsigned payload.
    return NextResponse.json({ error: `signature verification failed: ${err.message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const envelopeId = session.metadata?.envelopeId;

    if (envelopeId) {
      const envelope = getEnvelope(envelopeId);

      // Idempotency: Stripe retries webhook delivery on any non-2xx
      // response, and can send the same event more than once. Only act
      // if this envelope is still actually waiting on payment.
      if (envelope && envelope.status === "pending_payment") {
        const emailEvents = [];
        for (const signer of envelope.signers) {
          if (signer.isSelf || !signer.email) continue;
          try {
            await sendSigningInvite({
              to: signer.email,
              signerName: signer.name,
              senderName: envelope.senderName,
              envelopeId: envelope.id,
              signerId: signer.id,
              trackingId: envelope.trackingId,
            });
            emailEvents.push({ type: "email_sent", signerId: signer.id, email: signer.email, at: new Date().toISOString() });
          } catch (err) {
            emailEvents.push({ type: "email_failed", signerId: signer.id, email: signer.email, error: String(err.message || err), at: new Date().toISOString() });
          }
        }

        // Status flips to "sent" and every email result is recorded in
        // the same write — a client polling for status never sees a
        // half-finished state.
        finalizeEnvelopePayment(envelopeId, {
          stripeSessionId: session.id,
          amountTotal: session.amount_total,
        }, emailEvents);
      }
    }
  }

  return NextResponse.json({ received: true });
}
