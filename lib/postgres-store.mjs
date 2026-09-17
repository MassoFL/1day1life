import {
  defaultTasks,
  validDate,
  validTasks,
  decodeTasks,
} from "./task-model.mjs";

// Kept in a private schema, outside Supabase's public Data API.
// No browser receives database credentials; requests remain password protected.
export function createPostgresStore(sql) {
  let ready;
  async function initialize() {
    if (!ready)
      ready = sql
        .begin(async (tx) => {
          // Serialize cold starts so schema creation and seeding are race-safe.
          await tx.unsafe("SELECT pg_advisory_xact_lock(178341, 1)");
          await tx.unsafe("CREATE SCHEMA IF NOT EXISTS oneday");
          await tx.unsafe("REVOKE ALL ON SCHEMA oneday FROM PUBLIC");
          await tx.unsafe(
            "CREATE TABLE IF NOT EXISTS oneday.intentions (id INTEGER PRIMARY KEY CHECK(id=1), tasks JSONB NOT NULL)",
          );
          await tx.unsafe(
            "CREATE TABLE IF NOT EXISTS oneday.days (date TEXT PRIMARY KEY, tasks JSONB NOT NULL)",
          );
          await tx.unsafe(
            "ALTER TABLE oneday.intentions ENABLE ROW LEVEL SECURITY",
          );
          await tx.unsafe("ALTER TABLE oneday.days ENABLE ROW LEVEL SECURITY");
          await tx.unsafe(
            "INSERT INTO oneday.intentions (id,tasks) VALUES (1,$1::text::jsonb) ON CONFLICT (id) DO NOTHING",
            [JSON.stringify(defaultTasks)],
          );
        })
        .catch((error) => {
          ready = undefined;
          throw error;
        });
    await ready;
  }
  async function withDay(date, action) {
    if (!validDate(date)) throw new Error("Invalid date");
    await initialize();
    return sql.begin(async (tx) => {
      // Consistent lock order prevents concurrent configuration/completion losses.
      const [template] = await tx.unsafe(
        "SELECT tasks FROM oneday.intentions WHERE id=1 FOR UPDATE",
      );
      const templateTasks = decodeTasks(template.tasks);
      if (typeof template.tasks === "string") {
        await tx.unsafe(
          "UPDATE oneday.intentions SET tasks=$1::text::jsonb WHERE id=1",
          [JSON.stringify(templateTasks)],
        );
      }
      await tx.unsafe(
        "INSERT INTO oneday.days (date,tasks) SELECT $1,tasks FROM oneday.intentions WHERE id=1 ON CONFLICT (date) DO NOTHING",
        [date],
      );
      const [row] = await tx.unsafe(
        "SELECT tasks FROM oneday.days WHERE date=$1 FOR UPDATE",
        [date],
      );
      const tasks = decodeTasks(row.tasks);
      if (typeof row.tasks === "string") {
        await tx.unsafe(
          "UPDATE oneday.days SET tasks=$1::text::jsonb WHERE date=$2",
          [JSON.stringify(tasks), date],
        );
      }
      return action(tx, tasks);
    });
  }
  return {
    async getDay(date) {
      return withDay(date, async (_tx, tasks) => tasks);
    },
    async setComplete(date, id, done, prayerMode) {
      if (typeof id !== "string" || typeof done !== "boolean")
        throw new Error("Invalid completion");
      return withDay(date, async (tx, tasks) => {
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
        await tx.unsafe(
          "UPDATE oneday.days SET tasks=$1::text::jsonb WHERE date=$2",
          [JSON.stringify(tasks), date],
        );
        return {
          id,
          done,
          ...(task.prayerMode ? { prayerMode: task.prayerMode } : {}),
        };
      });
    },
    async configure(date, tasks) {
      if (!validTasks(tasks) || !validDate(date))
        throw new Error("Invalid task configuration");
      return withDay(date, async (tx, old) => {
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
        await tx.unsafe(
          "UPDATE oneday.intentions SET tasks=$1::text::jsonb WHERE id=1",
          [JSON.stringify(clean)],
        );
        await tx.unsafe(
          "UPDATE oneday.days SET tasks=$1::text::jsonb WHERE date=$2",
          [JSON.stringify(today), date],
        );
        return today;
      });
    },
    async close() {
      await sql.end();
    },
  };
}
