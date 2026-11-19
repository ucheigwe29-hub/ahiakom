import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
test("disk-backed PostgreSQL data survives a fresh application process", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "ahiakom-persistence-"));
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_DRIVER: "pglite",
    DATABASE_PATH: path.join(root, "db"),
  };
  try {
    const run = (mode: string) =>
      execFileSync(
        process.execPath,
        ["--import", "tsx", "tests/fixtures/persistence.ts", mode],
        { env, encoding: "utf8", timeout: 30000 },
      );
    assert.match(run("write"), /Committed/);
    assert.match(run("read"), /Restored/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
