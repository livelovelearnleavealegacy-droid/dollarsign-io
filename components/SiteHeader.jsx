import Link from "next/link";

// One header for every page, rendered from app/layout.js. Previously
// the landing page, the editor, the signing page and the status pages
// each drew their own — three different logos at three different sizes.
//
// The width and height attributes matter: without them the browser
// doesn't know how much room to reserve, so everything below jumps
// down when the logo arrives. That jump is Cumulative Layout Shift,
// which Google measures directly as a ranking input. 112x38 is the
// file's own aspect ratio, so nothing is distorted.
//
// Deliberately not next/image — in Next 14 that requires `sharp` in
// production, and the file is 12KB already. The dependency would buy
// nothing and could break the build.
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
        <img
          src="/wordmark.png"
          alt="DollarSign.io — pay-as-you-go electronic signatures"
          width={112}
          height={38}
          fetchPriority="high"
          style={{ height: 38, width: "auto", display: "block" }}
        />
      </Link>
    </header>
  );
}
