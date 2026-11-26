import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { database } from "../src/db/mongodb";
import { createRoom, getRoom, joinRoom, markRevealed, rate, requireStore, TTL } from "../src/db/store";
import { metrics, trackServer } from "../src/analytics/analytics";
import { todayIST } from "../src/utils/dates";
import type { Participant } from "../src/types/index";

// Opt in to downloading and launching a real, disposable MongoDB server.
describe.skipIf(process.env.MONGODB_INTEGRATION !== "1")("MongoDB integration", () => {
  let server: MongoMemoryServer;
  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    vi.stubEnv("MONGODB_URI", server.getUri());
    vi.stubEnv("MONGODB_DB", "weekendwise_test");
    vi.stubEnv("NODE_ENV", "production");
    await database();
  }, 600000);
  afterAll(async () => {
    if (server) {
      await (await database()).client.close();
      await server.stop();
    }
    vi.unstubAllEnvs();
  });
  const input = { mode: "group" as const, startCity: "Delhi NCR" as const,
    startDate: "2030-04-12", endDate: "2030-04-14", maxBudgetPerPerson: 6000 };
  const person = (id: string): Participant => ({ id, name: "Asha", comfortBudget: 5000,
    vibes: ["peace_cafes"], joinedAt: new Date().toISOString() });

  it("preserves concurrent votes, duplicate edits, capacity and the original expiry", async () => {
    const room = await createRoom(input);
    await expect(markRevealed(room.id)).rejects.toMatchObject({ status: 409 });
    const collection = (await database()).collection<{ _id: string; expiresAt: Date }>("rooms");
    const before = await collection.findOne({ _id: room.id });
    await Promise.all(Array.from({ length: 20 }, (_, i) => joinRoom(room.id, person(String(i)))));
    await Promise.all(Array.from({ length: 5 }, () => joinRoom(room.id, { ...person("0"), comfortBudget: 3500 })));
    await expect(joinRoom(room.id, person("overflow"))).rejects.toMatchObject({ status: 409 });
    const revealed = await markRevealed(room.id);
    expect(revealed.participants).toHaveLength(20);
    expect(revealed.participants.find((p) => p.id === "0")?.comfortBudget).toBe(3500);
    expect(revealed.revealed).toBe(true);
    expect((await getRoom(room.id))?.revealed).toBe(true);
    const after = await collection.findOne({ _id: room.id });
    expect(after?.expiresAt).toEqual(before?.expiresAt);
    expect(after!.expiresAt.getTime() - Date.parse(room.createdAt)).toBe(TTL * 1000);
  });
  it("rejects expired reads and writes before the TTL cleaner runs, and rejects solo votes", async () => {
    const room = await createRoom(input);
    await (await database()).collection<{ _id: string; expiresAt: Date }>("rooms").updateOne({ _id: room.id }, { $set: { expiresAt: new Date(0) } });
    expect(await getRoom(room.id)).toBeNull();
    await expect(joinRoom(room.id, person("1"))).rejects.toMatchObject({ status: 404 });
    await expect(markRevealed(room.id)).rejects.toMatchObject({ status: 404 });
    const { id, joinedAt, ...solo } = person("solo");
    const soloRoom = await createRoom({ ...input, mode: "solo" }, solo, "anon");
    await expect(joinRoom(soloRoom.id, person("2"))).rejects.toMatchObject({ status: 409 });
  });
  it("enforces atomic quotas across simultaneous requests", async () => {
    const req = new Request("http://localhost", { headers: { "x-forwarded-for": "mongo-quota" } });
    const results = await Promise.allSettled(Array.from({ length: 15 }, () => rate(req, "create")));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(10);
    for (const result of results) if (result.status === "rejected") expect(result.reason.status).toBe(429);
    const clock = vi.spyOn(Date, "now");
    const start = new Date().getTime();
    try {
      clock.mockReturnValue(start + 59 * 60000);
      await expect(rate(req, "create")).rejects.toMatchObject({ status: 429 });
      clock.mockReturnValue(start + 61 * 60000);
      await expect(rate(req, "create")).resolves.toBeUndefined();
    } finally { clock.mockRestore(); }
  });
  it("persists deduplicated funnels, group cohorts and arbitrary ranking labels", async () => {
    const req = new Request("http://localhost", { headers: { "user-agent": "Mozilla/5.0" } });
    const anonId = "mongo-owner", roomId = "mongo-room";
    await trackServer(req, { name: "page_view", anonId, source: "$example.com" });
    await Promise.all(Array.from({ length: 5 }, () => trackServer(req, {
      name: "room_created", anonId, roomId, groupCreated: true, city: "Delhi NCR",
    })));
    await trackServer(req, { name: "reveal_viewed", anonId });
    await trackServer(req, { name: "parent_pack_generated", anonId });
    const voter = "mongo-voter";
    await trackServer(req, { name: "page_view", anonId: voter });
    await Promise.all(Array.from({ length: 5 }, () => trackServer(req, {
      name: "vote_submitted", anonId: voter, roomId, createdDay: todayIST(),
    })));
    for (const scope of ["all", todayIST()]) {
      const m = await metrics(scope);
      expect(m.visitors).toBe(2);
      expect(m.counts.room_created).toBe(1);
      expect(m.counts.vote_submitted).toBe(1);
      expect(m.funnel).toEqual([2, 2, 1, 1]);
      expect(m.groups).toBe(1);
      expect(m.avgVoters).toBe(1);
      expect(m.ranks.referrers).toContainEqual(["$example.com", 1]);
    }
  });
  it("requires MongoDB configuration in production", () => {
    vi.stubEnv("MONGODB_URI", "");
    try { expect(requireStore).toThrow("Trip storage is unavailable"); }
    finally { vi.stubEnv("MONGODB_URI", server.getUri()); }
  });
});
