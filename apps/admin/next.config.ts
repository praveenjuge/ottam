import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  headers() {
    return Promise.resolve([
      {
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), microphone=()",
          },
        ],
        source: "/(.*)",
      },
    ]);
  },
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
