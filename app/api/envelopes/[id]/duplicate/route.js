import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getEnvelope, createEnvelope } from "@/lib/db";
import { calcPrice, randTrackingId, DEFAULT_EXPIRY_DAYS, MAX_EXPIRY_DAYS } from "@/lib/shared";
import { clientIp, clientUserAgent } from "@/lib/request";

/**
 * "Send another like this" — the closest thing to templates that a
 * product with no accounts can honestly offer.
 *
 * A landlord sending the same lease twenty times would otherwise
 * re-upload the document and re-place every field each time. Here,
 * possession of the envelope link is the authorisation (the same basis
 * as the void request flow), and the copy reuses the ORIGINAL PAGE FILE
 * IDS — no re-upload, no second copy of the images on disk. Two
 * envelopes referencing one page file is already handled everywhere
 * that matters: listReferencedPageIds() unions across all envelopes, so
 * neither copy can orphan the other's pages.
 *
 * Signer NAMES and EMAILS may be edited; signer IDS may not. Fields are
 * bound to signer ids, so allowing the roster to change would silently
 * orphan every field attached to a removed signer. Changing who is on
 * the envelope means building a new one.
 */
export async function POST(req, { params }) {
  const body = await req.json().catch(() => ({}));

  const source = getEnvelope(params.id);
  if (!source) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Any status may be copied, including a declined, voided or expired
  // one — those are precisely the cases where you most want to send it
  // again. Payment is per envelope, so the copy is a fresh $1.99.

  let signers = source.signers;
  if (Array.isArray(body.signers)) {
    const byId = new Map(body.signers.map((s) => [s?.id, s]));
    const unknown = body.signers.find((s) => !source.signers.some((o) => o.id === s?.id));
    if (unknown) {
      return NextResponse.json(
        { error: "signer ids must match the original envelope — to change who signs, create a new envelope" },
        { status: 400 }
      );
    }
    signers = source.signers.map((orig) => {
      const patch = byId.get(orig.id);
      if (!patch) return orig;
      return {
        ...orig,
        name: typeof patch.name === "string" && patch.name.trim() ? patch.name.trim().slice(0, 120) : orig.name,
        email: typeof patch.email === "string" ? patch.email.trim().slice(0, 200) : orig.email,
        isSelf: typeof patch.isSelf === "boolean" ? patch.isSelf : orig.isSelf,
      };
    });
  }

  const missing = signers.find((s) => !s.isSelf && !(s.email || "").includes("@"));
  if (missing) {
    return NextResponse.json(
      { error: `${missing.name || "A signer"} needs an email address before this can be sent.` },
      { status: 400 }
    );
  }

  // Fresh field ids and, critically, cleared values — a copy carries the
  // layout, never the previous signatures.
  const fields = source.fields.map((f) => ({
    id: randomUUID().slice(0, 8),
    pageId: f.pageId,
    signerId: f.signerId,
    kind: f.kind,
    x: f.x,
    y: f.y,
    value: null,
  }));

  // A copy gets its own expiry window counted from now, not the
  // original's, which has usually already passed.
  let expiresAt = null;
  const rawDays = body.expiresInDays === undefined ? DEFAULT_EXPIRY_DAYS : body.expiresInDays;
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

  const envelope = createEnvelope({
    id: randomUUID(),
    trackingId: randTrackingId(),
    senderName: source.senderName,
    senderEmail: source.senderEmail,
    documentName: source.documentName,
    pages: source.pages,
    signers,
    fields,
    price: calcPrice(),
    status: "pending_payment",
    signingMode: source.signingMode,
    expiresAt,
    creatorIp: clientIp(req),
    creatorUserAgent: clientUserAgent(req),
  });

  return NextResponse.json({ envelope, copiedFrom: source.trackingId });
}
