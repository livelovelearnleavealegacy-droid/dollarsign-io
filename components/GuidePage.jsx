import LegalPage, { h2, h3, p, ul, li, link, callout } from "@/components/LegalPage";
import { GUIDES, guideUrl } from "@/lib/guides";
import { FLAT_PRICE, PRICE_LABEL, PRICE_SHORT, MAX_SIGNERS, MAX_PAGES } from "@/lib/shared";

// Guides reuse the policy pages' shell so the reading column, type scale
// and link styling can't drift. Everything here is the extra furniture a
// guide needs and a policy page doesn't: a price table, a source line, a
// closing call to action, and the cross-links that keep these pages from
// being orphans in the crawl.

export { h2, h3, p, ul, li, link, callout };

export { GUIDES, guideUrl } from "@/lib/guides";

// Guides quote the price constantly. Re-exported here so no guide ever
// types a dollar figure, and `money(n)` renders a row of the break-even
// tables from the live price rather than from arithmetic done by hand —
// which is exactly what went wrong the last time a number changed.
export { FLAT_PRICE, PRICE_LABEL, PRICE_SHORT, MAX_SIGNERS, MAX_PAGES } from "@/lib/shared";
export const money = (n) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const forN = (n) => money(n * FLAT_PRICE);

// Prices quoted on these pages are somebody else's and can change without
// notice. Every one carries the date it was read and a link to the page it
// came from, so a reader can check rather than trust.
export function Source({ children }) {
  return (
    <p style={{ fontSize: 14, lineHeight: 1.55, color: "#8A8F98", margin: "0 0 14px" }}>
      {children}
    </p>
  );
}

const cell = { padding: "9px 12px", borderBottom: "1px solid var(--line)", fontSize: 15, lineHeight: 1.45, textAlign: "left", verticalAlign: "top" };
const headCell = { ...cell, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, color: "var(--ink)", borderBottom: "2px solid var(--line)" };

// Tables are the one thing that genuinely needs to scroll sideways on a
// phone rather than wrap into nonsense.
export function Table({ head, rows, note }) {
  return (
    <div style={{ overflowX: "auto", margin: "0 0 16px" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 460 }}>
        <thead>
          <tr>{head.map((h, i) => <th key={i} style={headCell}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} style={{ ...cell, color: j === 0 ? "var(--ink)" : "#3C4655" }}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {note && <p style={{ fontSize: 14, color: "#8A8F98", margin: "8px 0 0", lineHeight: 1.5 }}>{note}</p>}
    </div>
  );
}

export function Cta({ children }) {
  return (
    <div style={{ ...callout, background: "#F3F8F4", borderColor: "#CFE3D4", marginTop: 32 }}>
      {children}
    </div>
  );
}

export function Related({ exclude = [] }) {
  const others = GUIDES.filter((g) => !exclude.includes(g.slug)).slice(0, 4);
  return (
    <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, letterSpacing: 1.2, color: "#8A8F98", marginBottom: 12 }}>
        RELATED
      </div>
      <ul style={{ ...ul, paddingLeft: 20, margin: 0 }}>
        {others.map((g) => (
          <li key={g.slug} style={li}>
            <a href={guideUrl(g.slug)} style={link}>{g.title}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Article structured data for every guide, generated from the same
// title/description the <head> already carries so the two can't disagree.
export function GuideLd({ slug, title, description, published, modified }) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://dollarsign.io/guides/${slug}` },
    datePublished: published,
    dateModified: modified || published,
    author: { "@type": "Organization", name: "DollarSign.io", url: "https://dollarsign.io" },
    publisher: { "@id": "https://dollarsign.io/#organization" },
    isAccessibleForFree: true,
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />;
}

export default function GuidePage({ slug, title, description, updated, intro, published, children }) {
  return (
    <>
      <GuideLd slug={slug} title={title} description={description} published={published} modified={updated} />
      <LegalPage title={title} updated={updated} intro={intro}>
        {children}
      </LegalPage>
    </>
  );
}
