import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it } from "vitest";

it("preserves backend settings when Next reloads the frontend environment", () => {
  // Stay under the repository so the copied config can resolve @next/env.
  const root = mkdtempSync(path.join(process.cwd(), ".env-reload-test-"));
  try {
    mkdirSync(path.join(root, "backend"));
    mkdirSync(path.join(root, "frontend"));
    writeFileSync(path.join(root, "backend/.env.development.local"), "WEEKENDWISE_ENV_RELOAD_TEST=backend-value\n");
    const config = path.join(root, "frontend/next.config.mjs");
    copyFileSync("frontend/next.config.mjs", config);
    const output = execFileSync(process.execPath, ["--input-type=module"], {
      env: { ...process.env, NODE_ENV: "development" },
      input: `
        import nextEnv from '@next/env';
        import assert from 'node:assert/strict';
        delete process.env.WEEKENDWISE_ENV_RELOAD_TEST;
        await import(${JSON.stringify(pathToFileURL(config).href)});
        assert.equal(process.env.WEEKENDWISE_ENV_RELOAD_TEST, 'backend-value');
        nextEnv.loadEnvConfig(${JSON.stringify(path.join(root, "frontend"))}, true, console, true);
        assert.equal(process.env.WEEKENDWISE_ENV_RELOAD_TEST, 'backend-value');
        console.log('preserved');
      `,
      encoding: "utf8",
    });
    expect(output.trim()).toBe("preserved");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
