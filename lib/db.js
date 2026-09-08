// Storage layer. Backed by SQLite (a single file on disk) so there's
// zero external service to set up while you're building.
//
// IMPORTANT: serverless hosts (Vercel, etc.) wipe the local filesystem
// between deploys/cold starts, so this is fine for local dev and single-
// server hosting (Railway, Render, a VPS, fly.io) but NOT durable on
// Vercel's default runtime. When you're ready for that, swap this file
// for Postgres (Vercel Postgres, Supabase, Neon all work) — every
// function below (createEnvelope / getEnvelope / updateEnvelopeFields)
// is the entire integration surface the rest of the app talks to.
//
// In production on Railway/Render/Fly, DB_PATH should point at a
// mounted persistent volume (e.g. /data/dollarsign.db) — otherwise the
// database lives inside the container's own filesystem and gets wiped
// on every redeploy. Locally, it just defaults to the project folder.

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "dollarsign.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);

// Page images live beside the database on the same persistent volume.
// Kept in sync with app/api/pages/route.js, which writes them.
const PAGES_DIR = path.join(path.dirname(DB_PATH), "pages");

db.exec(`
  CREATE TABLE IF NOT EXISTS envelopes (
    id TEXT PRIMARY KEY,
    tracking_id TEXT NOT NULL,
    sender_name TEXT,
    sender_email TEXT,
    status TEXT NOT NULL DEFAULT 'sent',
    data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS page_files (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    mime TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

/* ------------------------------------------------------------------
   Raw access.

   Everything except the four promoted columns lives in the data blob.
   Writes merge a patch into the RAW stored blob rather than
   re-serialising the sanitised envelope object, because the sanitised
   object deliberately omits secrets (the void token). Re-serialising
   from it would silently drop them on the next unrelated write.
   ------------------------------------------------------------------ */

function rawData(id) {
  const row = db.prepare(`SELECT data FROM envelopes WHERE id = ?`).get(id);
  return row ? JSON.parse(row.data) : null;
}

function writeData(id, patch, status) {
  const current = rawData(id);
  if (!current) return null;
  const merged = { ...current, ...patch };
  if (status) {
    db.prepare(`UPDATE envelopes SET data = @data, status = @status, updated_at = datetime('now') WHERE id = @id`)
      .run({ id, status, data: JSON.stringify(merged) });
  } else {
    db.prepare(`UPDATE envelopes SET data = @data, updated_at = datetime('now') WHERE id = @id`)
      .run({ id, data: JSON.stringify(merged) });
  }
  return getEnvelope(id);
}

export function createEnvelope(envelope) {
  const auditLog = [{
    type: "created",
    at: new Date().toISOString(),
    ip: envelope.creatorIp || null,
    userAgent: envelope.creatorUserAgent || null,
    senderName: envelope.senderName || null,
    senderEmail: envelope.senderEmail || null,
  }];
  db.prepare(`
    INSERT INTO envelopes (id, tracking_id, sender_name, sender_email, status, data)
    VALUES (@id, @trackingId, @senderName, @senderEmail, @status, @data)
  `).run({
    id: envelope.id,
    trackingId: envelope.trackingId,
    senderName: envelope.senderName || null,
    senderEmail: envelope.senderEmail || null,
    status: envelope.status || "sent",
    data: JSON.stringify({
      documentName: envelope.documentName || null,
      documentHash: null,
      pages: envelope.pages,
      signers: envelope.signers,
      fields: envelope.fields,
      price: envelope.price,
      auditLog,
    }),
  });
  return getEnvelope(envelope.id);
}

export function getEnvelope(id) {
  const row = db.prepare(`SELECT * FROM envelopes WHERE id = ?`).get(id);
  if (!row) return null;
  return rowToEnvelope(row);
}

// Finds every non-draft envelope where the given email is either the
// sender or one of the signers. Used by the "find my document" recovery
// flow. The LIKE clause is a fast coarse pre-filter over the raw JSON
// blob; the precise match happens afterward in JS so a partial/
// substring coincidence can't produce a false positive.
export function findEnvelopesByEmail(email) {
  const target = String(email || "").trim().toLowerCase();
  if (!target) return [];
  const rows = db.prepare(`
    SELECT * FROM envelopes
    WHERE status != 'pending_payment'
      AND (LOWER(sender_email) = ? OR LOWER(data) LIKE ?)
  `).all(target, `%${target}%`);
  return rows
    .map(rowToEnvelope)
    .filter((env) =>
      (env.senderEmail || "").toLowerCase() === target ||
      env.signers.some((s) => (s.email || "").toLowerCase() === target)
    );
}

export function insertPageFile({ id, filename, mime, width, height }) {
  db.prepare(`
    INSERT INTO page_files (id, filename, mime, width, height)
    VALUES (@id, @filename, @mime, @width, @height)
  `).run({ id, filename, mime, width, height });
}

export function getPageFile(id) {
  return db.prepare(`SELECT * FROM page_files WHERE id = ?`).get(id);
}

/**
 * Deterministic SHA-256 fingerprint of a completed envelope, computed
 * server-side from the bytes actually stored on disk.
 *
 * This replaces an earlier client-side hash taken over canvas-rendered
 * data URLs, which was not reproducible: canvas output varies by
 * browser, OS and fonts, so two parties viewing the same document could
 * legitimately compute two different values, and nothing was ever
 * stored to compare against. Hashing the stored page files plus the
 * canonical field data gives one value, fixed at completion, that
 * anybody can recompute from the same inputs.
 */
export function computeDocumentHash(envelope) {
  const h = crypto.createHash("sha256");
  h.update(`dollarsign.io/v1\n${envelope.trackingId}\n`);

  for (const page of envelope.pages) {
    const row = getPageFile(page.id);
    if (!row) throw new Error(`page file missing for ${page.id}`);
    h.update(fs.readFileSync(path.join(PAGES_DIR, row.filename)));
  }

  const canonicalFields = envelope.fields.map((f) => ({
    id: f.id, pageId: f.pageId, signerId: f.signerId,
    kind: f.kind, x: f.x, y: f.y, value: f.value ?? null,
  }));
  h.update(JSON.stringify(canonicalFields));

  return h.digest("hex");
}

// Stores the fingerprint on the envelope. Called once, at completion.
export function setDocumentHash(id, documentHash) {
  return writeData(id, { documentHash });
}

// Records a standalone audit event (consent, disclosure viewed, etc.)
// without modifying fields or status.
export function appendAuditEvent(id, event) {
  const current = rawData(id);
  if (!current) return null;
  return writeData(id, { auditLog: [...(current.auditLog || []), event] });
}

/* ------------------------------------------------------------------
   Void: the sender recalling an envelope they shouldn't have sent.

   There are no accounts, so the only thing that identifies the sender
   is control of senderEmail. A void therefore takes two steps: anyone
   holding the envelope link may REQUEST one, but the token that
   authorises it is emailed to senderEmail and nowhere else.

   The token is stored in the data blob and deliberately NOT returned by
   rowToEnvelope — GET /api/envelopes/[id] is readable by every signer,
   so exposing it there would hand the authority to exactly the people
   the two-step flow exists to exclude.
   ------------------------------------------------------------------ */

export const VOID_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export function setVoidToken(id, token) {
  return writeData(id, { voidToken: token, voidTokenAt: new Date().toISOString() });
}

// Internal-only reader. Never surfaced through the envelope API shape.
export function getVoidToken(id) {
  const d = rawData(id);
  if (!d?.voidToken) return null;
  return { token: d.voidToken, at: d.voidTokenAt || null };
}

// Constant-time comparison so a token can't be recovered by timing how
// long a wrong guess takes to be rejected.
export function voidTokenMatches(id, candidate) {
  const stored = getVoidToken(id);
  if (!stored || typeof candidate !== "string") return false;
  const a = Buffer.from(stored.token);
  const b = Buffer.from(candidate);
  if (a.length !== b.length) return false;
  if (!crypto.timingSafeEqual(a, b)) return false;
  if (!stored.at) return false;
  return Date.now() - new Date(stored.at).getTime() < VOID_TOKEN_TTL_MS;
}

// Terminal. Burns the token on the way out so the emailed link is
// single-use even if the message is forwarded or sits in an archive.
export function voidEnvelope(id, event) {
  const current = rawData(id);
  if (!current) return null;
  const existing = getEnvelope(id);
  if (["completed", "declined", "voided"].includes(existing.status)) return existing;

  return writeData(id, {
    auditLog: [...(current.auditLog || []), { type: "voided", ...event }],
    voidToken: null,
    voidTokenAt: null,
  }, "voided");
}

// A signer refusing to sign. Terminal, like completion: the envelope
// stops accepting signatures and every remaining signing link goes
// inert, because the agreement the other parties were signing no longer
// has all its parties.
export function declineEnvelope(id, event) {
  const current = rawData(id);
  if (!current) return null;
  const existing = getEnvelope(id);
  if (["completed", "declined", "voided"].includes(existing.status)) return existing;

  return writeData(id, {
    auditLog: [...(current.auditLog || []), { type: "declined", ...event }],
    voidToken: null,
    voidTokenAt: null,
  }, "declined");
}

// Called once by the Stripe webhook after a successful payment. Records
// the payment and every email-send attempt in a single write, so a
// client polling for status never sees a half-updated envelope (status
// flipped to "sent" but email results not recorded yet).
export function finalizeEnvelopePayment(id, paymentMeta, emailEvents) {
  const current = rawData(id);
  if (!current) return null;
  const existing = getEnvelope(id);
  if (existing.status !== "pending_payment") return existing; // idempotent — Stripe may retry webhooks

  return writeData(id, {
    auditLog: [
      ...(current.auditLog || []),
      { type: "paid", at: new Date().toISOString(), ...paymentMeta },
      ...(emailEvents || []),
    ],
  }, "sent");
}

// event: { signerId, signerName, signerEmail, ip, userAgent, at, fieldIds }
export function updateEnvelopeFields(id, fields, event) {
  const current = rawData(id);
  if (!current) return null;
  const existing = getEnvelope(id);

  // Terminal states never reopen. The route rejects these before we get
  // here; this is the backstop so a future caller can't reopen a
  // finished envelope and append to a settled audit trail.
  if (["completed", "declined", "voided"].includes(existing.status)) return existing;

  const merged = existing.fields.map((f) => {
    const incoming = fields.find((x) => x.id === f.id);
    return incoming ? { ...f, value: incoming.value } : f;
  });
  const allSigned = merged.every((f) => f.value);
  const status = allSigned ? "completed" : "sent";

  const auditLog = [...(current.auditLog || [])];
  if (event) auditLog.push({ type: "signed", ...event });
  if (status === "completed") auditLog.push({ type: "completed", at: new Date().toISOString() });

  const patch = { fields: merged, auditLog };
  // A completed envelope can't be voided, so any outstanding void token
  // is dead weight — clear it rather than leave a live secret behind.
  if (status === "completed") { patch.voidToken = null; patch.voidTokenAt = null; }

  return writeData(id, patch, status);
}

function rowToEnvelope(row) {
  const data = JSON.parse(row.data);
  // NOTE: voidToken / voidTokenAt are deliberately excluded. This shape
  // is what GET /api/envelopes/[id] returns, and every signer can read
  // that endpoint.
  return {
    id: row.id,
    trackingId: row.tracking_id,
    documentName: data.documentName || null,
    documentHash: data.documentHash || null,
    senderName: row.sender_name,
    senderEmail: row.sender_email,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pages: data.pages,
    signers: data.signers,
    fields: data.fields,
    price: data.price,
    auditLog: data.auditLog || [],
  };
}
