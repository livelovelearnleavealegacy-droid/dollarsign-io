import Link from "next/link";

// One header for every page, rendered from app/layout.js. Previously
// the landing page, the editor, the signing page and the status pages
// each drew their own — three different logos at three different sizes.
export default function SiteHeader() {
  return (
    <header style={{
      borderBottom: "1px solid var(--line)",
      background: "#fff",
      padding: "14px 20px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <Link href="/" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
        <img src="/wordmark.png" alt="DollarSign.io" style={{ height: 38, width: "auto", display: "block" }} />
      </Link>
    </header>
  );
}
