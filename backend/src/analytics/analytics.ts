import { hash, redis } from "../db/redis";
import { todayIST } from "../utils/dates";
import { EVENTS, type EventName } from "../types/index";
export const isCrawler = (ua: string) =>
  /^(?:WhatsApp(?:\/|\s|$))|bot\b|bot\/|crawler|spider|facebookexternalhit|Facebot|Slackbot|Discordbot|TelegramBot|LinkedInBot|SkypeUriPreview|preview|HeadlessChrome/i.test(
    ua,
  );
export const STAGES = [
  "Visited",
  "Created or voted",
  "Viewed reveal",
  "Generated Parent Pack",
] as const;
const rankNames = ["cities", "destinations", "referrers"] as const;
interface Metric {
  counts: Record<string, number>;
  sets: Map<string, Set<string>>;
  ranks: Record<string, Record<string, number>>;
}
const local = globalThis as typeof globalThis & {
  chaleinMetricsV2?: Map<string, Metric>;
};
const mem = (local.chaleinMetricsV2 ??= new Map<string, Metric>());
export interface Hit {
  name: EventName;
  anonId: string;
  roomId?: string;
  internal?: boolean;
  source?: string;
  city?: string;
  destination?: string;
  mode?: string;
  groupCreated?: boolean;
  createdDay?: string;
}
const recordScript = `
local root=KEYS[1]; local event=ARGV[1]; local anon=ARGV[2]; local token=ARGV[3]; local room=ARGV[5]
if token~='' and redis.call('SADD',root..':dedup:'..event,token)==0 then return 0 end
redis.call('HINCRBY',root..':counts',event,1)
redis.call('SADD',root..':users:'..event,anon)
local stage=tonumber(ARGV[4])
if stage>=0 and (stage==0 or redis.call('SISMEMBER',root..':stage:'..(stage-1),anon)==1) then redis.call('SADD',root..':stage:'..stage,anon) end
if ARGV[6]=='yes' then redis.call('SADD',root..':groups',room) end
for i=7,#ARGV,2 do redis.call('ZINCRBY',root..':'..ARGV[i],1,ARGV[i+1]) end
return 1`;
function bucket(scope: string) {
  let m = mem.get(scope);
  if (!m) {
    m = { counts: {}, sets: new Map(), ranks: {} };
    mem.set(scope, m);
  }
  return m;
}
function set(m: Metric, k: string) {
  let s = m.sets.get(k);
  if (!s) {
    s = new Set<string>();
    m.sets.set(k, s);
  }
  return s;
}
export async function trackServer(req: Request, h: Hit) {
  try {
    if (h.internal || isCrawler(req.headers.get("user-agent") || "")) return;
    const anon = hash(h.anonId),
      room = h.roomId || "",
      token =
        h.name === "room_created"
          ? room
          : h.name === "vote_submitted"
            ? hash(room + anon)
            : "";
    const stage =
      (
        {
          page_view: 0,
          room_created: 1,
          vote_submitted: 1,
          reveal_viewed: 2,
          parent_pack_generated: 3,
        } as Partial<Record<EventName, number>>
      )[h.name] ?? -1;
    const pairs: string[][] = [];
    if (h.name === "page_view") pairs.push(["referrers", h.source || "direct"]);
    if (h.city && h.name === "room_created") pairs.push(["cities", h.city]);
    if (h.destination && h.name === "trip_check_run")
      pairs.push(["destinations", h.destination]);
    if (h.mode && h.destination)
      pairs.push([h.name + ":byRoute", h.destination + "/" + h.mode]);
    await Promise.all(
      ["all", todayIST()].map(async (scope) => {
        const root = "metrics:" + scope;
        if (redis) {
          await redis.eval(
            recordScript,
            [root],
            [
              h.name,
              anon,
              token,
              stage,
              room,
              h.groupCreated ? "yes" : "no",
              ...pairs.flat(),
            ],
          );
          return;
        }
        if (process.env.NODE_ENV === "production") return;
        const m = bucket(root);
        if (token) {
          const seen = set(m, "dedup:" + h.name);
          if (seen.has(token)) return;
          seen.add(token);
        }
        m.counts[h.name] = (m.counts[h.name] || 0) + 1;
        set(m, "users:" + h.name).add(anon);
        if (
          stage >= 0 &&
          (stage === 0 || set(m, "stage:" + (stage - 1)).has(anon))
        )
          set(m, "stage:" + stage).add(anon);
        if (h.groupCreated) set(m, "groups").add(room);
        for (const [k, v] of pairs) {
          const rank = (m.ranks[k] ??= {});
          rank[v] = (rank[v] || 0) + 1;
        }
      }),
    );
    if (h.name === "vote_submitted" && h.createdDay) {
      await Promise.all(
        ["all", h.createdDay].map(async (s) => {
          const root = "metrics:" + s;
          if (redis) {
            await redis.eval(
              "if redis.call('SISMEMBER',KEYS[1],ARGV[1])==1 then redis.call('SADD',KEYS[2],ARGV[2]) end",
              [root + ":groups", root + ":members"],
              [room, token],
            );
          } else if (process.env.NODE_ENV !== "production") {
            const m = bucket(root);
            if (set(m, "groups").has(room)) set(m, "members").add(token);
          }
        }),
      );
    }
  } catch {
    /* Analytics outages must never interrupt trip planning. */
  }
}
export async function metrics(scope: string) {
  const root = "metrics:" + scope;
  let counts: Record<string, number> = {},
    sizes: number[] = [];
  const ranks: Record<string, [string, number][]> = {};
  const keys = [
    "users:page_view",
    "groups",
    "members",
    ...STAGES.map((_, i) => "stage:" + i),
  ];
  if (redis) {
    const p = redis.pipeline();
    p.hgetall(root + ":counts");
    keys.forEach((k) => p.scard(root + ":" + k));
    rankNames.forEach((k) =>
      p.zrange(root + ":" + k, 0, 9, { rev: true, withScores: true }),
    );
    const rows = await p.exec();
    counts = (rows[0] || {}) as Record<string, number>;
    sizes = rows.slice(1, 1 + keys.length).map(Number);
    rankNames.forEach((k, i) => {
      const a = rows[1 + keys.length + i] as (string | number)[];
      ranks[k] = [];
      for (let n = 0; n < a.length; n += 2)
        ranks[k].push([String(a[n]), Number(a[n + 1])]);
    });
  } else {
    const m = bucket(root);
    counts = m.counts;
    sizes = keys.map((k) => m.sets.get(k)?.size ?? 0);
    for (const k of rankNames)
      ranks[k] = Object.entries(m.ranks[k] ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
  }
  return {
    visitors: sizes[0],
    avgVoters: sizes[1] ? sizes[2] / sizes[1] : 0,
    groups: sizes[1],
    funnel: sizes.slice(3),
    counts: Object.fromEntries(EVENTS.map((e) => [e, Number(counts[e] || 0)])),
    ranks,
  };
}
