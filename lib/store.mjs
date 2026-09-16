import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const defaultTasks = [
  { id: "a", name: "Move your body", score: 20 },
  { id: "b", name: "Make time for deep work", score: 30 },
  { id: "c", name: "Read a few pages", score: 15 },
  { id: "d", name: "Get outside", score: 15 },
  { id: "e", name: "Connect with someone", score: 10 },
  { id: "f", name: "Take a moment to reflect", score: 10 },
];
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
    tasks.length <= 30 &&
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
        t.score <= 1000,
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
    setComplete(date, id, done) {
      if (typeof id !== "string" || typeof done !== "boolean")
        throw new Error("Invalid completion");
      return transaction(() => {
        const tasks = getDay(date);
        const task = tasks.find((t) => t.id === id);
        if (!task) throw new Error("Task not found");
        task.done = done;
        db.prepare("UPDATE days SET tasks=? WHERE date=?").run(
          JSON.stringify(tasks),
          date,
        );
        return { id, done };
      });
    },
    configure(date, tasks) {
      if (!validTasks(tasks) || !validDate(date))
        throw new Error("Invalid task configuration");
      return transaction(() => {
        const old = getDay(date);
        const clean = tasks.map(({ id, name, score }) => ({
          id,
          name: name.trim(),
          score,
        }));
        const today = clean.map((t) => ({
          ...t,
          done: !!old.find((x) => x.id === t.id)?.done,
        }));
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
