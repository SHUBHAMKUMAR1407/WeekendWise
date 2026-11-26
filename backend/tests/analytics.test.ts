import { vi, describe, it, expect } from "vitest";
import { trackServer, metrics, isCrawler } from "../src/analytics/analytics";
vi.hoisted(() => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
});
describe("funnel", () => {
  it("counts unique people and ordered steps, with server-side deduplication", async () => {
    const req = new Request("https://test.invalid", {
        headers: { "user-agent": "Mozilla/5.0" },
      }),
      anonId = crypto.randomUUID(),
      roomId = "test-room1";
    await trackServer(req, { name: "page_view", anonId });
    await trackServer(req, { name: "page_view", anonId });
    await trackServer(req, {
      name: "room_created",
      anonId,
      roomId,
      groupCreated: true,
    });
    await trackServer(req, {
      name: "room_created",
      anonId,
      roomId,
      groupCreated: true,
    });
    await trackServer(req, { name: "reveal_viewed", anonId });
    await trackServer(req, { name: "parent_pack_generated", anonId });
    await trackServer(req, {
      name: "page_view",
      anonId: crypto.randomUUID(),
      internal: true,
    });
    await trackServer(
      new Request("https://test.invalid", {
        headers: { "User-Agent": "WhatsApp/2.23.10" },
      }),
      { name: "page_view", anonId: crypto.randomUUID() },
    );
    const m = await metrics("all");
    expect(m.visitors).toBe(1);
    expect(m.funnel).toEqual([1, 1, 1, 1]);
    expect(m.counts.room_created).toBe(1);
  });
  it("excludes link crawlers", () => {
    expect(isCrawler("Mozilla/5.0 AppleWebKit/605.1 Mobile Safari/604 WhatsApp/2.24")).toBe(false);
    for (const ua of [
      "WhatsApp/2.24",
      "Twitterbot/1.0",
      "Slackbot-LinkExpanding",
      "Mozilla/5.0 (compatible; Googlebot/2.1)",
      "facebookexternalhit/1.1",
    ])
      expect(isCrawler(ua)).toBe(true);
  });
});
