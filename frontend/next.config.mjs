import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
nextEnv.loadEnvConfig(projectRoot, process.env.NODE_ENV !== "production", console, true);
export default (phase) => ({
  distDir: phase === "phase-development-server" ? ".next-dev" : ".next",
  outputFileTracingIncludes: { "/api/og/**": ["./public/card-fonts/*.woff"] },
  outputFileTracingExcludes: { "/*": ["./.env*", "./.next-dev/**"] },
  poweredByHeader: false,
  devIndicators: false,
  outputFileTracingRoot: projectRoot,
  htmlLimitedBots:
    /bot|crawler|spider|whatsapp|facebookexternalhit|slack|discord|telegram|preview/i,
  experimental: { cpus: 2 },
  async headers() {
    return [
      {
        source: "/stats/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
});
