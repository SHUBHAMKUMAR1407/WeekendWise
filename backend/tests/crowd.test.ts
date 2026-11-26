import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import records from "../data/destinations.json";
import { crowdDates, crowdSignal } from "../src/schemas/crowd";
import { crowdInsights, saveCrowdSignal } from "../src/db/crowd";
import { saveUpdate } from "../src/db/updates";
import { crowdDirection, distanceKm, summarizeObservations, type Observation } from "../src/services/crowd";
import { addDays, todayIST } from "../src/utils/dates";
import { GET, POST } from "../src/routes/crowd/[id]/route";

vi.hoisted(() => { vi.stubEnv("MONGODB_URI", ""); });
const destination = records[0];
const anonId = () => crypto.randomUUID();
const dates = () => ({ startDate: todayIST(), endDate: addDays(todayIST(), 2) });
const checkin = (id = anonId()) => ({ kind: "checkin" as const, anonId: id, consent: true as const,
  latitude: destination.lat, longitude: destination.lon, accuracy: 20, timestamp: Date.now(), crowd: "busy" as const });
const report = (id = anonId(), visitedOn = todayIST()) => ({ anonId: id, name: "Visitor", visitedOn,
  weather: "sunny" as const, crowd: "quiet" as const, experience: "go" as const, note: "", visited: true as const });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-26T18:35:00Z")); // Already 27 November in IST.
  const shared = globalThis as typeof globalThis & { weekendwiseCrowd?: Map<string, unknown>; weekendwiseUpdates?: Map<string, unknown> };
  shared.weekendwiseCrowd?.clear(); shared.weekendwiseUpdates?.clear();
});
afterEach(() => vi.useRealTimers());

describe("crowd observation architecture", () => {
  it("always returns five IST calendar days and never invents observations", async () => {
    const data = await crowdInsights(destination.id, dates());
    expect(data.days.map((d) => d.date)).toEqual(["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27"]);
    expect(data.days.every((d) => d.level === null && d.samples === 0)).toBe(true);
    expect(data.direction).toBe("Not enough data");
  });
  it("requires consent, accurate fresh coordinates and valid trip dates", () => {
    expect(crowdSignal.safeParse(checkin()).success).toBe(true);
    for (const patch of [{ consent: false }, { accuracy: 2001 }, { latitude: 91 },
      { timestamp: Date.now() - 300001 }, { timestamp: Date.now() + 60001 }, { ip: "private" }])
      expect(crowdSignal.safeParse({ ...checkin(), ...patch }).success).toBe(false);
    expect(crowdDates.safeParse({ startDate: todayIST(), endDate: addDays(todayIST(), 7) }).success).toBe(false);
    expect(crowdDates.safeParse({ startDate: addDays(todayIST(), -1), endDate: todayIST() }).success).toBe(false);
  });
  it("rejects remote check-ins without persisting them", async () => {
    expect(distanceKm(0, 0, 0, 0)).toBe(0);
    await expect(saveCrowdSignal(destination.id, { ...checkin(), latitude: 0, longitude: 0 })).rejects.toMatchObject({ status: 400 });
    expect((await crowdInsights(destination.id, dates())).days[4].samples).toBe(0);
  });
  it("deduplicates check-ins and visit reports, uses latest crowd, and counts all reports beyond the public 20", async () => {
    const id = anonId();
    await saveUpdate(destination.id, report(id));
    vi.setSystemTime(new Date(Date.now() + 1000));
    await saveCrowdSignal(destination.id, checkin(id));
    await saveCrowdSignal(destination.id, checkin(id));
    let day = (await crowdInsights(destination.id, dates())).days[4];
    expect(day).toMatchObject({ samples: 1, checkins: 1, reports: 0, level: null });
    for (let i = 0; i < 24; i++) await saveUpdate(destination.id, report());
    day = (await crowdInsights(destination.id, dates())).days[4];
    expect(day).toMatchObject({ samples: 25, checkins: 1, reports: 24, level: 1.1, confidence: "Moderate" });
    expect((await crowdInsights(records[1].id, dates())).days[4].samples).toBe(0);
    vi.setSystemTime(new Date(Date.now() + 1000));
    await saveUpdate(destination.id, { ...report(id), crowd: "packed" });
    expect((await crowdInsights(destination.id, dates())).days[4]).toMatchObject({ samples: 25, checkins: 1, level: 1.2 });
  });
  it("tracks explicit planning interest once per browser, filters overlapping dates, and allows removal", async () => {
    const input = { kind: "interest" as const, anonId: anonId(), interested: true, ...dates() };
    await saveCrowdSignal(destination.id, input); await saveCrowdSignal(destination.id, input);
    expect((await crowdInsights(destination.id, dates())).planning).toBe(1);
    expect((await crowdInsights(destination.id, { startDate: addDays(todayIST(), 3), endDate: addDays(todayIST(), 4) })).planning).toBe(0);
    await saveCrowdSignal(destination.id, { ...input, interested: false });
    expect((await crowdInsights(destination.id, dates())).planning).toBe(0);
  });
  it("computes direction only from consecutive sufficiently sampled days", () => {
    const observations: Observation[] = [];
    for (const date of [addDays(todayIST(), -1), todayIST()]) for (let i = 0; i < 3; i++)
      observations.push({ subject: String(i), date, crowd: date === todayIST() ? "packed" : "quiet", updatedAt: date, checkin: false });
    expect(crowdDirection(summarizeObservations(observations, todayIST()))).toBe("Rising");
    observations.pop();
    expect(crowdDirection(summarizeObservations(observations, todayIST()))).toBe("Not enough data");
  });
  it("exposes only aggregate data and retains no coordinates or raw browser IDs", async () => {
    const input = checkin();
    const context = { params: Promise.resolve({ id: destination.id }) };
    const response = await POST(new Request("http://localhost/api/crowd/" + destination.id, {
      method: "POST", body: JSON.stringify(input),
    }), context);
    expect(response.status).toBe(200);
    const get = await GET(new Request("http://localhost/api/crowd/" + destination.id), context);
    expect(get.headers.get("Cache-Control")).toBe("no-store");
    const publicData = JSON.stringify(await get.json());
    expect(publicData).not.toContain(input.anonId);
    const shared = globalThis as typeof globalThis & { weekendwiseCrowd?: Map<string, unknown> };
    const stored = JSON.stringify([...shared.weekendwiseCrowd!.values()]);
    for (const field of ['"latitude"', '"longitude"', '"accuracy"', '"timestamp"', input.anonId]) expect(stored).not.toContain(field);
    expect((await GET(new Request("http://localhost/api/crowd/nope"), { params: Promise.resolve({ id: "nope" }) })).status).toBe(400);
  });
  it("expires signals after 30 days and excludes reports outside the history window", async () => {
    await saveCrowdSignal(destination.id, checkin());
    await saveCrowdSignal(destination.id, { kind: "interest", anonId: anonId(), interested: true,
      startDate: addDays(todayIST(), 31), endDate: addDays(todayIST(), 32) });
    vi.setSystemTime(new Date(Date.now() + 31 * 86400000));
    const result = await crowdInsights(destination.id, dates());
    expect(result.days.every((d) => d.samples === 0)).toBe(true);
    expect(result.planning).toBe(0);
  });
});
