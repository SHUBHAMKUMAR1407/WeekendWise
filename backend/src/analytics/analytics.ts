import { MongoServerError } from "mongodb";
import { hash, requireStore } from "../db/store";
import { database, hasMongo } from "../db/mongodb";
import { todayIST } from "../utils/dates";
import { EVENTS, type EventName } from "../types/index";
export const isCrawler = (ua: string) =>
  /^(?:WhatsApp(?:\/|\s|$))|bot\b|bot\/|crawler|spider|facebookexternalhit|Facebot|Slackbot|Discordbot|TelegramBot|LinkedInBot|SkypeUriPreview|preview|HeadlessChrome/i.test(ua);
export const STAGES = ["Visited", "Created or voted", "Viewed reveal", "Generated Parent Pack"] as const;
const rankNames = ["cities", "destinations", "referrers"] as const;
interface Metric {
  counts: Record<string, number>;
  sets: Map<string, Set<string>>;
  ranks: Record<string, Record<string, number>>;
}
interface MetricDocument {
  _id: string; scope: string; version: number;
  counts: Record<string, number>;
  sets: Record<string, string[]>;
  ranks: Record<string, Record<string, number>>;
}
const local = globalThis as typeof globalThis & { chaleinMetricsV2?: Map<string, Metric> };
const mem = (local.chaleinMetricsV2 ??= new Map<string, Metric>());
export interface Hit {
  name: EventName; anonId: string; roomId?: string; internal?: boolean;
  source?: string; city?: string; destination?: string; mode?: string;
  groupCreated?: boolean; createdDay?: string;
}
const empty = (): Metric => ({ counts: {}, sets: new Map(), ranks: {} });
function bucket(scope: string) {
  if (!mem.has(scope)) mem.set(scope, empty());
  return mem.get(scope)!;
}
function set(m: Metric, key: string) {
  if (!m.sets.has(key)) m.sets.set(key, new Set());
  return m.sets.get(key)!;
}
function decode(doc: MetricDocument): Metric {
  return { counts: doc.counts, ranks: doc.ranks,
    sets: new Map(Object.entries(doc.sets).map(([k, values]) => [k, new Set(values)])) };
}
// Partition by anonymous visitor rather than growing one shared dashboard document.
// Version checks keep deduplication and ordered funnel updates atomic per visitor.
async function mutate(scope: string, anon: string, change: (m: Metric) => void) {
  requireStore();
  if (!hasMongo()) { change(bucket(scope)); return; }
  const collection = (await database()).collection<MetricDocument>("analytics");
  const id = hash(scope + ":" + anon);
  for (let attempt = 0; attempt < 50; attempt++) {
    const old = await collection.findOne({ _id: id });
    const m = old ? decode(old) : empty();
    change(m);
    const doc: MetricDocument = { _id: id, scope, version: (old?.version ?? -1) + 1,
      counts: m.counts, ranks: m.ranks,
      sets: Object.fromEntries([...m.sets].map(([k, values]) => [k, [...values]])),
    };
    if (old) {
      if ((await collection.replaceOne({ _id: id, version: old.version }, doc)).matchedCount) return;
    } else {
      try { await collection.insertOne(doc); return; }
      catch (error) {
        if (!(error instanceof MongoServerError) || error.code !== 11000) throw error;
      }
    }
  }
  throw new Error("Analytics update contention");
}
export async function trackServer(req: Request, h: Hit) {
  try {
    if (h.internal || isCrawler(req.headers.get("user-agent") || "")) return;
    const anon = hash(h.anonId), room = h.roomId || "";
    const token = h.name === "room_created" ? room : h.name === "vote_submitted" ? hash(room + anon) : "";
    const stage = ({ page_view: 0, room_created: 1, vote_submitted: 1,
      reveal_viewed: 2, parent_pack_generated: 3 } as Partial<Record<EventName, number>>)[h.name] ?? -1;
    const pairs: string[][] = [];
    if (h.name === "page_view") pairs.push(["referrers", h.source || "direct"]);
    if (h.city && h.name === "room_created") pairs.push(["cities", h.city]);
    if (h.destination && h.name === "trip_check_run") pairs.push(["destinations", h.destination]);
    if (h.mode && h.destination) pairs.push([h.name + ":byRoute", h.destination + "/" + h.mode]);
    await Promise.all(["all", todayIST()].map((scope) => mutate(scope, anon, (m) => {
      if (token) {
        const seen = set(m, "dedup:" + h.name);
        if (seen.has(token)) return;
        seen.add(token);
      }
      m.counts[h.name] = (m.counts[h.name] || 0) + 1;
      set(m, "users:" + h.name).add(anon);
      if (stage >= 0 && (stage === 0 || set(m, "stage:" + (stage - 1)).has(anon))) set(m, "stage:" + stage).add(anon);
      if (h.groupCreated) set(m, "groups").add(room);
      for (const [key, value] of pairs) {
        const rank = (m.ranks[key] ??= Object.create(null));
        // Encode labels so user supplied dots and dollar signs are safe BSON keys.
        const label = hasMongo() ? Buffer.from(value).toString("base64url") : value;
        rank[label] = (rank[label] || 0) + 1;
      }
    })));
    if (h.name === "vote_submitted" && h.createdDay) {
      await Promise.all(["all", h.createdDay].map(async (scope) => {
        const exists = hasMongo()
          ? await (await database()).collection<MetricDocument>("analytics").findOne({ scope, "sets.groups": room }, { projection: { _id: 1 } })
          : set(bucket(scope), "groups").has(room);
        if (exists) await mutate(scope, anon, (m) => { set(m, "members").add(token); });
      }));
    }
  } catch {
    /* Analytics outages must never interrupt trip planning. */
  }
}
export async function metrics(scope: string) {
  requireStore();
  let m = bucket(scope);
  if (hasMongo()) {
    m = empty();
    const cursor = (await database()).collection<MetricDocument>("analytics").find({ scope });
    for await (const doc of cursor) {
      for (const [key, value] of Object.entries(doc.counts)) m.counts[key] = (m.counts[key] || 0) + value;
      for (const [key, values] of Object.entries(doc.sets)) for (const value of values) set(m, key).add(value);
      for (const [key, rank] of Object.entries(doc.ranks)) {
        const target = (m.ranks[key] ??= Object.create(null));
        for (const [label, value] of Object.entries(rank)) {
          const name = Buffer.from(label, "base64url").toString();
          target[name] = (target[name] || 0) + value;
        }
      }
    }
  }
  const groups = set(m, "groups").size;
  const ranks = Object.fromEntries(rankNames.map((key) => [key,
    Object.entries(m.ranks[key] ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 10),
  ]));
  return {
    visitors: set(m, "users:page_view").size,
    avgVoters: groups ? set(m, "members").size / groups : 0,
    groups, funnel: STAGES.map((_, i) => set(m, "stage:" + i).size),
    counts: Object.fromEntries(EVENTS.map((e) => [e, Number(m.counts[e] || 0)])), ranks,
  };
}
