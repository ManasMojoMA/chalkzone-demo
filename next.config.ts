import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Ticket attachments upload through server actions (10MB cap per file
      // enforced in the action; headroom for form overhead)
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
