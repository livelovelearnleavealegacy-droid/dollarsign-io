// Shared constants, pricing logic, and inline style tokens.
// Used by both the sender-side app (app/page.js) and the recipient
// signing page (app/sign/[envelopeId]/[signerId]) so the two stay
// visually and numerically consistent.

export const FLAT_PRICE = 1.99;   // one flat price per envelope, no tiers
export const MAX_SIGNERS = 10;    // hard cap — enforced client- and server-side
export const MAX_PAGES = 100;     // hard cap — enforced client- and server-side

export const SIGNER_COLORS = [
  "#102A43", "#2DD4BF", "#F4B942", "#7C5CBF", "#E0607E", "#3D8B70", "#B85C38",
];

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
