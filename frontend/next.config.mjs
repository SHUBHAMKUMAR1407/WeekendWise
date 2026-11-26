import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { parsedEnv } = nextEnv.loadEnvConfig(path.join(projectRoot, "backend"), process.env.NODE_ENV !== "production", console, true);
// Next reloads the frontend environment in its workers and dev watcher. Keep
// backend settings in that reload baseline so server credentials survive it.
nextEnv.updateInitialEnv(parsedEnv || {});
export default (phase) => ({
  distDir: phase === "phase-development-server" ? ".next-dev" : ".next",
  outputFileTracingIncludes: { "/api/og/**": ["./public/card-fonts/*.woff"] },
  outputFileTracingExcludes: { "/*": ["./.env*", "../backend/.env*", "./.next-dev/**"] },
  poweredByHeader: false,
  devIndicators: false,
  outputFileTracingRoot: projectRoot,
  htmlLimitedBots:
    /bot|crawler|spider|whatsapp|facebookexternalhit|slack|discord|telegram|preview/i,
  experimental: { cpus: 2 },
  async headers() {
    return [
      ...["/admin/:path*", "/api/admin/:path*"].map((source) => ({
        source,
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      })),
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
