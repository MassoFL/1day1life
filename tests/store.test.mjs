import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../lib/store.mjs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("completion persists, can be undone, and a new day starts fresh", () => {
  const dir = mkdtempSync(join(tmpdir(), "1day1life-"));
  const filename = join(dir, "test.sqlite");
  let db = createStore(filename);
  try {
    db.setComplete("2026-09-16", "a", true);
    db.close();
    db = createStore(filename);
    assert.equal(db.getDay("2026-09-16")[0].done, true);
    assert.equal(
      db.getDay("2026-09-17").some((t) => t.done),
      false,
    );
    db.setComplete("2026-09-16", "a", false);
    assert.equal(db.getDay("2026-09-16")[0].done, false);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("configuration changes today and future days without rewriting previous days", () => {
  const db = createStore(":memory:");
  try {
    db.setComplete("2026-09-15", "a", true);
    db.setComplete("2026-09-16", "a", true);
    db.configure("2026-09-16", [{ id: "a", name: "Walk", score: 50 }]);
    assert.deepEqual(db.getDay("2026-09-16"), [
      { id: "a", name: "Walk", score: 50, done: true },
    ]);
    assert.equal(db.getDay("2026-09-15")[0].score, 20);
    assert.deepEqual(db.getDay("2026-09-17"), [
      { id: "a", name: "Walk", score: 50 },
    ]);
  } finally {
    db.close();
  }
});
test("invalid inputs cannot change stored progress", () => {
  const db = createStore(":memory:");
  try {
    const before = db.getDay("2026-09-16");
    assert.throws(() =>
      db.configure("2026-09-16", [{ id: "a", name: "Invalid", score: -1 }]),
    );
    assert.throws(() => db.getDay("2026-02-30"));
    assert.throws(() => db.setComplete("2026-09-16", "missing", true));
    assert.deepEqual(db.getDay("2026-09-16"), before);
    db.configure("2026-09-16", []);
    assert.deepEqual(db.getDay("2026-09-16"), []);
  } finally {
    db.close();
  }
});
