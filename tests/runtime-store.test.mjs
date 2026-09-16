import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
test("Vercel fails clearly without DATABASE_URL instead of writing SQLite", () => {
  const result = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import {store} from './lib/runtime-store.mjs';try{await store();process.exit(1)}catch(e){if(e.code!=='DATABASE_CONFIG')throw e;console.log(e.code)}`,
    ],
    {
      env: { ...process.env, DATABASE_URL: "", VERCEL: "1" },
      encoding: "utf8",
    },
  );
  assert.equal(result.trim(), "DATABASE_CONFIG");
});
test("invalid database URL is rejected without printing credentials", () => {
  const result = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import {store} from './lib/runtime-store.mjs';try{await store();process.exit(1)}catch(e){if(e.code!=='DATABASE_CONFIG')throw e;console.log(e.code)}`,
    ],
    {
      env: {
        ...process.env,
        DATABASE_URL: "https://example.invalid",
        VERCEL: "1",
      },
      encoding: "utf8",
    },
  );
  assert.equal(result.trim(), "DATABASE_CONFIG");
});
