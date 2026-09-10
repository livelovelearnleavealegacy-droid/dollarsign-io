// Generates /robots.txt.
//
// The public pages are the whole of what should be indexed. Everything
// else is either somebody's private document or an API. Crawlers that
// honour robots.txt stay out; the X-Robots-Tag headers in
// next.config.js cover the ones that only read headers.
const BASE = process.env.APP_URL || "https://dollarsign.io";

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/e/", "/sign/", "/void/", "/checkout", "/admin", "/api/"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
