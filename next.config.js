/** @type {import('next').NextConfig} */
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
};

module.exports = nextConfig;
