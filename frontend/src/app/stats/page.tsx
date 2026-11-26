import { notFound } from "next/navigation";
import { statsAccess } from "@backend/auth/stats";
import { todayIST } from "@backend/utils/dates";
import { metrics, STAGES } from "@backend/analytics/analytics";
import { requireStore } from "@backend/db/redis";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Funnel dashboard",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default async function Stats({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  if (!statsAccess(key)) notFound();
  requireStore();
  const date = todayIST();
  const stats = await Promise.all([metrics(date), metrics("all")]);
  return (
    <main className="wrap inner stack">
      <div className="row">
        <h1>Funnel dashboard.</h1>
        <a
          className="linkbtn"
          href={"/stats/export?key=" + encodeURIComponent(key!)}
        >
          Export CSV
        </a>
      </div>
      {stats.map((m, i) => (
        <section className="panel stack" key={i}>
          <h2>{i ? "All time" : "Today · " + date + " IST"}</h2>
          <div className="stat-grid">
            {[
              ["Unique visitors", m.visitors],
              ["Rooms created", m.counts.room_created],
              ["Avg voters / group room", m.avgVoters.toFixed(1)],
              ["Parent packs", m.counts.parent_pack_generated],
              ["Cards shared", m.counts.card_shared],
              ["goSTOPS clicks", m.counts.gostops_clicked],
            ].map(([label, v]) => (
              <div className="subpanel" key={label}>
                <small>{label}</small>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
          <h3>Visitor funnel</h3>
          <table>
            <thead>
              <tr>
                <th>Step</th>
                <th>People</th>
                <th>From prior step</th>
              </tr>
            </thead>
            <tbody>
              {STAGES.map((s, n) => (
                <tr key={s}>
                  <td>{s}</td>
                  <td>{m.funnel[n]}</td>
                  <td>
                    {n && m.funnel[n - 1]
                      ? Math.round((100 * m.funnel[n]) / m.funnel[n - 1]) + "%"
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mini">
            Distinct anonymous devices completing the steps in order within the
            period. Average voters includes repeat-edit deduplication and group
            rooms with zero votes.
          </p>
          {Object.entries(m.ranks).map(([k, rows]) => (
            <div key={k}>
              <h3>Top {k === "cities" ? "start cities" : k}</h3>
              {rows.length ? (
                rows.map(([s, v]) => (
                  <p className="row" key={s}>
                    {s}
                    <span>{v}</span>
                  </p>
                ))
              ) : (
                <p>No activity yet.</p>
              )}
            </div>
          ))}
        </section>
      ))}
    </main>
  );
}
