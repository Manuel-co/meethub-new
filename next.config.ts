import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Short meeting links: /abc-def-ghi shows the meeting page (/meet/abc-def-ghi)
  // while the address bar keeps the short form. Only exact codes match, so
  // /dashboard, /login, etc. are unaffected.
  async rewrites() {
    return [
      {
        source: "/:code([a-z]{3}\\-[a-z]{3}\\-[a-z]{3})",
        destination: "/meet/:code",
      },
    ];
  },
};

export default nextConfig;
