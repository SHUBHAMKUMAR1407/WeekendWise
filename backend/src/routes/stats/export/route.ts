import { statsAccess } from "@backend/auth/stats";
import { metrics, STAGES } from "@backend/analytics/analytics";
import { todayIST } from "@backend/utils/dates";
import { requireStore } from "@backend/db/store";
import { failure } from "@backend/http/api";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!statsAccess(new URL(req.url).searchParams.get("key")))
    return new Response(null, { status: 404 });
  try {
    requireStore();
    const rows: (string | number)[][] = [
      ["Period", "Metric", "Label", "Value"],
    ];
    for (const period of [todayIST(), "all"]) {
      const m = await metrics(period);
      rows.push(
        [period, "unique_visitors", "", m.visitors],
        [period, "avg_voters_per_group", "", m.avgVoters],
      );
      Object.entries(m.counts).forEach(([k, v]) =>
        rows.push([period, "event", k, v]),
      );
      STAGES.forEach((s, i) => {
        rows.push([period, "funnel", s, m.funnel[i]]);
        if (i && m.funnel[i - 1])
          rows.push([
            period,
            "conversion_pct",
            s,
            (100 * m.funnel[i]) / m.funnel[i - 1],
          ]);
      });
      Object.entries(m.ranks).forEach(([k, v]) =>
        v.forEach(([s, n]) => rows.push([period, k, s, n])),
      );
    }
    const cell = (v: string | number) =>
      '"' +
      String(v)
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    return new Response(rows.map((r) => r.map(cell).join(",")).join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="weekendwise-stats.csv"',
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
