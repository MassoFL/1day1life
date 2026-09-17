import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { createStore } from "../lib/store.mjs";
import { createPostgresStore } from "../lib/postgres-store.mjs";
import { taskOptions, selectedOption } from "../lib/task-model.mjs";
for (const backend of ["sqlite", "postgres"]) {
  test(`${backend}: configurable options preserve selection by ID, reset daily, validate input and count once`, async () => {
    const db = backend === "postgres" ? new PGlite() : null;
    const store = db
      ? createPostgresStore({
          begin: (fn) =>
            db.transaction((tx) =>
              fn({ unsafe: async (q, a = []) => (await tx.query(q, a)).rows }),
            ),
          end: () => db.close(),
        })
      : createStore(":memory:");
    try {
      const task = {
        id: "exercise",
        name: "Sport",
        category: "Santé",
        score: 20,
        options: [
          { id: "run", label: "Course" },
          { id: "walk", label: "Marche" },
        ],
      };
      await store.configure("2026-09-17", [task]);
      await assert.rejects(
        async () => store.setComplete("2026-09-17", "exercise", true),
        /Choose a task option/,
      );
      await assert.rejects(
        async () =>
          store.setComplete("2026-09-17", "exercise", true, "invalid"),
        /Invalid task option/,
      );
      await store.setComplete("2026-09-17", "exercise", true, "run");
      await store.setComplete("2026-09-17", "exercise", true, "walk");
      let today = await store.getDay("2026-09-17");
      assert.equal(today[0].selectedOptionId, "walk");
      assert.equal(
        today.reduce((n, t) => n + (t.done ? t.score : 0), 0),
        20,
      );
      const renamed = {
        ...task,
        options: [
          { id: "walk", label: "À pied" },
          { id: "run", label: "Course" },
        ],
      };
      await store.configure("2026-09-17", [renamed]);
      today = await store.getDay("2026-09-17");
      assert.equal(today[0].done, true);
      assert.equal(selectedOption(today[0]), "walk");
      const next = await store.getDay("2026-09-18");
      assert.ok(!next[0].done);
      assert.equal(selectedOption(next[0]), undefined);
      await store.configure("2026-09-18", [
        { ...task, options: [{ id: "run", label: "Course" }] },
      ]);
      assert.equal(
        selectedOption((await store.getDay("2026-09-17"))[0]),
        "walk",
      );
      await store.configure("2026-09-17", [
        { ...task, options: [{ id: "run", label: "Course" }] },
      ]);
      assert.equal((await store.getDay("2026-09-17"))[0].done, false);
      await store.setComplete("2026-09-17", "exercise", true, "run");
      await store.setComplete("2026-09-17", "exercise", false);
      assert.equal(
        selectedOption((await store.getDay("2026-09-17"))[0]),
        undefined,
      );
      await assert.rejects(async () =>
        store.configure("2026-09-17", [
          { ...task, options: [{ id: "a", label: " " }] },
        ]),
      );
      await assert.rejects(async () =>
        store.configure("2026-09-17", [
          {
            ...task,
            options: [
              { id: "a", label: "Run" },
              { id: "b", label: " run " },
            ],
          },
        ]),
      );
      await store.configure("2026-09-17", [{ ...task, options: [] }]);
      await store.setComplete("2026-09-17", "exercise", true);
      assert.equal((await store.getDay("2026-09-17"))[0].done, true);
      assert.deepEqual(
        taskOptions({ kind: "prayer" }).map((o) => o.label),
        ["Fi jama3a", "Seul"],
      );
      assert.deepEqual(taskOptions({ kind: "prayer", options: [] }), []);
    } finally {
      await store.close();
    }
  });
}
