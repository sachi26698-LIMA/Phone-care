import type { NextConfig } from "next";

// Development previews are served from a sandboxed host and embedded in an iframe,
// so the two frame-blocking headers must not apply there. Production keeps them.
const isDev = process.env.NODE_ENV !== "production";

function contentSecurityPolicy(dev: boolean): string {
  return [
    "default-src 'self'",
    // Next.js ships an inline bootstrap script; a nonce pipeline would require middleware.
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    dev ? "frame-ancestors *" : "frame-ancestors 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

function securityHeaders(dev: boolean) {
  const headers = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(dev) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
  ];
  if (!dev) {
    headers.push({ key: "X-Frame-Options", value: "SAMEORIGIN" });
  }
  return headers;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The dev server is proxied through a sandbox host; without this Next blocks
  // cross-origin dev requests. Has no effect on production behaviour.
  allowedDevOrigins: ["*.e2b.app", "*.arena.ai"],
  poweredByHeader: false,
  typedRoutes: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders(isDev),
      },
    ];
  },
};

export default nextConfig;
