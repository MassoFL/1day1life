import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { createPostgresStore } from "../lib/postgres-store.mjs";

// Execute the production SQL against an embedded PostgreSQL engine.
function driver(db) {
  const adapt = (client) => ({
    unsafe: async (query, args = []) => (await client.query(query, args)).rows,
  });
  return {
    begin: (fn) => db.transaction((tx) => fn(adapt(tx))),
    end: () => db.close(),
  };
}
test("PostgreSQL stores prayers and categories and keeps earlier days unchanged", async () => {
  const db = new PGlite();
  const sql = driver(db);
  const store = createPostgresStore(sql);
  try {
    const tasks = await store.getDay("2026-09-16");
    assert.equal(tasks.filter((t) => t.kind === "prayer").length, 5);
    await store.setComplete("2026-09-16", "prayer-fajr", true, "jamaah");
    const second = createPostgresStore(sql);
    assert.equal(
      (await second.getDay("2026-09-16")).find((t) => t.id === "prayer-fajr")
        .prayerMode,
      "jamaah",
    );
    await store.setComplete("2026-09-16", "prayer-fajr", true, "alone");
    assert.equal(
      (await store.getDay("2026-09-16"))
        .filter((t) => t.done)
        .reduce((n, t) => n + t.score, 0),
      10,
    );
    assert.ok(
      (await store.getDay("2026-09-17")).every((t) => !t.done && !t.prayerMode),
    );
    await store.setComplete("2026-09-17", "prayer-fajr", true, "jamaah");
    await store.configure("2026-09-17", [
      {
        id: "prayer-fajr",
        name: "Fajr",
        kind: "prayer",
        score: 25,
        category: "Prières",
      },
    ]);
    const updated = (await store.getDay("2026-09-17"))[0];
    assert.equal(updated.prayerMode, "jamaah");
    assert.equal(updated.score, 25);
    assert.equal(
      (await store.getDay("2026-09-16")).find((t) => t.id === "prayer-fajr")
        .score,
      10,
    );
    assert.equal((await store.getDay("2026-09-18"))[0].score, 25);
    await store.setComplete("2026-09-17", "prayer-fajr", false);
    assert.equal((await store.getDay("2026-09-17"))[0].prayerMode, undefined);
    await assert.rejects(
      store.setComplete("2026-09-17", "prayer-fajr", true),
      /Choose a prayer mode/,
    );
    await assert.rejects(
      store.setComplete("2026-09-17", "prayer-fajr", true, "invalid"),
      /Invalid prayer mode/,
    );
    await assert.rejects(
      store.configure("2026-09-17", [{ id: "bad", name: "Bad", score: -1 }]),
      /Invalid task configuration/,
    );
    await assert.rejects(store.getDay("2026-02-30"), /Invalid date/);
    await store.configure("2026-09-17", []);
    assert.deepEqual(await store.getDay("2026-09-17"), []);
    const tables = await db.query(
      "SELECT relname, relrowsecurity FROM pg_class WHERE relnamespace='oneday'::regnamespace AND relkind='r'",
    );
    assert.equal(tables.rows.length, 2);
    assert.ok(tables.rows.every((t) => t.relrowsecurity));
  } finally {
    await store.close();
  }
});
test("a failed initialization can retry instead of poisoning the instance", async () => {
  const db = new PGlite();
  const sql = driver(db);
  let fail = true;
  const store = createPostgresStore({
    ...sql,
    begin: (fn) => {
      if (fail) {
        fail = false;
        return Promise.reject(new Error("Temporary outage"));
      }
      return sql.begin(fn);
    },
  });
  try {
    await assert.rejects(store.getDay("2026-09-16"), /Temporary outage/);
    assert.equal((await store.getDay("2026-09-16")).length, 11);
  } finally {
    await store.close();
  }
});
