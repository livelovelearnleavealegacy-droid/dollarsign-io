import "./globals.css";
import SiteHeader from "@/components/SiteHeader";

const BASE = process.env.APP_URL || "https://dollarsign.io";

export const metadata = {
  // Without metadataBase, Next resolves the Open Graph image against
  // http://localhost:3000 and every shared link previews with a broken
  // image. APP_URL is the same value Railway uses for signing links.
  metadataBase: new URL(BASE),

  // `default` is what the homepage and any page without its own title
  // uses; `template` wraps every page that sets one, so each title is
  // unique and still carries the brand. The words that matter for
  // search go first — "DollarSign.io" means nothing to someone who has
  // never heard of it, but "electronic signature" is what they type.
  title: {
    default: "Electronic Signatures for $1.99 — No Account, No Subscription",
    template: "%s | DollarSign.io",
  },
  description:
    "Sign documents online for a flat $1.99 per envelope. No subscription, no account. Up to 10 signers and 100 pages, ESIGN compliant, certificate included.",

  // Only meaningful because every public page overrides it with its
  // own. The private pages inherit it, which is harmless: they are
  // noindex, so nothing consults their canonical.
  alternates: { canonical: "/" },

  openGraph: {
    siteName: "DollarSign.io",
    type: "website",
    locale: "en_US",
    url: "/",
    title: "Sign documents online for $1.99 an envelope",
    description:
      "No subscription. No account. Up to 10 signers and 100 pages, with a signed PDF and certificate of completion.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "DollarSign.io — sign documents online for $1.99 an envelope" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sign documents online for $1.99 an envelope",
    description: "No subscription. No account. Pay per document.",
    images: ["/og.png"],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

// Site-wide structured data. Organization tells search engines who is
// behind the domain; WebSite ties the name to it. The product/offer
// markup is on the homepage itself, where the price is actually shown.
const orgLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${BASE}/#organization`,
      name: "DollarSign.io",
      legalName: "Live, Love, Learn, Leave a Legacy LLC",
      url: BASE,
      logo: `${BASE}/wordmark.png`,
      email: "support@dollarsign.io",
      contactPoint: [{
        "@type": "ContactPoint",
        email: "support@dollarsign.io",
        contactType: "customer support",
        availableLanguage: ["English"],
      }],
    },
    {
      "@type": "WebSite",
      "@id": `${BASE}/#website`,
      url: BASE,
      name: "DollarSign.io",
      description: "Pay-per-envelope electronic signatures with no subscription and no account.",
      publisher: { "@id": `${BASE}/#organization` },
      inLanguage: "en-US",
    },
  ],
};

// The self-service exits — the more people take them, the less support
// mail there is to answer. Underlined so they still read as links, but
// at the footer's own size and weight: they should be findable when
// somebody is looking for help, not shouting at everyone who isn't.
const footerLink = { color: "#000000", fontWeight: 400, fontSize: 13, textDecoration: "underline" };
const dot = { color: "#8A8F98", margin: "0 8px" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Caveat:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon-light.png" media="(prefers-color-scheme: light)" />
        <link rel="icon" href="/favicon-dark.png" media="(prefers-color-scheme: dark)" />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }}
        />
        <SiteHeader />
        {children}
        <footer style={{ textAlign: "center", padding: "24px 16px", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, lineHeight: 1.9, color: "#9AA0AA" }}>
          <div>
            <a href="/find-my-document" style={footerLink}>Lost your document link?</a>
          </div>
          <div>
            <a href="/check" style={footerLink}>Something go wrong?</a>
            <span style={dot}>·</span>
            <a href="/faq" style={footerLink}>FAQ &amp; support</a>
            <span style={dot}>·</span>
            <a href="/terms" style={footerLink}>Terms</a>
            <span style={dot}>·</span>
            <a href="/privacy" style={footerLink}>Privacy</a>
          </div>
          <div>
            <a href="mailto:support@dollarsign.io" style={footerLink}>support@dollarsign.io</a>
          </div>
          {/* Moved out of the editor and into the footer so it sits on
              every page rather than only the one where a document is
              being set up — same size and weight as the links above. */}
          <div style={{ maxWidth: 620, margin: "10px auto 0", lineHeight: 1.5, color: "#9AA0AA" }}>
            The U.S. ESIGN Act doesn&apos;t cover every document type — don&apos;t use this for wills or
            testamentary trusts, family law matters (divorce, adoption), court orders,
            eviction/foreclosure/repossession notices, utility cancellation notices, health or life
            insurance cancellations, product recalls, or hazardous materials transport documents. Use
            paper for those.
          </div>
          <div style={{ marginTop: 10 }}>
            DollarSign.io © Live, Love, Learn, Leave a Legacy LLC
          </div>
        </footer>
      </body>
    </html>
  );
}
