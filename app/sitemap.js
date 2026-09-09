// Generates /sitemap.xml.
//
// Only the five pages that are the same for everybody. Document pages
// are per-envelope and private, so they are deliberately absent — a
// sitemap is a public invitation to crawl, and nothing private should
// ever be listed in one.
const BASE = process.env.APP_URL || "https://dollarsign.io";

export default function sitemap() {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/find-my-document`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
