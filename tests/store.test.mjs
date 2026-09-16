import { DatabaseSync } from "node:sqlite";
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
      {
        id: "a",
        name: "Walk",
        score: 50,
        category: "Général",
        kind: "task",
        done: true,
      },
    ]);
    assert.equal(db.getDay("2026-09-15")[0].score, 20);
    assert.deepEqual(db.getDay("2026-09-17"), [
      { id: "a", name: "Walk", score: 50, category: "Général", kind: "task" },
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

test("prayer mode persists, changes without double counting, and resets with undo/new day", () => {
  const dir = mkdtempSync(join(tmpdir(), "prayers-"));
  const filename = join(dir, "test.sqlite");
  let db = createStore(filename);
  try {
    assert.equal(
      db.getDay("2026-09-16").filter((t) => t.kind === "prayer").length,
      5,
    );
    db.setComplete("2026-09-16", "prayer-fajr", true, "jamaah");
    db.close();
    db = createStore(filename);
    let task = db.getDay("2026-09-16").find((t) => t.id === "prayer-fajr");
    assert.equal(task.prayerMode, "jamaah");
    assert.equal(task.done, true);
    db.setComplete("2026-09-16", "prayer-fajr", true, "alone");
    assert.equal(
      db
        .getDay("2026-09-16")
        .filter((t) => t.done)
        .reduce((a, t) => a + t.score, 0),
      10,
    );
    const config = db
      .getDay("2026-09-16")
      .map((t) => ({ ...t, category: "Spiritualité" }));
    db.configure("2026-09-16", config);
    task = db.getDay("2026-09-16").find((t) => t.id === "prayer-fajr");
    assert.equal(task.prayerMode, "alone");
    assert.equal(task.category, "Spiritualité");
    task = db.getDay("2026-09-17").find((t) => t.id === "prayer-fajr");
    assert.equal(task.prayerMode, undefined);
    assert.ok(!task.done);
    db.setComplete("2026-09-16", "prayer-fajr", false);
    assert.equal(
      db.getDay("2026-09-16").find((t) => t.id === "prayer-fajr").prayerMode,
      undefined,
    );
    assert.throws(() => db.setComplete("2026-09-16", "prayer-fajr", true));
    assert.throws(() =>
      db.setComplete("2026-09-16", "prayer-fajr", true, "other"),
    );
    assert.throws(() => db.setComplete("2026-09-16", "a", true, "alone"));
    assert.throws(() =>
      db.configure("2026-09-16", [
        { id: "bad", name: "Bad", score: 10, category: "  " },
      ]),
    );
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("upgrade existing database once without changing historical data or duplicating prayers", () => {
  const dir = mkdtempSync(join(tmpdir(), "upgrade-"));
  const filename = join(dir, "test.sqlite");
  const legacy = new DatabaseSync(filename);
  const tasks = [{ id: "custom", name: "My task", score: 37, done: true }];
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  legacy.exec(
    "CREATE TABLE intentions (id INTEGER PRIMARY KEY, tasks TEXT NOT NULL); CREATE TABLE days (date TEXT PRIMARY KEY,tasks TEXT NOT NULL);",
  );
  legacy
    .prepare("INSERT INTO intentions VALUES(1,?)")
    .run(
      JSON.stringify(
        tasks.map((t) => ({ id: t.id, name: t.name, score: t.score })),
      ),
    );
  for (const date of ["2000-01-01", today])
    legacy
      .prepare("INSERT INTO days VALUES(?,?)")
      .run(date, JSON.stringify(tasks));
  legacy.close();
  let db = createStore(filename);
  try {
    assert.deepEqual(db.getDay("2000-01-01"), tasks);
    assert.equal(db.getDay(today).length, 6);
    assert.equal(db.getDay(today)[0].done, true);
    assert.equal(db.getDay(today)[0].score, 37);
    db.close();
    db = createStore(filename);
    assert.equal(db.getDay(today).length, 6);
    db.configure(today, []);
    db.close();
    db = createStore(filename);
    assert.deepEqual(db.getDay(today), []);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
