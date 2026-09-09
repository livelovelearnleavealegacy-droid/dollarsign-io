/** @type {import('next').NextConfig} */

// Anything under these prefixes is somebody's private document: the
// envelope status page, a signing link, a void link, and the checkout
// hand-off. None of it should ever appear in a search index. The links
// are unguessable, but "unguessable" stops being a defence the moment
// one is pasted into a public page a crawler can reach, so say it out
// loud in a header rather than relying on obscurity.
const PRIVATE_PREFIXES = ["/e/:path*", "/sign/:path*", "/void/:path*", "/checkout/:path*", "/checkout"];

const nextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.dollarsign.io" }],
        destination: "https://dollarsign.io/:path*",
        permanent: true,
      },
    ];
  },

  async headers() {
    return PRIVATE_PREFIXES.map((source) => ({
      source,
      headers: [
        { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        // A signing link in a Referer header would hand the next site
        // the ability to open somebody's document. Send no referrer
        // from these pages at all.
        { key: "Referrer-Policy", value: "no-referrer" },
      ],
    }));
  },
};

module.exports = nextConfig;
