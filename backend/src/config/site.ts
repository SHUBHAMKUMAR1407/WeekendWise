export function siteUrl() {
  const deployment = process.env.VERCEL_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (process.env.NEXT_PUBLIC_SITE_URL || (deployment ? "https://" + deployment : "http://localhost:3000")).replace(/\/$/, "");
}
