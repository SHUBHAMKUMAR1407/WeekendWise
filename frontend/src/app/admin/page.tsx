import AdminPanel from "@frontend/components/admin/AdminPanel";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin · Traveller search",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default function Admin() {
  return <main className="wrap inner stack admin-page"><AdminPanel /></main>;
}
