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
        (t.kind === undefined || ["task", "prayer"].includes(t.kind)),
    ) &&
    new Set(tasks.map((t) => t.id)).size === tasks.length
  );
}
