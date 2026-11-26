import { MongoServerError, type Document } from "mongodb";
import records from "../../data/destinations.json";
import { database, hasMongo } from "./mongodb";
import { ApiError, hash, requireStore } from "./store";
import { addDays, todayIST } from "../utils/dates";
import type { CrowdSignalInput } from "../schemas/crowd";
import type { CrowdInsights, CrowdObservation } from "../types/crowd";
import { crowdDay, crowdDirection, distanceKm, summarizeObservations, type Observation } from "../services/crowd";
import type { TravellerUpdate } from "../types/updates";

interface SignalDocument {
  _id: string; destinationId: string; kind: "checkin" | "interest";
  date: string; crowd?: CrowdObservation; startDate?: string; endDate?: string;
  updatedAt: string; expiresAt: Date;
}
const shared = globalThis as typeof globalThis & {
  weekendwiseCrowd?: Map<string, SignalDocument>;
  weekendwiseUpdates?: Map<string, { _id: string; report: TravellerUpdate; expiresAt: Date }>;
};
const local = (shared.weekendwiseCrowd ??= new Map());

export async function saveCrowdSignal(destinationId: string, input: CrowdSignalInput) {
  requireStore();
  const destination = records.find((d) => d.id === destinationId);
  if (!destination) throw new ApiError(400, "Choose a supported destination.");
  const today = todayIST(), now = new Date();
  // Match report IDs to deduplicate reports and check-ins from the same browser/day.
  const id = input.kind === "checkin" ? hash(destinationId + ":" + input.anonId + ":" + today)
    : hash(destinationId + ":interest:" + input.anonId);
  if (input.kind === "interest" && !input.interested) {
    if (hasMongo()) await (await database()).collection<SignalDocument>("crowd_signals").deleteOne({ _id: id });
    else local.delete(id);
    return { saved: false };
  }
  if (input.kind === "checkin" && distanceKm(input.latitude, input.longitude, destination.lat, destination.lon) > 25)
    throw new ApiError(400, "Your location is outside this destination’s 25 km check-in area. You can still share a past visit below.");
  // Persist only destination, day, observation and a hashed deduplication key.
  // Coordinates, accuracy, device timestamp, raw browser ID and raw IP are discarded.
  const doc: SignalDocument = {
    _id: id, destinationId, kind: input.kind, date: today, updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 30 * 86400000),
    ...(input.kind === "checkin" ? { crowd: input.crowd } : { startDate: input.startDate, endDate: input.endDate }),
  };
  if (hasMongo()) {
    const collection = (await database()).collection<SignalDocument>("crowd_signals");
    const { _id, ...fields } = doc;
    try { await collection.updateOne({ _id }, { $set: fields }, { upsert: true }); }
    catch (error) {
      if (!(error instanceof MongoServerError) || error.code !== 11000) throw error;
      await collection.updateOne({ _id }, { $set: fields });
    }
  } else local.set(id, doc);
  return { saved: true };
}

export async function crowdInsights(destinationId: string, dates: { startDate: string; endDate: string }): Promise<CrowdInsights> {
  requireStore();
  const today = todayIST(), earliest = addDays(today, -4), now = new Date();
  let days: CrowdInsights["days"], planning: number;
  if (hasMongo()) {
    const db = await database();
    const project: Document = { $project: { subject: "$_id", date: "$report.visitedOn", crowd: "$report.crowd", updatedAt: "$report.updatedAt", checkin: { $literal: false } } };
    const pipeline: Document[] = [
      { $match: { "report.destinationId": destinationId, "report.visitedOn": { $gte: earliest, $lte: today }, expiresAt: { $gt: now } } },
      project,
      { $unionWith: { coll: "crowd_signals", pipeline: [
        { $match: { destinationId, kind: "checkin", date: { $gte: earliest, $lte: today }, expiresAt: { $gt: now } } },
        { $project: { subject: "$_id", date: 1, crowd: 1, updatedAt: 1, checkin: { $literal: true } } },
      ] } },
      { $sort: { updatedAt: -1, checkin: -1 } },
      { $group: { _id: { subject: "$subject", date: "$date" }, crowd: { $first: "$crowd" }, checkin: { $max: "$checkin" } } },
      { $group: { _id: "$_id.date", samples: { $sum: 1 }, checkins: { $sum: { $cond: ["$checkin", 1, 0] } }, total: { $sum: { $switch: {
        branches: [{ case: { $eq: ["$crowd", "quiet"] }, then: 1 }, { case: { $eq: ["$crowd", "moderate"] }, then: 2 },
          { case: { $eq: ["$crowd", "busy"] }, then: 4 }, { case: { $eq: ["$crowd", "packed"] }, then: 5 }], default: 0,
      } } } } },
    ];
    const [totals, interest] = await Promise.all([
      db.collection("traveller_updates").aggregate<{ _id: string; samples: number; total: number; checkins: number }>(pipeline).toArray(),
      db.collection<SignalDocument>("crowd_signals").countDocuments({ destinationId, kind: "interest", expiresAt: { $gt: now },
        startDate: { $lte: dates.endDate }, endDate: { $gte: dates.startDate } }),
    ]);
    days = Array.from({ length: 5 }, (_, i) => {
      const day = addDays(today, i - 4), row = totals.find((r) => r._id === day);
      return crowdDay(day, row?.samples ?? 0, row?.total ?? 0, row?.checkins ?? 0);
    });
    planning = interest;
  } else {
    for (const [id, doc] of local) if (doc.expiresAt <= now) local.delete(id);
    const observations: Observation[] = [...(shared.weekendwiseUpdates?.values() ?? [])]
      .filter((d) => d.report.destinationId === destinationId && d.expiresAt > now)
      .map((d) => ({ subject: d._id, date: d.report.visitedOn, crowd: d.report.crowd, updatedAt: d.report.updatedAt, checkin: false }));
    for (const doc of local.values()) if (doc.destinationId === destinationId && doc.kind === "checkin")
      observations.push({ subject: doc._id, date: doc.date, crowd: doc.crowd!, updatedAt: doc.updatedAt, checkin: true });
    days = summarizeObservations(observations, today);
    planning = [...local.values()].filter((d) => d.destinationId === destinationId && d.kind === "interest" &&
      d.startDate! <= dates.endDate && d.endDate! >= dates.startDate).length;
  }
  return { destinationId, updatedAt: now.toISOString(), days, planning, tripDates: dates, direction: crowdDirection(days) };
}
