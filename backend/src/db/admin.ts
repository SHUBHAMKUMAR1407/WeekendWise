import { database, hasMongo } from "./mongodb";
import { requireStore, TTL } from "./store";
import type { Room } from "../types/index";
import type { TravellerUpdate } from "../types/updates";
import type { AdminSearchInput } from "../schemas/admin";
import type { AdminSearchResult, AdminTrip } from "../types/admin";

interface RoomDocument { _id: string; room: Room; expiresAt: Date }
interface UpdateDocument { _id: string; report: TravellerUpdate; expiresAt: Date }
const PAGE_SIZE = 20;
export function namePattern(name: string, match: "contains" | "exact") {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(match === "exact" ? `^${escaped}$` : escaped, "i");
}
export async function searchAdminRecords(input: AdminSearchInput): Promise<AdminSearchResult> {
  requireStore();
  const pattern = namePattern(input.name, input.match), now = new Date(), skip = (input.page - 1) * PAGE_SIZE;
  let rooms: RoomDocument[], reports: UpdateDocument[], tripCount: number, reportCount: number;
  if (hasMongo()) {
    const db = await database();
    const roomQuery = { expiresAt: { $gt: now }, $or: [{ "room.participants.name": pattern }, { "room.hostName": pattern }] };
    const reportQuery = { expiresAt: { $gt: now }, "report.name": pattern };
    [rooms, reports, tripCount, reportCount] = await Promise.all([
      db.collection<RoomDocument>("rooms").find(roomQuery, { projection: { room: 1, expiresAt: 1 } })
        .sort({ "room.createdAt": -1, _id: 1 }).skip(skip).limit(PAGE_SIZE).toArray(),
      db.collection<UpdateDocument>("traveller_updates").find(reportQuery, { projection: { report: 1, expiresAt: 1 } })
        .sort({ "report.updatedAt": -1, _id: 1 }).skip(skip).limit(PAGE_SIZE).toArray(),
      db.collection("rooms").countDocuments(roomQuery), db.collection("traveller_updates").countDocuments(reportQuery),
    ]);
  } else {
    const shared = globalThis as typeof globalThis & { chaleinRooms?: Map<string, Room>; weekendwiseUpdates?: Map<string, UpdateDocument> };
    const allRooms = [...(shared.chaleinRooms?.values() ?? [])].filter((room) =>
      Date.parse(room.createdAt) + TTL * 1000 > now.getTime() &&
      (room.participants.some((person) => pattern.test(person.name)) || (!!room.hostName && pattern.test(room.hostName))))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
    const allReports = [...(shared.weekendwiseUpdates?.values() ?? [])].filter((doc) => doc.expiresAt > now && pattern.test(doc.report.name))
      .sort((a, b) => b.report.updatedAt.localeCompare(a.report.updatedAt) || a._id.localeCompare(b._id));
    tripCount = allRooms.length; reportCount = allReports.length;
    rooms = allRooms.slice(skip, skip + PAGE_SIZE).map((room) => ({ _id: room.id, room, expiresAt: new Date(Date.parse(room.createdAt) + TTL * 1000) }));
    reports = allReports.slice(skip, skip + PAGE_SIZE);
  }
  const trips: AdminTrip[] = rooms.map(({ room, expiresAt }) => ({
    id: room.id, createdAt: room.createdAt, expiresAt: expiresAt.toISOString(),
    startDate: room.startDate, endDate: room.endDate, startCity: room.startCity, mode: room.mode,
    maxBudgetPerPerson: room.maxBudgetPerPerson, participantCount: room.participants.length,
    revealed: !!room.revealed,
    ...(room.hostName && pattern.test(room.hostName) ? { hostName: room.hostName } : {}),
    matches: room.participants.filter((p) => pattern.test(p.name)).map(({ name, vibes, comfortBudget, joinedAt }) => ({ name, vibes, comfortBudget, joinedAt })),
  }));
  return { ...input, pageSize: PAGE_SIZE, trips, reports: reports.map((doc) => doc.report), tripCount, reportCount,
    hasMore: input.page * PAGE_SIZE < Math.max(tripCount, reportCount) };
}
