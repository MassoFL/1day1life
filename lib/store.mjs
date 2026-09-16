import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const prayerTasks = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"].map(
  (name) => ({
    id: `prayer-${name.toLowerCase()}`,
    name,
    score: 10,
    category: "Prières",
    kind: "prayer",
  }),
);
export const defaultTasks = [
  {
    id: "a",
    name: "Move your body",
    score: 20,
    category: "Santé",
    kind: "task",
  },
  {
    id: "b",
    name: "Make time for deep work",
    score: 30,
    category: "Travail",
    kind: "task",
  },
  {
    id: "c",
    name: "Read a few pages",
    score: 15,
    category: "Apprentissage",
    kind: "task",
  },
  { id: "d", name: "Get outside", score: 15, category: "Santé", kind: "task" },
  {
    id: "e",
    name: "Connect with someone",
    score: 10,
    category: "Relations",
    kind: "task",
  },
  {
    id: "f",
    name: "Take a moment to reflect",
    score: 10,
    category: "Bien-être",
    kind: "task",
  },
  ...prayerTasks,
];
function upgradeTasks(tasks) {
  const result = tasks.map((t) => ({
    ...t,
    category: t.category || "Général",
    kind: t.kind || "task",
  }));
  for (const prayer of prayerTasks) {
    const existing = result.find(
      (t) =>
        t.id === prayer.id ||
        t.name.trim().toLowerCase() === prayer.name.toLowerCase(),
    );
    if (existing) {
      existing.kind = "prayer";
      existing.category = "Prières";
    } else result.push({ ...prayer });
  }
  return result;
}
export function validDate(date) {
  return (
    typeof date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !isNaN(Date.parse(date + "T12:00:00Z")) &&
    new Date(date + "T12:00:00Z").toISOString().slice(0, 10) === date
  );
}
export function validTasks(tasks) {
  return (
    Array.isArray(tasks) &&
    tasks.length <= 50 &&
    tasks.every(
      (t) =>
        t &&
        typeof t.id === "string" &&
        t.id.length > 0 &&
        t.id.length <= 100 &&
        typeof t.name === "string" &&
        t.name.trim().length > 0 &&
        t.name.length <= 100 &&
        Number.isInteger(t.score) &&
        t.score >= 1 &&
        t.score <= 1000 &&
        (t.category === undefined ||
          (typeof t.category === "string" &&
            t.category.trim().length > 0 &&
            t.category.length <= 40)) &&
        (t.kind === undefined || ["task", "prayer"].includes(t.kind)),
    ) &&
    new Set(tasks.map((t) => t.id)).size === tasks.length
  );
}
export function createStore(filename) {
  if (filename !== ":memory:")
    mkdirSync(dirname(resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS intentions (id INTEGER PRIMARY KEY CHECK(id=1), tasks TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS days (date TEXT PRIMARY KEY, tasks TEXT NOT NULL);`);
  db.prepare("INSERT OR IGNORE INTO intentions (id,tasks) VALUES (1,?)").run(
    JSON.stringify(defaultTasks),
  );
  // One-time data upgrade: retain past snapshots and the user's existing tasks/scores.
  db.exec("CREATE TABLE IF NOT EXISTS app_migrations (id TEXT PRIMARY KEY)");
  transaction(() => {
    if (
      db
        .prepare("SELECT id FROM app_migrations WHERE id=?")
        .get("categories-prayers-v1")
    )
      return;
    const template = JSON.parse(
      db.prepare("SELECT tasks FROM intentions WHERE id=1").get().tasks,
    );
    db.prepare("UPDATE intentions SET tasks=? WHERE id=1").run(
      JSON.stringify(upgradeTasks(template)),
    );
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    for (const row of db
      .prepare("SELECT date,tasks FROM days WHERE date>=?")
      .all(today)) {
      db.prepare("UPDATE days SET tasks=? WHERE date=?").run(
        JSON.stringify(upgradeTasks(JSON.parse(row.tasks))),
        row.date,
      );
    }
    db.prepare("INSERT INTO app_migrations (id) VALUES (?)").run(
      "categories-prayers-v1",
    );
  });
  function getDay(date) {
    if (!validDate(date)) throw new Error("Invalid date");
    db.prepare(
      "INSERT OR IGNORE INTO days (date,tasks) SELECT ?,tasks FROM intentions WHERE id=1",
    ).run(date);
    return JSON.parse(
      db.prepare("SELECT tasks FROM days WHERE date=?").get(date).tasks,
    );
  }
  function transaction(fn) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  return {
    getDay,
    setComplete(date, id, done, prayerMode) {
      if (typeof id !== "string" || typeof done !== "boolean")
        throw new Error("Invalid completion");
      return transaction(() => {
        const tasks = getDay(date);
        const task = tasks.find((t) => t.id === id);
        if (!task) throw new Error("Task not found");
        if (
          prayerMode !== undefined &&
          !["jamaah", "alone"].includes(prayerMode)
        )
          throw new Error("Invalid prayer mode");
        if (task.kind !== "prayer" && prayerMode !== undefined)
          throw new Error("Invalid prayer mode");
        if (
          task.kind === "prayer" &&
          done &&
          !["jamaah", "alone"].includes(prayerMode)
        )
          throw new Error("Choose a prayer mode");
        task.done = done;
        if (task.kind === "prayer" && done) task.prayerMode = prayerMode;
        else delete task.prayerMode;
        db.prepare("UPDATE days SET tasks=? WHERE date=?").run(
          JSON.stringify(tasks),
          date,
        );
        return {
          id,
          done,
          ...(task.prayerMode ? { prayerMode: task.prayerMode } : {}),
        };
      });
    },
    configure(date, tasks) {
      if (!validTasks(tasks) || !validDate(date))
        throw new Error("Invalid task configuration");
      return transaction(() => {
        const old = getDay(date);
        const clean = tasks.map(({ id, name, score, category, kind }) => ({
          id,
          name: name.trim(),
          score,
          category: category?.trim() || "Général",
          kind: kind || "task",
        }));
        const today = clean.map((t) => {
          const previous = old.find((x) => x.id === t.id);
          const mode = previous?.prayerMode;
          const done =
            !!previous?.done &&
            (t.kind !== "prayer" || ["jamaah", "alone"].includes(mode));
          return {
            ...t,
            done,
            ...(t.kind === "prayer" && done ? { prayerMode: mode } : {}),
          };
        });
        db.prepare("UPDATE intentions SET tasks=? WHERE id=1").run(
          JSON.stringify(clean),
        );
        db.prepare("UPDATE days SET tasks=? WHERE date=?").run(
          JSON.stringify(today),
          date,
        );
        return today;
      });
    },
    close() {
      db.close();
    },
  };
}
let instance;
export function store() {
  return (instance ??= createStore(
    process.env.DATABASE_PATH || "./data/1day1life.sqlite",
  ));
}
