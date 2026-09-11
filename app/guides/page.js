import LegalPage, { p, ul, li, link, callout } from "@/components/LegalPage";
import { GUIDES, guideUrl } from "@/lib/guides";

export const metadata = {
  title: "Guides — E-Signature Costs and the Law",
  description:
    "Plain answers on what e-signature actually costs, when you need an account, and what makes a signature legally binding. Current prices, cited and dated.",
  alternates: { canonical: "/guides" },
  openGraph: {
    title: "Guides — DollarSign.io",
    description: "What e-signature costs, when you need an account, and what makes a signature binding.",
    url: "/guides",
  },
};

// A hub exists so the guides are not orphans: it gives them one internal
// link source, one place in the footer, and a sensible crawl entry point.
const listLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "DollarSign.io guides",
  itemListElement: GUIDES.map((g, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: g.title,
    url: `https://dollarsign.io/guides/${g.slug}`,
  })),
};

export default function GuidesPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listLd) }} />
      <LegalPage
        title="Guides"
        intro="Straight answers to the questions people ask before they send something for signature. Where these quote a competitor's prices, the figures come from that company's own pricing page and carry the date they were read."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {GUIDES.map((g) => (
            <div key={g.slug} style={{ padding: "18px 0", borderBottom: "1px solid var(--line)" }}>
              
                href={guideUrl(g.slug)}
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: 18, lineHeight: 1.35, color: "var(--ink)", textDecoration: "none" }}
              >
                {g.title}
              </a>
              <p style={{ ...p, margin: "6px 0 0", color: "#5B5F6B" }}>{g.blurb}</p>
            </div>
          ))}
        </div>

        <div style={{ ...callout, marginTop: 32 }}>
          <strong>Still have a question?</strong> The <a href="/faq" style={link}>FAQ</a> covers delivery problems,
          refunds, retention and what happens when a signer never gets the email. If yours is not there, email{" "}
          <a href="mailto:support@dollarsign.io" style={link}>support@dollarsign.io</a> and a person will answer within
          two business days.
        </div>
      </LegalPage>
    </>
  );
}
