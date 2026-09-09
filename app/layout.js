import "./globals.css";
import SiteHeader from "@/components/SiteHeader";

export const metadata = {
  // Without metadataBase, Next resolves the Open Graph image against
  // http://localhost:3000 and every shared link previews with a broken
  // image. APP_URL is the same value Railway uses for signing links.
  metadataBase: new URL(process.env.APP_URL || "https://dollarsign.io"),
  title: "DollarSign.io — Pay as you go. Sign with confidence.",
  description: "Upload a document, add signers, sign it. Pay per envelope, no subscription.",
  openGraph: {
    siteName: "DollarSign.io",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

// Every footer link is black, bold, and underlined so it reads as a
// deliberate offer of help rather than boilerplate. These are the
// self-service exits — the more people take them, the less support mail
// there is to answer.
const footerLink = { color: "#000000", fontWeight: 700, textDecoration: "underline" };
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
        <SiteHeader />
        {children}
        <footer style={{ textAlign: "center", padding: "24px 16px", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, lineHeight: 1.9, color: "#9AA0AA" }}>
          <div>
            <a href="/find-my-document" style={footerLink}>Lost your document link?</a>
          </div>
          <div>
            <a href="/faq" style={footerLink}>FAQ &amp; support</a>
            <span style={dot}>·</span>
            <a href="/terms" style={footerLink}>Terms</a>
            <span style={dot}>·</span>
            <a href="/privacy" style={footerLink}>Privacy</a>
          </div>
          <div>
            <a href="mailto:support@dollarsign.io" style={footerLink}>support@dollarsign.io</a>
          </div>
          <div style={{ marginTop: 4 }}>
            DollarSign.io © Live, Love, Learn, Leave a Legacy LLC
          </div>
        </footer>
      </body>
    </html>
  );
}
