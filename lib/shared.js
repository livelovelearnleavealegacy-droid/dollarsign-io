// Shared constants, pricing logic, and inline style tokens.
// Used by both the sender-side app (app/page.js) and the recipient
// signing page (app/sign/[envelopeId]/[signerId]) so the two stay
// visually and numerically consistent.

export const FLAT_PRICE = 1;      // one flat price per envelope, no tiers

/* Everything customer-facing renders from these two, never from a typed
   "$1.00" in prose. Changing the price above used to mean hunting the
   string through fourteen files — marketing copy, Terms, the FAQ, the
   comparison guides, structured data — and the arithmetic in the guides
   silently went wrong when one was missed.

   PRICE_LABEL is the precise form for pricing and legal text.
   PRICE_SHORT drops a trailing .00, because "$1" is the headline and
   "$1.00" is the invoice. At 1.99 both render "$1.99". */
export const PRICE_LABEL = `$${FLAT_PRICE.toFixed(2)}`;
export const PRICE_SHORT = `$${FLAT_PRICE}`;

export const MAX_SIGNERS = 10;    // hard cap — enforced client- and server-side
export const MAX_PAGES = 100;     // hard cap — enforced client- and server-side

export const SIGNER_COLORS = [
  "#102A43", "#2DD4BF", "#F4B942", "#7C5CBF", "#E0607E", "#3D8B70", "#B85C38",
];

/* ---------------- field kinds ----------------
   "signature" and "initials" both store { type: "image", data: <png> } —
   initials just render smaller. "checkbox" stores the STRING "checked"
   or "unchecked", never a boolean: completion is decided by every field
   having a truthy value, so an unchecked box stored as `false` would
   leave the envelope permanently unfinishable. A signer must tap it at
   least once either way, and "unchecked" is a real, recorded answer. */
export const FIELD_KINDS = ["signature", "initials", "date", "text", "checkbox"];

export const FIELD_LABELS = {
  signature: "Signature",
  initials: "Initials",
  date: "Date",
  text: "Text",
  checkbox: "Checkbox",
};

export const CHECKED = "checked";
export const UNCHECKED = "unchecked";

/* ---------------- signing order ----------------
   "parallel" is the default because it is what the app has always
   actually done: every signer was emailed at payment and the server
   never enforced an order, so signer 3 could always sign before signer
   1. "sequential" is the new, stricter mode — invites go out one at a
   time and the server refuses an out-of-turn signature. */
export const SIGNING_MODES = ["parallel", "sequential"];
export const DEFAULT_SIGNING_MODE = "parallel";

/* ---------------- expiry ----------------
   An envelope nobody finishes should not sit open forever: the sender
   never learns it is dead, and the signing links stay live indefinitely.
   Expiry is opt-out rather than opt-in — 0 means never. */
export const DEFAULT_EXPIRY_DAYS = 30;
export const MAX_EXPIRY_DAYS = 365;
export const EXPIRY_CHOICES = [7, 14, 30, 60, 90, 0];

// Days after sending on which an unsigned signer gets a nudge. Capped
// by REMINDER_MAX so a stalled envelope can't mail someone forever.
export const REMINDER_DAYS = [3, 7];
export const REMINDER_MAX = REMINDER_DAYS.length;

// A reminder is only sent inside a window that opens on its due day and
// closes REMINDER_WINDOW_DAYS later. Two reasons, one of them urgent:
// nobody wants a "still waiting!" nudge about something that went quiet
// three months ago, and without this the very first cron run would look
// at every envelope already past day 3 and mail all of them at once.
export const REMINDER_WINDOW_DAYS = 7;

// Flat pricing: every envelope costs the same, regardless of page or
// signer count, as long as both stay within MAX_PAGES / MAX_SIGNERS.
// Those limits are enforced separately — see the checks in page.js
// and the server-side validation in app/api/envelopes/route.js.
export function calcPrice() {
  return { total: FLAT_PRICE };
}

export function todayStr() {
  return new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function randTrackingId() {
  const chars = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let s = "ENV-";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/* ---------------- shared style tokens ---------------- */
export const primaryBtn = {
  background: "var(--accent)", color: "#fff", border: "none", borderRadius: 7,
  padding: "11px 18px", fontSize: 16, fontWeight: 600, cursor: "pointer",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};
export const iconBtn = { border: "none", background: "none", cursor: "pointer", padding: 4, lineHeight: 0, color: "#8A8F98" };
export const linkBtn = { border: "none", background: "none", cursor: "pointer", padding: 0, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 16, color: "#8A8F98", display: "flex", alignItems: "center" };
export const chipBtn = { border: "1px solid var(--line)", background: "#fff", borderRadius: 20, padding: "6px 12px", fontSize: 16, color: "#102A43", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 };
export const tabBtn = { border: "1px solid var(--line)", background: "#fff", borderRadius: 7, padding: "9px 14px", fontSize: 16, color: "#5B5F6B", cursor: "pointer" };
export const tabBtnActive = { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" };
export const inputStyle = { width: "100%", border: "1.5px solid var(--line)", borderRadius: 6, padding: "10px 12px", fontSize: 16, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#102A43" };
export const labelStyle = { fontSize: 16, color: "#8A8F98", fontFamily: "'Plus Jakarta Sans', sans-serif", marginBottom: 6, display: "block" };
export const ov = {
  backdrop: { position: "fixed", inset: 0, background: "rgba(16,42,67,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 },
  card: { background: "#fff", borderRadius: 12, padding: 22, width: "100%", maxWidth: 380, boxShadow: "0 20px 50px rgba(0,0,0,0.25)" },
  headRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 17, fontWeight: 600, margin: 0 },
};
