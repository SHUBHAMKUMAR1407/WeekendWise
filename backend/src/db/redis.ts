import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import type { Room, Participant } from "../types/index";
export const TTL = 30 * 86400;
export const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const local = globalThis as typeof globalThis & {
  chaleinRooms?: Map<string, Room>;
  chaleinLimits?: Map<string, { count: number; end: number }>;
};
const rooms = (local.chaleinRooms ??= new Map());
const counters = (local.chaleinLimits ??= new Map());
export function requireStore() {
  if (!redis && process.env.NODE_ENV === "production")
    throw new ApiError(503, "Trip storage is unavailable. Try again in a bit.");
}
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const participantId = (roomId: string, anon: string) =>
  hash(roomId + ":" + anon).slice(0, 20);
export async function getRoom(id: string): Promise<Room | null> {
  requireStore();
  if (redis) return redis.get<Room>("room:" + id);
  const room = rooms.get(id);
  if (room && Date.parse(room.createdAt) + TTL * 1000 > Date.now()) return room;
  rooms.delete(id);
  return null;
}
export async function createRoom(
  data: Omit<Room, "id" | "createdAt" | "participants">,
  solo?: Omit<Participant, "joinedAt" | "id">,
  anon = "",
) {
  requireStore();
  for (let i = 0; i < 3; i++) {
    const id = nanoid(10),
      createdAt = new Date().toISOString();
    const room: Room = {
      ...data,
      id,
      createdAt,
      participants: solo
        ? [{ ...solo, id: participantId(id, anon), joinedAt: createdAt }]
        : [],
    };
    if (redis) {
      if (!(await redis.set("room:" + id, room, { nx: true, ex: TTL })))
        continue;
    } else rooms.set(id, room);
    return room;
  }
  throw new ApiError(503, "Try creating your trip again.");
}
const joinScript = `
local raw=redis.call('GET',KEYS[1])
if not raw then return 'missing' end
local room=cjson.decode(raw)
if room.mode~='group' then return 'solo' end
local person=cjson.decode(ARGV[1])
local found=false
for i,p in ipairs(room.participants) do
 if p.id==person.id then person.joinedAt=p.joinedAt;room.participants[i]=person;found=true;break end
end
if not found then
 if #room.participants>=20 then return 'full' end
 table.insert(room.participants,person)
end
local result=cjson.encode(room)
redis.call('SET',KEYS[1],result,'KEEPTTL')
return result`;
export async function joinRoom(id: string, person: Participant): Promise<Room> {
  requireStore();
  if (redis) {
    const result = await redis.eval<unknown[], Room | string>(
      joinScript,
      ["room:" + id],
      [JSON.stringify(person)],
    );
    if (typeof result !== "string") return result;
    if (result === "missing")
      throw new ApiError(404, "This room expired. Make a new one.");
    if (result === "full")
      throw new ApiError(409, "This room has 20 travellers already.");
    if (result === "solo") throw new ApiError(409, "This is a solo trip.");
    return JSON.parse(result);
  }
  const r = await getRoom(id);
  if (!r) throw new ApiError(404, "This room expired. Make a new one.");
  if (r.mode === "solo") throw new ApiError(409, "This is a solo trip.");
  const old = r.participants.find((p) => p.id === person.id);
  if (old) Object.assign(old, { ...person, joinedAt: old.joinedAt });
  else if (r.participants.length < 20) r.participants.push(person);
  else throw new ApiError(409, "This room has 20 travellers already.");
  return r;
}
export async function markRevealed(id: string) {
  const r = await getRoom(id);
  if (!r) throw new ApiError(404, "This room expired. Make a new one.");
  if (!r.participants.length) throw new ApiError(409, "Add a vote first.");
  if (!r.revealed) {
    if (redis) {
      const changed = await redis.eval(
        "local raw=redis.call('GET',KEYS[1]); if not raw then return 0 end; local r=cjson.decode(raw); r.revealed=true; redis.call('SET',KEYS[1],cjson.encode(r),'KEEPTTL'); return 1",
        ["room:" + id],
        [],
      );
      if (!changed)
        throw new ApiError(404, "This room expired. Make a new one.");
    }
    r.revealed = true;
  }
  return r;
}
const limits = { create: 10, vote: 60, event: 300, places: 120 };
const limiters = redis
  ? Object.fromEntries(
      Object.entries(limits).map(([scope, n]) => [
        scope,
        new Ratelimit({
          redis: redis!,
          limiter: Ratelimit.slidingWindow(n, "1 h"),
          prefix: "limit:" + scope,
        }),
      ]),
    )
  : null;
export async function rate(req: Request, scope: keyof typeof limits) {
  if (process.env.NODE_ENV === "development" && scope !== "places") return;
  requireStore();
  const ip = hash(
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0] ||
      req.headers.get("x-forwarded-for")?.split(",")[0] ||
      "local",
  );
  let ok: boolean;
  if (limiters) ok = (await limiters[scope].limit(ip)).success;
  else {
    const k = scope + ip;
    let v = counters.get(k);
    if (!v || v.end <= Date.now()) {
      v = { count: 0, end: Date.now() + 3600000 };
      counters.set(k, v);
    }
    ok = ++v.count <= limits[scope];
  }
  if (!ok)
    throw new ApiError(
      429,
      "Too many requests. Please try again in an hour.",
    );
}
