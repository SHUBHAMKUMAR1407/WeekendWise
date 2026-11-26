import { afterEach, describe, expect, it, vi } from "vitest";
import { MongoParseError, MongoServerError, MongoServerSelectionError } from "mongodb";
import { storageError } from "../src/db/storage-error";
import { database } from "../src/db/mongodb";
import { failure } from "../src/http/api";

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("production storage errors", () => {
  it.each([
    [new MongoParseError("mongodb://user:secret@private-host"), "STORAGE_CONFIG"],
    [new MongoServerError({ message: "secret", code: 18 }), "STORAGE_AUTH"],
    [new MongoServerError({ message: "secret", code: 13 }), "STORAGE_PERMISSION"],
    [new MongoServerSelectionError("secret", {} as never), "STORAGE_UNREACHABLE"],
    [new Error("secret"), "STORAGE_UNAVAILABLE"],
  ])("returns a safe response and logs only a diagnostic code", async (error, code) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = failure(storageError(error));
    const body = await response.json();
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.code).toBe(code);
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(log).toHaveBeenCalledWith("[WeekendWise] Database request failed", { code });
  });

  it("allows retry after a malformed URI instead of caching the failure", async () => {
    vi.stubEnv("MONGODB_URI", "invalid-uri");
    await expect(database()).rejects.toMatchObject({ code: "STORAGE_CONFIG" });
    await expect(database()).rejects.toMatchObject({ code: "STORAGE_CONFIG" });
    const shared = globalThis as typeof globalThis & { weekendwiseMongo?: unknown };
    expect(shared.weekendwiseMongo).toBeUndefined();
  });
});
