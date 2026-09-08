import { NextResponse } from "next/server";
import { findEnvelopesByEmail } from "@/lib/db";
import { sendRecoveryLinks } from "@/lib/email";

// Always returns the same generic response whether or not anything was
// found — the only place results actually surface is in the email
// itself, sent to the address that was typed in. This means the
// endpoint can't be used to check whether a given email address has
// documents on file; it can only actually deliver to the real inbox.
export async function POST(req) {
  const { email } = await req.json();

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "please enter a valid email address" }, { status: 400 });
  }

  try {
    const envelopes = findEnvelopesByEmail(email);
    if (envelopes.length > 0) {
      await sendRecoveryLinks({ to: email, envelopes });
    }
  } catch (err) {
    // Deliberately swallowed from the client's perspective — logging
    // server-side is enough. Returning an error here would let someone
    // distinguish "found nothing" from "found something but email
    // failed," which leaks the same information we're trying to hide.
    console.error("recovery email failed:", err);
  }

  return NextResponse.json({
    message: "If we found any documents for that email address, we've sent the links to it.",
  });
}
