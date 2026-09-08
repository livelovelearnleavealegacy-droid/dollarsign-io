import "./globals.css";

export const metadata = {
  title: "DollarSign.io — Pay as you go. Sign with confidence.",
  description: "Upload a document, add signers, sign it. Pay per envelope, no subscription.",
};

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
        {children}
        <footer style={{ textAlign: "center", padding: "24px 16px", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, color: "#9AA0AA" }}>
          <a href="/find-my-document" style={{ color: "#9AA0AA", textDecoration: "underline" }}>Lost your document link?</a>
          <br />
          DollarSign.io © Live, Love, Learn, Leave a Legacy LLC
        </footer>
      </body>
    </html>
  );
}
