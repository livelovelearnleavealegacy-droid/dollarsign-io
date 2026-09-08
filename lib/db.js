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

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "dollarsign.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);

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
    data: JSON.stringify({ pages: envelope.pages, signers: envelope.signers, fields: envelope.fields, price: envelope.price, auditLog }),
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

// Records a standalone audit event (consent, disclosure viewed, etc.)
// without modifying fields or status.
export function appendAuditEvent(id, event) {
  const existing = getEnvelope(id);
  if (!existing) return null;
  const auditLog = [...(existing.auditLog || []), event];
  db.prepare(`UPDATE envelopes SET data = @data, updated_at = datetime('now') WHERE id = @id`).run({
    id,
    data: JSON.stringify({ pages: existing.pages, signers: existing.signers, fields: existing.fields, price: existing.price, auditLog }),
  });
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
  `).run({
    id,
    data: JSON.stringify({ pages: existing.pages, signers: existing.signers, fields: existing.fields, price: existing.price, auditLog }),
  });

  return getEnvelope(id);
}

// event: { signerId, signerName, signerEmail, ip, userAgent, at, fieldIds }
export function updateEnvelopeFields(id, fields, event) {
  const existing = getEnvelope(id);
  if (!existing) return null;
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
  `).run({
    id,
    status,
    data: JSON.stringify({ pages: existing.pages, signers: existing.signers, fields: merged, price: existing.price, auditLog }),
  });

  return getEnvelope(id);
}

function rowToEnvelope(row) {
  const data = JSON.parse(row.data);
  return {
    id: row.id,
    trackingId: row.tracking_id,
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
