"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { decodeTasks, taskOptions, selectedOption } from "@/lib/task-model.mjs";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Sun,
  ArrowUpRight,
  Settings2,
  Plus,
  Trash2,
  Check,
} from "lucide-react";
type Task = {
  id: string;
  name: string;
  score: number;
  done?: boolean;
  category?: string;
  kind?: "task" | "prayer";
  prayerMode?: "jamaah" | "alone";
  options?: { id: string; label: string }[];
  selectedOptionId?: string;
};
function day() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(false),
    [draft, setDraft] = useState<Task[]>([]),
    [desktop, setDesktop] = useState(false),
    [date, setDate] = useState("");
  // Hydrate browser-local date and device capability after server rendering.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-local date must hydrate after SSR
    setDate(day());
    const m = matchMedia("(min-width: 900px) and (pointer: fine)");
    const change = () => {
      setDesktop(
        m.matches && !/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent),
      );
      if (!m.matches) setEditing(false);
    };
    change();
    m.addEventListener("change", change);
    const timer = setInterval(() => setDate(day()), 30000);
    return () => {
      m.removeEventListener("change", change);
      clearInterval(timer);
    };
  }, []);
  async function load() {
    setLoaded(false);
    try {
      const r = await fetch("/api/day?date=" + day());
      if (!r.ok) {
        const body = await r.json().catch(() => null);
        throw Error(
          body?.error || "Your day could not be loaded. Please try again.",
        );
      }
      setTasks(decodeTasks(await r.json()));
      setError("");
      setLoaded(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  // Fetch persisted data whenever the local calendar day changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronize persisted data with the selected day
    if (date) void load();
  }, [date]);
  async function toggle(id: string, done: boolean, optionId?: string) {
    if (busy || !loaded) return;
    setBusy(true);
    try {
      const r = await fetch("/api/day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: day(), id, done, optionId }),
      });
      if (!r.ok)
        throw Error("That check could not be saved. Please try again.");
      const result = await r.json();
      setTasks((t) =>
        t.map((x) =>
          x.id === id
            ? {
                ...x,
                done,
                selectedOptionId: result.selectedOptionId,
                prayerMode: result.prayerMode,
              }
            : x,
        ),
      );
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!desktop) return;
    setBusy(true);
    try {
      const r = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: draft, date: day() }),
      });
      if (!r.ok)
        throw Error(
          "Vérifie le nom, le type, le score et les options : chaque option doit avoir un nom différent (40 caractères maximum).",
        );
      setEditing(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: object,
            options: { signal: AbortSignal },
          ) => unknown;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: "get_today_tasks",
            description: "Read today’s tasks, completion and scores.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true },
            execute: async () => {
              const r = await fetch("/api/day?date=" + day());
              if (!r.ok) throw Error("Unable to load tasks");
              return r.json();
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, []);
  const total = tasks.reduce((a, t) => a + t.score, 0),
    earned = tasks.reduce((a, t) => a + (t.done ? t.score : 0), 0),
    count = tasks.filter((t) => t.done).length,
    percent = total ? (earned / total) * 100 : 0;
  return (
    <div className="app">
      <header>
        <Link className="brand" href="/">
          <span className="brandmark">1</span>1day
          <span className="brandlight">1life</span>
        </Link>
        <span className="header-note">A little intention. Every day.</span>
        <span className="today-tag">
          <Sun size={16} /> One day at a time
        </span>
      </header>
      <main>
        <div className="day-heading">
          <div>
            <div className="eyebrow">YOUR DAILY CHAPTER</div>
            <h1>
              Make today count<span>.</span>
            </h1>
            <p>
              {date
                ? new Date(date + "T12:00:00").toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Today"}
            </p>
          </div>
          <div className="day-stamp">
            <span>DAY</span>
            <strong>
              {date
                ? String(
                    Math.floor(
                      (new Date(date + "T12:00:00").getTime() -
                        new Date(
                          date.slice(0, 4) + "-01-01T12:00:00",
                        ).getTime()) /
                        86400000,
                    ) + 1,
                  ).padStart(3, "0")
                : "—"}
            </strong>
            <span>OF YOUR YEAR</span>
          </div>
        </div>
        <div className="workspace">
          <section className="task-panel">
            <div className="panel-heading">
              <div>
                <h2>{editing ? "Configurer les tâches" : "Tâches du jour"}</h2>
                <p>
                  {editing
                    ? "Choose the things that make a good day."
                    : "Small actions. A life well lived."}
                </p>
              </div>
              {desktop && (
                <button
                  className="configure"
                  onClick={() => {
                    setDraft(
                      tasks.map((t) => ({
                        ...t,
                        options: taskOptions(t).map((o) => ({ ...o })),
                      })),
                    );
                    setEditing(!editing);
                    setError("");
                  }}
                >
                  <Settings2 size={16} />
                  {editing ? "Retour" : "Configurer"}
                </button>
              )}
            </div>
            {error && (
              <div className="error" role="alert">
                {error} {!loaded && <button onClick={load}>Retry</button>}
              </div>
            )}
            {editing ? (
              <>
                <p className="edit-note">
                  Un nom, un type et un score. Ajoute des options seulement si
                  nécessaire. Une seule option sera choisie par tâche, sans
                  changer son score.
                </p>
                <datalist id="task-types">
                  {Array.from(
                    new Set([
                      "Prières",
                      "Santé",
                      "Travail",
                      "Apprentissage",
                      "Relations",
                      "Général",
                      ...draft.map((t) => t.category || "Général"),
                    ]),
                  ).map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                {draft.map((t, i) => (
                  <div className="task-editor" key={t.id}>
                    <div className="task-fields">
                      <label>
                        Nom
                        <input
                          aria-label={"Nom de la tâche " + (i + 1)}
                          maxLength={100}
                          value={t.name}
                          onChange={(e) =>
                            setDraft((d) =>
                              d.map((x) =>
                                x.id === t.id
                                  ? { ...x, name: e.target.value }
                                  : x,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        Type
                        <input
                          list="task-types"
                          maxLength={40}
                          value={t.category || ""}
                          onChange={(e) =>
                            setDraft((d) =>
                              d.map((x) =>
                                x.id === t.id
                                  ? { ...x, category: e.target.value }
                                  : x,
                              ),
                            )
                          }
                        />
                      </label>
                      <label>
                        Score
                        <input
                          type="number"
                          min="1"
                          max="1000"
                          value={t.score}
                          onChange={(e) =>
                            setDraft((d) =>
                              d.map((x) =>
                                x.id === t.id
                                  ? { ...x, score: Number(e.target.value) }
                                  : x,
                              ),
                            )
                          }
                        />
                      </label>
                      <button
                        aria-label={
                          "Supprimer " + (t.name || "la tâche " + (i + 1))
                        }
                        onClick={() =>
                          setDraft((d) => d.filter((x) => x.id !== t.id))
                        }
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                    <div className="option-editor">
                      {taskOptions(t).map((o) => (
                        <div className="option-input" key={o.id}>
                          <input
                            aria-label={"Option de " + t.name}
                            placeholder="Nom de l’option"
                            maxLength={40}
                            value={o.label}
                            onChange={(e) =>
                              setDraft((d) =>
                                d.map((x) =>
                                  x.id === t.id
                                    ? {
                                        ...x,
                                        options: taskOptions(x).map((v) =>
                                          v.id === o.id
                                            ? { ...v, label: e.target.value }
                                            : v,
                                        ),
                                      }
                                    : x,
                                ),
                              )
                            }
                          />
                          <button
                            aria-label={"Supprimer l’option " + o.label}
                            onClick={() =>
                              setDraft((d) =>
                                d.map((x) =>
                                  x.id === t.id
                                    ? {
                                        ...x,
                                        options: taskOptions(x).filter(
                                          (v) => v.id !== o.id,
                                        ),
                                      }
                                    : x,
                                ),
                              )
                            }
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        className="add-option"
                        disabled={taskOptions(t).length >= 10}
                        onClick={() =>
                          setDraft((d) =>
                            d.map((x) =>
                              x.id === t.id
                                ? {
                                    ...x,
                                    options: [
                                      ...taskOptions(x),
                                      { id: crypto.randomUUID(), label: "" },
                                    ],
                                  }
                                : x,
                            ),
                          )
                        }
                      >
                        <Plus size={14} /> Ajouter une option
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  className="add"
                  disabled={draft.length >= 50}
                  onClick={() =>
                    setDraft((d) => [
                      ...d,
                      {
                        id: crypto.randomUUID(),
                        name: "",
                        score: 10,
                        category: "Général",
                        kind: "task",
                        options: [],
                      },
                    ])
                  }
                >
                  <Plus size={17} /> Ajouter une tâche
                </button>
                <p className="edit-note">
                  Changes apply to today and future days. Previous days keep
                  their original scores.
                </p>
                <div className="edit-actions">
                  <button onClick={() => setEditing(false)}>Annuler</button>
                  <button className="primary" onClick={save} disabled={busy}>
                    Enregistrer
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="list-label">
                  <span>YOUR INTENTIONS</span>
                  <span>POINTS</span>
                </div>
                <div className="tasks" aria-busy={!loaded || busy}>
                  {Array.from(
                    new Set(tasks.map((t) => t.category || "Général")),
                  ).map((category) => (
                    <section
                      className="task-category"
                      key={category}
                      aria-label={category}
                    >
                      <h3 className="category-heading">
                        {category}
                        <span>
                          {
                            tasks.filter(
                              (t) =>
                                (t.category || "Général") === category &&
                                t.done,
                            ).length
                          }{" "}
                          /{" "}
                          {
                            tasks.filter(
                              (t) => (t.category || "Général") === category,
                            ).length
                          }
                        </span>
                      </h3>
                      {tasks
                        .filter((t) => (t.category || "Général") === category)
                        .map((t) =>
                          taskOptions(t).length > 0 ? (
                            <div
                              className={
                                "prayer-task " + (t.done ? "complete" : "")
                              }
                              key={t.id}
                            >
                              <div className="prayer-title">
                                <span className="task-name">{t.name}</span>
                                <span className="points">
                                  {t.done ? <Check size={13} /> : "+"}
                                  {t.score}
                                </span>
                              </div>
                              <div className="prayer-actions">
                                <div
                                  className="prayer-modes"
                                  role="group"
                                  aria-label={"Accomplir " + t.name}
                                >
                                  {taskOptions(t).map((o) => (
                                    <button
                                      key={o.id}
                                      disabled={!loaded || busy}
                                      aria-pressed={
                                        !!t.done && selectedOption(t) === o.id
                                      }
                                      onClick={() => toggle(t.id, true, o.id)}
                                    >
                                      {o.label}
                                    </button>
                                  ))}
                                </div>
                                {t.done && (
                                  <button
                                    className="undo-prayer"
                                    disabled={busy}
                                    aria-label={"Annuler " + t.name}
                                    onClick={() => toggle(t.id, false)}
                                  >
                                    Annuler
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            <label
                              className={"task " + (t.done ? "complete" : "")}
                              key={t.id}
                            >
                              <Checkbox
                                checked={!!t.done}
                                disabled={!loaded || busy}
                                onCheckedChange={(v) => toggle(t.id, !!v)}
                                aria-label={t.name}
                              />
                              <span className="task-name">{t.name}</span>
                              <span className="points">
                                {t.done ? <Check size={13} /> : <span>+</span>}
                                {t.score}
                              </span>
                            </label>
                          ),
                        )}
                    </section>
                  ))}
                </div>
                {tasks.length === 0 && (
                  <p className="empty">
                    A blank page for a new beginning. Open this app on your
                    computer to add your daily intentions.
                  </p>
                )}
                <div className="list-footer">
                  <span>
                    {loaded
                      ? `${count} of ${tasks.length} intentions complete`
                      : error
                        ? "Waiting to reconnect"
                        : "Loading your day…"}
                  </span>
                  <span>
                    Every little thing counts <ArrowUpRight size={14} />
                  </span>
                </div>
              </>
            )}
          </section>
          <aside>
            <div className="score-card">
              <div className="eyebrow">
                TODAY’S SCORE <Sun size={17} />
              </div>
              <div className="score-number" aria-live="polite">
                {earned}
                <span>/ {total}</span>
              </div>
              <Progress value={percent} className="score-progress" />
              <div className="score-caption">
                <span>{Math.round(percent)}% of your daily intention</span>
                <span>
                  {count === tasks.length && tasks.length
                    ? "Complete"
                    : "In progress"}
                </span>
              </div>
              <div className="score-message">
                <span className="mini-sun">✳</span>
                <h3>
                  {count === tasks.length && tasks.length
                    ? "A day well lived."
                    : count
                      ? "You’re showing up."
                      : "Your day is an open page."}
                </h3>
                <p>
                  {count === tasks.length && tasks.length
                    ? "Take a breath. You made time for what matters."
                    : count
                      ? "One small action at a time. Keep making room for what matters."
                      : "Start with one small intention. The rest will follow."}
                </p>
              </div>
            </div>
            <div className="philosophy">
              <span className="eyebrow">THE 1DAY1LIFE PHILOSOPHY</span>
              <blockquote>
                “A life is somehow
                <br />a day.”
              </blockquote>
              <p>The way we spend our days is the way we spend our lives.</p>
              <div className="line-symbol">—</div>
              <span>Be here. Do a little. Begin again.</span>
            </div>
          </aside>
        </div>
        <footer>
          <span>1 day. 1 life. A fresh start, every morning.</span>
          <span className="desktop-foot">Designed with intention</span>
          <span className="mobile-foot">
            Set up your intentions on a computer.
          </span>
        </footer>
      </main>
    </div>
  );
}
