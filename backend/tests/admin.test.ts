import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_COOKIE, adminCookie, adminKeyValid, adminSessionExpiry, createAdminSession } from "../src/auth/admin";
import { adminSearch } from "../src/schemas/admin";
import { namePattern, searchAdminRecords } from "../src/db/admin";
import { createRoom, joinRoom } from "../src/db/store";
import { saveUpdate } from "../src/db/updates";
import { todayIST, addDays } from "../src/utils/dates";
import { GET as session, POST as login, DELETE as logout } from "../src/routes/admin/session/route";
import { POST as search } from "../src/routes/admin/search/route";

const secret = "test-admin-key-at-least-32-characters";
const base = { mode: "group" as const, startCity: "Mumbai" as const,
  startDate: "2030-04-12", endDate: "2030-04-14", maxBudgetPerPerson: 6000 };
function req(path: string, payload?: unknown, token?: string, origin = "https://example.test") {
  return new Request("https://example.test/api/admin/" + path, { method: payload === undefined ? "GET" : "POST",
    headers: { origin, ...(token ? { cookie: `${ADMIN_COOKIE}=${token}` } : {}) },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
}
beforeEach(() => {
  vi.stubEnv("MONGODB_URI", ""); vi.stubEnv("ADMIN_SECRET", secret); vi.stubEnv("STATS_SECRET", "");
  const shared = globalThis as typeof globalThis & { chaleinRooms?: Map<string, unknown>; chaleinLimits?: Map<string, unknown>; weekendwiseUpdates?: Map<string, unknown> };
  shared.chaleinRooms?.clear(); shared.chaleinLimits?.clear(); shared.weekendwiseUpdates?.clear();
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("admin authentication", () => {
  it("requires a dedicated strong key and does not grant stats viewers access", () => {
    expect(adminKeyValid(secret)).toBe(true); expect(adminKeyValid("wrong")).toBe(false);
    vi.stubEnv("ADMIN_SECRET", ""); vi.stubEnv("STATS_SECRET", secret);
    expect(adminKeyValid(secret)).toBe(false);
    vi.stubEnv("ADMIN_SECRET", "short"); expect(adminKeyValid("short")).toBe(false);
  });
  it("rejects forged, expired and rotated sessions", () => {
    const now = Date.now(), token = createAdminSession(now);
    expect(adminSessionExpiry(token, now)).toBeGreaterThan(now);
    expect(adminSessionExpiry(token + "0", now)).toBeNull();
    expect(adminSessionExpiry(token.replace("v1.", "v2."), now)).toBeNull();
    expect(adminSessionExpiry(token, now + 3600000)).toBeNull();
    vi.stubEnv("ADMIN_SECRET", secret + "rotated"); expect(adminSessionExpiry(token, now)).toBeNull();
  });
  it("uses private HTTP-only cookies and rejects cross-origin login/logout", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(adminCookie(createAdminSession())).toContain("HttpOnly; SameSite=Strict");
    expect(adminCookie(createAdminSession())).toContain("; Secure");
    vi.stubEnv("NODE_ENV", "test");
    expect((await login(req("session", { key: secret }, undefined, "https://attacker.test"))).status).toBe(403);
    const response = await login(req("session", { key: secret }));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=3600");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(JSON.stringify(await response.json())).not.toContain(secret);
    const token = response.headers.get("set-cookie")!.split(";")[0].slice(ADMIN_COOKIE.length + 1);
    expect((await (await session(req("session", undefined, token))).json()).authenticated).toBe(true);
    expect((await (await session(req("session"))).json()).authenticated).toBe(false);
    expect((await logout(req("session", {}, token, "https://attacker.test"))).status).toBe(403);
    expect((await logout(req("session", {}, token))).headers.get("set-cookie")).toContain("Max-Age=0");
  });
  it("rate-limits repeated invalid login attempts", async () => {
    for (let i = 0; i < 10; i++) expect((await login(req("session", { key: "wrong" }))).status).toBe(401);
    expect((await login(req("session", { key: secret }))).status).toBe(429);
  });
  it("checks authentication before touching production storage or validating names", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await search(req("search", { name: "Asha" }))).status).toBe(401);
    expect((await search(req("search", { name: "Asha" }, createAdminSession(), "https://attacker.test"))).status).toBe(403);
  });
});

describe("admin name search", () => {
  it("escapes regular expressions, handles case-insensitive exact/partial matches, and validates limits", () => {
    expect(namePattern("A.*", "contains").test("Asha")).toBe(false);
    expect(namePattern("A.*", "contains").test("Ms A.*")).toBe(true);
    expect(namePattern("asha", "exact").test("Asha")).toBe(true);
    expect(namePattern("asha", "exact").test("Asha Kumar")).toBe(false);
    for (const input of [{ name: "a" }, { name: " ".repeat(4) }, { name: "x".repeat(81) }, { name: "Asha", page: 0 }, { name: "Asha", unexpected: true }])
      expect(adminSearch.safeParse(input).success).toBe(false);
  });
  it("returns only matched participant details, keeps namesakes separate, and searches reports", async () => {
    const first = await createRoom(base);
    await joinRoom(first.id, { id: "private-asha", name: "Asha Kumar", vibes: ["peace_cafes"], comfortBudget: 5000, joinedAt: new Date().toISOString() });
    await joinRoom(first.id, { id: "private-other", name: "Other Traveller", vibes: ["party_bonfire"], comfortBudget: 8000, joinedAt: new Date().toISOString() });
    const second = await createRoom({ ...base, mode: "solo" }, { name: "Asha Kumar", vibes: ["workation"], comfortBudget: 4000 });
    await saveUpdate("goa", { anonId: crypto.randomUUID(), name: "ASHA Kumar", visitedOn: todayIST(),
      weather: "sunny", crowd: "busy", experience: "go", note: "Busy beach.", visited: true });
    const result = await searchAdminRecords(adminSearch.parse({ name: "asha" }));
    expect(result.tripCount).toBe(2); expect(result.reportCount).toBe(1);
    expect(result.trips.map((trip) => trip.id)).toContain(second.id);
    expect(result.trips.find((trip) => trip.id === first.id)?.participantCount).toBe(2);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("private-asha"); expect(serialized).not.toContain("Other Traveller");
    expect(result.trips.every((trip) => trip.matches.length === 1)).toBe(true);
    const response = await search(req("search", { name: "asha" }, createAdminSession()));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await response.json()).tripCount).toBe(2);
  });
  it("excludes expired records and paginates without duplicate rooms", async () => {
    for (let i = 0; i < 22; i++) await createRoom({ ...base, mode: "solo" }, { name: "Test Person", vibes: ["workation"], comfortBudget: 4000 });
    const input = adminSearch.parse({ name: "Test Person", match: "exact" });
    const first = await searchAdminRecords(input), second = await searchAdminRecords({ ...input, page: 2 });
    expect(first.trips).toHaveLength(20); expect(first.hasMore).toBe(true);
    expect(second.trips).toHaveLength(2); expect(second.hasMore).toBe(false);
    expect(new Set([...first.trips, ...second.trips].map((trip) => trip.id)).size).toBe(22);
    await saveUpdate("goa", { anonId: crypto.randomUUID(), name: "Test Person", visitedOn: todayIST(),
      weather: "sunny", crowd: "quiet", experience: "go", note: "", visited: true });
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(addDays(todayIST(), 31) + "T12:00:00Z"));
    const expired = await searchAdminRecords(input);
    expect(expired.tripCount).toBe(0); expect(expired.reportCount).toBe(0);
  });
});
