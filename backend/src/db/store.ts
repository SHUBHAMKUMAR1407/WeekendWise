import { MongoServerError } from "mongodb";
import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import { database, hasMongo } from "./mongodb";
import type { Room, Participant } from "../types/index";

export const TTL = 30 * 86400;
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
interface RoomDocument { _id: string; room: Room; version: number; expiresAt: Date }
interface LimitDocument { _id: string; hits: { at: Date; token: string }[]; expiresAt: Date }
const local = globalThis as typeof globalThis & {
  chaleinRooms?: Map<string, Room>;
  chaleinLimits?: Map<string, { count: number; end: number }>;
};
const rooms = (local.chaleinRooms ??= new Map());
const counters = (local.chaleinLimits ??= new Map());
export function requireStore() {
  if (!hasMongo() && process.env.NODE_ENV === "production")
    throw new ApiError(503, "Trip storage is unavailable. Try again in a bit.");
}
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const participantId = (roomId: string, anon: string) => hash(roomId + ":" + anon).slice(0, 20);
export async function getRoom(id: string): Promise<Room | null> {
  requireStore();
  if (hasMongo()) {
    const db = await database();
    return (await db.collection<RoomDocument>("rooms").findOne({
      _id: id, expiresAt: { $gt: new Date() },
    }))?.room ?? null;
  }
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
    const id = nanoid(10), createdAt = new Date().toISOString();
    const room: Room = { ...data, id, createdAt,
      participants: solo ? [{ ...solo, id: participantId(id, anon), joinedAt: createdAt }] : [],
    };
    if (hasMongo()) {
      try {
        const db = await database();
        await db.collection<RoomDocument>("rooms").insertOne({
          _id: id, room, version: 0,
          expiresAt: new Date(Date.parse(createdAt) + TTL * 1000),
        });
      } catch (error) {
        if (error instanceof MongoServerError && error.code === 11000) continue;
        throw error;
      }
    } else rooms.set(id, room);
    return room;
  }
  throw new ApiError(503, "Try creating your trip again.");
}

// Compare-and-swap prevents concurrent votes from overwriting each other.
async function updateRoom(id: string, change: (room: Room) => void): Promise<Room> {
  requireStore();
  if (!hasMongo()) {
    const room = await getRoom(id);
    if (!room) throw new ApiError(404, "This room expired. Make a new one.");
    change(room);
    return room;
  }
  const collection = (await database()).collection<RoomDocument>("rooms");
  for (let attempt = 0; attempt < 50; attempt++) {
    const doc = await collection.findOne({ _id: id, expiresAt: { $gt: new Date() } });
    if (!doc) throw new ApiError(404, "This room expired. Make a new one.");
    change(doc.room);
    const result = await collection.updateOne({
      _id: id, version: doc.version, expiresAt: { $gt: new Date() },
    }, { $set: { room: doc.room }, $inc: { version: 1 } });
    if (result.matchedCount) return doc.room;
  }
  throw new ApiError(503, "Your trip is busy. Please try again.");
}
export async function joinRoom(id: string, person: Participant): Promise<Room> {
  return updateRoom(id, (room) => {
    if (room.mode === "solo") throw new ApiError(409, "This is a solo trip.");
    const old = room.participants.find((p) => p.id === person.id);
    if (old) Object.assign(old, { ...person, joinedAt: old.joinedAt });
    else if (room.participants.length < 20) room.participants.push(person);
    else throw new ApiError(409, "This room has 20 travellers already.");
  });
}
export async function markRevealed(id: string) {
  return updateRoom(id, (room) => {
    if (!room.participants.length) throw new ApiError(409, "Add a vote first.");
    room.revealed = true;
  });
}
const limits = { create: 10, vote: 60, event: 300, places: 120, report: 10 };
export async function rate(req: Request, scope: keyof typeof limits) {
  if (process.env.NODE_ENV === "development" && scope !== "places" && scope !== "report") return;
  requireStore();
  const ip = hash(req.headers.get("x-vercel-forwarded-for")?.split(",")[0] ||
    req.headers.get("x-forwarded-for")?.split(",")[0] || "local");
  let count: number;
  if (hasMongo()) {
    const now = Date.now(), token = nanoid();
    const collection = (await database()).collection<LimitDocument>("rate_limits");
    const key = scope + ":" + ip;
    // Atomically prune the sliding hour and admit at most the scope's quota.
    const update = [
      { $set: { hits: { $filter: { input: { $ifNull: ["$hits", []] }, as: "hit",
        cond: { $gt: ["$$hit.at", new Date(now - 3600000)] },
      } }, expiresAt: new Date(now + 3600000) } },
      { $set: { hits: { $cond: [ { $lt: [{ $size: "$hits" }, limits[scope]] },
        { $concatArrays: ["$hits", [{ at: new Date(now), token }]] }, "$hits",
      ] } } },
    ];
    let doc;
    try {
      doc = await collection.findOneAndUpdate({ _id: key }, update, { upsert: true, returnDocument: "after" });
    } catch (error) {
      if (!(error instanceof MongoServerError) || error.code !== 11000) throw error;
      doc = await collection.findOneAndUpdate({ _id: key }, update, { returnDocument: "after" });
    }
    if (!doc) throw new ApiError(503, "Please try again.");
    count = doc.hits.some((hit) => hit.token === token) ? 1 : limits[scope] + 1;
  } else {
    const key = scope + ip;
    let value = counters.get(key);
    if (!value || value.end <= Date.now()) {
      value = { count: 0, end: Date.now() + 3600000 };
      counters.set(key, value);
    }
    count = ++value.count;
  }
  if (count > limits[scope])
    throw new ApiError(429, "Too many requests. Please try again in an hour.");
}
