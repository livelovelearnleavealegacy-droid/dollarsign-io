// Extracts the client's IP address from standard proxy headers.
// This runs server-side in an API route, reading headers the platform
// sets (Vercel, most reverse proxies) — never trust an IP the client
// reports about itself in the request body.
export function clientIp(req) {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export function clientUserAgent(req) {
  return req.headers.get("user-agent") || "unknown";
}
