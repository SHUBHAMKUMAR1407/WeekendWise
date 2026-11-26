import { MongoServerError } from "mongodb";
import { database, hasMongo } from "./mongodb";
import { hash, requireStore } from "./store";
import { addDays, todayIST } from "../utils/dates";
import type { UpdateInput } from "../schemas/updates";
import type { TravellerUpdate, TravellerUpdates } from "../types/updates";

interface UpdateDocument { _id: string; report: TravellerUpdate; expiresAt: Date }
const shared = globalThis as typeof globalThis & { weekendwiseUpdates?: Map<string, UpdateDocument> };
const local = (shared.weekendwiseUpdates ??= new Map());

export async function saveUpdate(destinationId: string, input: UpdateInput): Promise<TravellerUpdate> {
  requireStore();
  // One editable report per browser, destination and visit day; no public device ID.
  const id = hash(destinationId + ":" + input.anonId + ":" + input.visitedOn);
  const report: TravellerUpdate = {
    id, destinationId, name: input.name || "Traveller", visitedOn: input.visitedOn,
    weather: input.weather, crowd: input.crowd, experience: input.experience,
    note: input.note, updatedAt: new Date().toISOString(),
  };
  const doc: UpdateDocument = { _id: id, report,
    expiresAt: new Date(input.visitedOn + "T00:00:00+05:30") };
  // Delete public reports 30 days after the visit, regardless of later edits.
  doc.expiresAt.setUTCDate(doc.expiresAt.getUTCDate() + 30);
  if (hasMongo()) {
    const collection = (await database()).collection<UpdateDocument>("traveller_updates");
    const update = { $set: { report, expiresAt: doc.expiresAt } };
    try { await collection.updateOne({ _id: id }, update, { upsert: true }); }
    catch (error) {
      if (!(error instanceof MongoServerError) || error.code !== 11000) throw error;
      await collection.updateOne({ _id: id }, update);
    }
  } else local.set(id, doc);
  return report;
}
export async function recentUpdates(destinationId: string): Promise<TravellerUpdates> {
  requireStore();
  const earliest = addDays(todayIST(), -6), today = todayIST();
  let reports: TravellerUpdate[];
  if (hasMongo()) {
    const docs = await (await database()).collection<UpdateDocument>("traveller_updates")
      .find({ "report.destinationId": destinationId,
        "report.visitedOn": { $gte: earliest, $lte: today }, expiresAt: { $gt: new Date() } })
      .sort({ "report.visitedOn": -1, "report.updatedAt": -1, _id: 1 }).limit(20).toArray();
    reports = docs.map((doc) => doc.report);
  } else {
    for (const [id, doc] of local) if (doc.expiresAt.getTime() <= Date.now()) local.delete(id);
    reports = [...local.values()].map((doc) => doc.report)
      .filter((report) => report.destinationId === destinationId && report.visitedOn >= earliest && report.visitedOn <= today)
      .sort((a, b) => b.visitedOn.localeCompare(a.visitedOn) || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
      .slice(0, 20);
  }
  const summary: TravellerUpdates["summary"] = { count: reports.length, weather: {}, crowd: {}, experience: {} };
  for (const report of reports) {
    summary.weather[report.weather] = (summary.weather[report.weather] || 0) + 1;
    summary.crowd[report.crowd] = (summary.crowd[report.crowd] || 0) + 1;
    summary.experience[report.experience] = (summary.experience[report.experience] || 0) + 1;
  }
  return { reports, summary };
}
