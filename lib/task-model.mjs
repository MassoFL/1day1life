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
export function upgradeTasks(tasks) {
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
        (t.kind === undefined || ["task", "prayer"].includes(t.kind)) &&
        (t.options === undefined || validOptions(t.options)),
    ) &&
    new Set(tasks.map((t) => t.id)).size === tasks.length
  );
}

// Recover records double-encoded by the previous PostgreSQL JSONB binding.
export function decodeTasks(value) {
  let tasks = value;
  try {
    if (typeof tasks === "string") tasks = JSON.parse(tasks);
  } catch {
    throw new Error("Invalid stored task list");
  }
  if (
    !validTasks(tasks) ||
    tasks.some(
      (t) =>
        (t.done !== undefined && typeof t.done !== "boolean") ||
        (t.selectedOptionId !== undefined &&
          typeof t.selectedOptionId !== "string") ||
        (t.prayerMode !== undefined &&
          !["jamaah", "alone"].includes(t.prayerMode)),
    )
  )
    throw new Error("Invalid stored task list");
  return tasks;
}

const prayerOptions = [
  { id: "jamaah", label: "Fi jama3a" },
  { id: "alone", label: "Seul" },
];
/** @returns {Array<{id: string, label: string}>} */
export function taskOptions(task) {
  return task.options ?? (task.kind === "prayer" ? prayerOptions : []);
}
export function selectedOption(task) {
  return task.selectedOptionId ?? task.prayerMode;
}
export function validOptions(options) {
  return (
    Array.isArray(options) &&
    options.length <= 10 &&
    options.every(
      (o) =>
        o &&
        typeof o.id === "string" &&
        o.id.length > 0 &&
        o.id.length <= 100 &&
        typeof o.label === "string" &&
        o.label.trim().length > 0 &&
        o.label.length <= 40,
    ) &&
    new Set(options.map((o) => o.id)).size === options.length &&
    new Set(options.map((o) => o.label.trim().toLowerCase())).size ===
      options.length
  );
}
export function completeTask(task, done, optionId) {
  const options = taskOptions(task);
  if (optionId !== undefined && !options.some((o) => o.id === optionId))
    throw new Error("Invalid task option");
  if (done && options.length && !options.some((o) => o.id === optionId))
    throw new Error("Choose a task option");
  task.done = done;
  delete task.selectedOptionId;
  delete task.prayerMode;
  if (done && options.length) {
    if (task.options !== undefined || task.kind !== "prayer")
      task.selectedOptionId = optionId;
    if (task.kind === "prayer" && ["jamaah", "alone"].includes(optionId))
      task.prayerMode = optionId;
  }
  return {
    id: task.id,
    done,
    ...(task.selectedOptionId
      ? { selectedOptionId: task.selectedOptionId }
      : {}),
    ...(task.prayerMode ? { prayerMode: task.prayerMode } : {}),
  };
}
export function configureTasks(tasks, old) {
  const clean = tasks.map(({ id, name, score, category, kind, options }) => ({
    id,
    name: name.trim(),
    score,
    category: category?.trim() || "Général",
    kind: kind || "task",
    ...(options !== undefined
      ? { options: options.map((o) => ({ id: o.id, label: o.label.trim() })) }
      : {}),
  }));
  const today = clean.map((t) => {
    const previous = old.find((x) => x.id === t.id);
    const choice = previous ? selectedOption(previous) : undefined;
    const options = taskOptions(t);
    const done =
      !!previous?.done &&
      (!options.length || options.some((o) => o.id === choice));
    const task = { ...t };
    completeTask(task, done, done && options.length ? choice : undefined);
    return task;
  });
  return { clean, today };
}
