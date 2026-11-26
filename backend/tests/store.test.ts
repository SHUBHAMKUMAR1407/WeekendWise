import { describe, it, expect, vi } from "vitest";
import {
  createRoom,
  joinRoom,
  rate,
  getRoom,
  markRevealed,
  TTL,
} from "../src/db/store";
import type { Participant } from "../src/types/index";
vi.hoisted(() => {
  vi.stubEnv("MONGODB_URI", "");
});
const input = {
  mode: "group" as const,
  startCity: "Delhi NCR" as const,
  startDate: "2030-04-12",
  endDate: "2030-04-14",
  maxBudgetPerPerson: 6000,
};
const person = (id: string): Participant => ({
  id,
  name: "Asha",
  comfortBudget: 5000,
  vibes: ["peace_cafes", "workation", "trek_adventure"],
  joinedAt: new Date().toISOString(),
});
describe("room lifecycle", () => {
  it("lets family members join, vote and reveal their trip", async () => {
    const r = await createRoom({ ...input, mode: "family" });
    expect((await getRoom(r.id))?.mode).toBe("family");
    await joinRoom(r.id, person("family-member"));
    const revealed = await markRevealed(r.id);
    expect(revealed.revealed).toBe(true);
    expect(revealed.participants).toHaveLength(1);
  });
  it("allows repeated local development actions and enforces quotas outside development", async () => {
    const environment = process.env.NODE_ENV;
    const req = new Request("http://localhost", { headers: { "x-forwarded-for": "development-quota-check" } });
    try {
      vi.stubEnv("NODE_ENV", "development");
      for (let i = 0; i < 15; i++) await rate(req, "create");
      vi.stubEnv("NODE_ENV", "test");
      for (let i = 0; i < 10; i++) await rate(req, "create");
      await expect(rate(req, "create")).rejects.toMatchObject({ status: 429 });
    } finally {
      vi.stubEnv("NODE_ENV", environment);
    }
  });
  it("keeps each vote once, caps at 20 and allows an existing member to edit at capacity", async () => {
    const r = await createRoom(input);
    await expect(markRevealed(r.id)).rejects.toMatchObject({ status: 409 });
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => joinRoom(r.id, person(String(i)))),
    );
    await expect(joinRoom(r.id, person("overflow"))).rejects.toMatchObject({
      status: 409,
    });
    await joinRoom(r.id, { ...person("1"), comfortBudget: 3500 });
    expect((await getRoom(r.id))?.participants).toHaveLength(20);
    expect((await markRevealed(r.id)).revealed).toBe(true);
  });
  it("expires at the original deadline", async () => {
    vi.useFakeTimers();
    try {
      const r = await createRoom(input);
      vi.advanceTimersByTime(1000);
      await joinRoom(r.id, person("one"));
      vi.advanceTimersByTime(TTL * 1000 - 1000);
      expect(await getRoom(r.id)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
  it.each([
    ["create", 10],
    ["vote", 60],
    ["event", 300],
  ] as const)("applies the %s hourly quota", async (scope, n) => {
    const req = new Request("http://localhost");
    for (let i = 0; i < n; i++) await rate(req, scope);
    await expect(rate(req, scope)).rejects.toMatchObject({ status: 429 });
  });
});
