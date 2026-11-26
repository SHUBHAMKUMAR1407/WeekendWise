import { describe, expect, it, vi } from "vitest";
import { destinationId, updateSchema } from "../src/schemas/updates";
import { recentUpdates, saveUpdate } from "../src/db/updates";
import { addDays, todayIST } from "../src/utils/dates";
import records from "../data/destinations.json";
vi.hoisted(() => { vi.stubEnv("MONGODB_URI", ""); });
const destination = records[0].id;
const input = () => ({ anonId: crypto.randomUUID(), name: "Asha", visitedOn: todayIST(),
  weather: "rainy" as const, crowd: "busy" as const, experience: "caution" as const,
  note: "Rain after lunch. The market was busy.", visited: true as const });

describe("traveller updates", () => {
  it("accepts only known destinations and recent, firsthand visits", () => {
    expect(destinationId.safeParse("invented-place").success).toBe(false);
    expect(destinationId.parse(destination)).toBe(destination);
    expect(updateSchema.safeParse(input()).success).toBe(true);
    for (const patch of [
      { visitedOn: addDays(todayIST(), 1) }, { visitedOn: addDays(todayIST(), -7) },
      { visitedOn: "2026-02-30" }, { visited: false }, { anonId: "bad-id" },
      { weather: "anything" }, { crowd: "anything" }, { note: "x".repeat(281) },
      { name: "x".repeat(41) }, { unexpected: "field" },
    ]) expect(updateSchema.safeParse({ ...input(), ...patch }).success).toBe(false);
    expect(updateSchema.parse({ ...input(), visitedOn: addDays(todayIST(), -6) }).visitedOn).toBe(addDays(todayIST(), -6));
  });
  it("edits one report per browser and visit day, keeps destinations separate and omits private IDs", async () => {
    const data = input();
    const saved = await saveUpdate(destination, data);
    const edited = await saveUpdate(destination, { ...data, crowd: "quiet", note: "Quiet in the morning." });
    expect(edited.id).toBe(saved.id);
    await saveUpdate(records[1].id, data);
    const result = await recentUpdates(destination);
    expect(result.reports.filter((r) => r.id === saved.id)).toHaveLength(1);
    expect(result.reports.find((r) => r.id === saved.id)?.crowd).toBe("quiet");
    expect(result.reports.every((r) => r.destinationId === destination)).toBe(true);
    expect(JSON.stringify(result)).not.toContain(data.anonId);
    expect(JSON.stringify(result)).not.toContain('"anonId"');
  });
  it("removes stale observations from recent results even when they are still stored", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const saved = await saveUpdate(destination, input());
      vi.advanceTimersByTime(7 * 86400000);
      expect((await recentUpdates(destination)).reports.some((r) => r.id === saved.id)).toBe(false);
    } finally { vi.useRealTimers(); }
  });
  it("summarises the same latest 20 reports that are shown, and labels unnamed visitors", async () => {
    const target = records[2].id;
    for (let i = 0; i < 22; i++) await saveUpdate(target, { ...input(), name: "" });
    const result = await recentUpdates(target);
    expect(result.reports).toHaveLength(20);
    expect(result.summary).toEqual({ count: 20, weather: { rainy: 20 }, crowd: { busy: 20 }, experience: { caution: 20 } });
    expect(result.reports[0].name).toBe("Traveller");
  });
});
