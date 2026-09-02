// Real Stripe integration. Requires STRIPE_SECRET_KEY — see .env.example.

import Stripe from "stripe";

let _stripe = null;

export function stripeClient() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set — see .env.example");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}
