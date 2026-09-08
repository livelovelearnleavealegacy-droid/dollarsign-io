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

// Everything except the four promoted columns lives in the data blob.
// Centralised here so a new field can't be dropped by one write path
// and kept by another — every UPDATE below serialises through this.
function serialize(env, overrides = {}) {
  return JSON.stringify({
    documentName: env.documentName || null,
    documentHash: env.documentHash || null,
    pages: env.pages,
    signers: env.signers,
    fields: env.fields,
    price: env.price,
    auditLog: env.auditLog || [],
    ...overrides,
  });
}

export function createEnvelope(envelope) {
  const stmt = db.prepare(`
    INSERT INTO envelopes (id, tracking_id, sender_name, sender_email, status, data)
    VALUES (@id, @trackingId, @senderName, @senderEmail, @status, @data)
  `);
  const auditLog = [{
    type: "created",
    at: new Date().toISOString(),
    ip: envelope.creatorIp || null,
    userAgent: envelope.creatorUserAgent || null,
    senderName: envelope.senderName || null,
    senderEmail: envelope.senderEmail || null,
  }];
  stmt.run({
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
 *
 * Inputs, in order: tracking id, then every page file's raw bytes in
 * page order, then the field set (id, page, signer, kind, position and
 * value) as canonical JSON.
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
  const existing = getEnvelope(id);
  if (!existing) return null;
  db.prepare(`UPDATE envelopes SET data = @data, updated_at = datetime('now') WHERE id = @id`)
    .run({ id, data: serialize(existing, { documentHash }) });
  return getEnvelope(id);
}

// Records a standalone audit event (consent, disclosure viewed, etc.)
// without modifying fields or status.
export function appendAuditEvent(id, event) {
  const existing = getEnvelope(id);
  if (!existing) return null;
  const auditLog = [...(existing.auditLog || []), event];
  db.prepare(`UPDATE envelopes SET data = @data, updated_at = datetime('now') WHERE id = @id`)
    .run({ id, data: serialize(existing, { auditLog }) });
  return getEnvelope(id);
}

// A signer refusing to sign. Terminal, like completion: the envelope
// stops accepting signatures and every remaining signing link goes
// inert, because the agreement the other parties were signing no longer
// has all its parties.
export function declineEnvelope(id, event) {
  const existing = getEnvelope(id);
  if (!existing) return null;
  if (existing.status === "completed" || existing.status === "declined") return existing;

  const auditLog = [...(existing.auditLog || []), { type: "declined", ...event }];
  db.prepare(`
    UPDATE envelopes SET status = 'declined', data = @data, updated_at = datetime('now') WHERE id = @id
  `).run({ id, data: serialize(existing, { auditLog }) });

  return getEnvelope(id);
}

// Called once by the Stripe webhook after a successful payment. Records
// the payment and every email-send attempt in a single write, so a
// client polling for status never sees a half-updated envelope (status
// flipped to "sent" but email results not recorded yet).
export function finalizeEnvelopePayment(id, paymentMeta, emailEvents) {
  const existing = getEnvelope(id);
  if (!existing) return null;
  if (existing.status !== "pending_payment") return existing; // idempotent — Stripe may retry webhooks

  const auditLog = [
    ...(existing.auditLog || []),
    { type: "paid", at: new Date().toISOString(), ...paymentMeta },
    ...(emailEvents || []),
  ];

  db.prepare(`
    UPDATE envelopes SET status = 'sent', data = @data, updated_at = datetime('now') WHERE id = @id
  `).run({ id, data: serialize(existing, { auditLog }) });

  return getEnvelope(id);
}

// event: { signerId, signerName, signerEmail, ip, userAgent, at, fieldIds }
export function updateEnvelopeFields(id, fields, event) {
  const existing = getEnvelope(id);
  if (!existing) return null;

  // Terminal states never reopen. The route rejects these before we get
  // here; this is the backstop so a future caller can't reopen a
  // finished envelope and append to a settled audit trail.
  if (existing.status === "completed" || existing.status === "declined") return existing;

  const merged = existing.fields.map((f) => {
    const incoming = fields.find((x) => x.id === f.id);
    return incoming ? { ...f, value: incoming.value } : f;
  });
  const allSigned = merged.every((f) => f.value);
  const status = allSigned ? "completed" : "sent";

  const auditLog = [...(existing.auditLog || [])];
  if (event) auditLog.push({ type: "signed", ...event });
  if (status === "completed") auditLog.push({ type: "completed", at: new Date().toISOString() });

  db.prepare(`
    UPDATE envelopes SET data = @data, status = @status, updated_at = datetime('now') WHERE id = @id
  `).run({ id, status, data: serialize(existing, { fields: merged, auditLog }) });

  return getEnvelope(id);
}

function rowToEnvelope(row) {
  const data = JSON.parse(row.data);
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
