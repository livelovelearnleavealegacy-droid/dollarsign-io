import Logo from "@/components/Logo";

// Shared shell for the plain-text policy pages (terms, privacy, FAQ).
// Keeps one copy of the reading-column width and typographic scale so
// the three pages can't drift apart visually.
export default function LegalPage({ title, updated, intro, children }) {
  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "48px 20px 24px" }}>
      <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", marginBottom: 28 }}>
        <Logo size={30} />
        <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 17, color: "var(--ink)" }}>
          DollarSign<span style={{ color: "var(--teal)" }}>.io</span>
        </span>
      </a>

      <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 30, lineHeight: 1.2, margin: "0 0 8px", color: "var(--ink)" }}>
        {title}
      </h1>
      {updated && (
        <p style={{ fontSize: 16, color: "#9AA0AA", margin: "0 0 24px" }}>Last updated {updated}</p>
      )}
      {intro && (
        <p style={{ fontSize: 17, lineHeight: 1.6, color: "#5B5F6B", margin: "0 0 32px" }}>{intro}</p>
      )}

      {children}
    </div>
  );
}

export const h2 = {
  fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 20,
  lineHeight: 1.3, color: "var(--ink)", margin: "36px 0 10px",
};

export const h3 = {
  fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: 17,
  lineHeight: 1.35, color: "var(--ink)", margin: "26px 0 8px",
};

export const p = {
  fontSize: 16, lineHeight: 1.65, color: "#3C4655", margin: "0 0 14px",
};

export const ul = {
  fontSize: 16, lineHeight: 1.65, color: "#3C4655",
  margin: "0 0 14px", paddingLeft: 22,
};

export const li = { marginBottom: 7 };

export const link = { color: "var(--ink)", textDecoration: "underline" };

export const callout = {
  background: "#F7FAFC", border: "1px solid var(--line)", borderRadius: 10,
  padding: "16px 18px", margin: "0 0 28px",
  fontSize: 16, lineHeight: 1.6, color: "#3C4655",
};
