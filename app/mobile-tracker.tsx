"use client";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  taskOptions,
  selectedOption,
  optionScore,
  maximumScore,
  earnedScore,
} from "@/lib/task-model.mjs";
import { ChevronDown } from "lucide-react";
type Task = {
  id: string;
  name: string;
  score: number;
  done?: boolean;
  category?: string;
  kind?: "task" | "prayer";
  prayerMode?: "jamaah" | "alone";
  selectedOptionId?: string;
  options?: { id: string; label: string; score?: number }[];
};
type Props = {
  journal: ReactNode;
  tasks: Task[];
  loaded: boolean;
  busy: boolean;
  error: string;
  date: string;
  retry: () => Promise<void>;
  toggle: (
    id: string,
    done: boolean,
    optionId?: string,
  ) => Promise<boolean | undefined>;
};
export default function MobileTracker({
  journal,
  tasks,
  loaded,
  busy,
  error,
  date,
  retry,
  toggle,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [settling, setSettling] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const total = tasks.reduce((sum, t) => sum + maximumScore(t), 0);
  const earned = tasks.reduce((sum, t) => sum + earnedScore(t), 0);
  const ratio = total ? Math.min(1, Math.max(0, earned / total)) : 0;
  const remaining = tasks.filter((t) => !t.done || t.id === settling);
  const done = tasks.filter((t) => t.done && t.id !== settling);
  const locked = busy || !loaded || settling !== null;
  async function complete(t: Task, optionId?: string) {
    if (locked) return;
    setSettling(t.id);
    const saved = await toggle(t.id, true, optionId);
    if (!saved) {
      setSettling(null);
      return;
    }
    setExpanded(null);
    timer.current = setTimeout(
      () => {
        setSettling(null);
        timer.current = null;
      },
      matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 320,
    );
  }
  return (
    <div
      className="mobile-tracker"
      style={
        {
          "--day-green": `hsl(145 ${24 + ratio * 13}% ${97 - ratio * 36}%)`,
        } as CSSProperties
      }
    >
      <div className="mobile-day-top">
        <span className="mobile-wordmark">1day1life</span>
        <span aria-live="polite" className="mobile-score">
          {earned}
          <span> / {total} pts</span>
        </span>
      </div>
      <main className="mobile-list-main">
        <div className="mobile-list-title">
          <h1>Aujourd’hui</h1>
          <span>
            {date
              ? new Date(date + "T12:00:00").toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                })
              : ""}
          </span>
        </div>
        {error && (
          <div className="mobile-error" role="alert">
            {error}
            <button onClick={retry} disabled={busy}>
              Réessayer
            </button>
          </div>
        )}
        {!loaded && !error && (
          <p role="status" className="mobile-empty">
            Chargement…
          </p>
        )}
        <section
          className="mobile-bars"
          aria-label="Tâches à faire"
          aria-busy={busy}
        >
          {remaining.map((t) => {
            const options = taskOptions(t);
            return (
              <div
                key={t.id}
                className={
                  "mobile-task " + (t.done ? "mobile-task-completing" : "")
                }
              >
                <div className="mobile-bar">
                  <Checkbox
                    checked={!!t.done}
                    disabled={locked}
                    aria-label={"Valider " + t.name}
                    onCheckedChange={() =>
                      options.length
                        ? setExpanded(expanded === t.id ? null : t.id)
                        : void complete(t)
                    }
                  />
                  {options.length ? (
                    <button
                      className="mobile-task-name"
                      disabled={locked}
                      aria-expanded={expanded === t.id}
                      aria-controls={"options-" + t.id}
                      onClick={() =>
                        setExpanded(expanded === t.id ? null : t.id)
                      }
                    >
                      {t.name}
                      <ChevronDown
                        size={15}
                        className={expanded === t.id ? "rotated" : ""}
                      />
                    </button>
                  ) : (
                    <button
                      className="mobile-task-name"
                      disabled={locked}
                      onClick={() => complete(t)}
                    >
                      {t.name}
                    </button>
                  )}
                  <span className="mobile-task-score">
                    {t.done ? earnedScore(t) : maximumScore(t)}
                    <span> pts</span>
                  </span>
                </div>
                {options.length > 0 && expanded === t.id && !t.done && (
                  <div
                    id={"options-" + t.id}
                    className="mobile-task-options"
                    role="group"
                    aria-label={"Choisir une option pour " + t.name}
                  >
                    {options.map((o) => (
                      <button
                        disabled={locked}
                        key={o.id}
                        onClick={() => complete(t, o.id)}
                      >
                        <span>{o.label}</span>
                        <span>{optionScore(t, o)} pts</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>
        {loaded && remaining.length === 0 && (
          <p className="mobile-empty">
            {tasks.length
              ? "Tout est fait pour aujourd’hui."
              : "Ajoute tes tâches depuis un ordinateur."}
          </p>
        )}
        <section className="mobile-done" aria-label="Done">
          <h2>
            Done <span>{done.length}</span>
          </h2>
          <div className="mobile-bars">
            {done.map((t) => (
              <div className="mobile-task mobile-task-done" key={t.id}>
                <div className="mobile-bar">
                  <Checkbox
                    checked
                    disabled={locked}
                    aria-label={"Annuler " + t.name}
                    onCheckedChange={() => void toggle(t.id, false)}
                  />
                  <div className="mobile-done-name">
                    <span>{t.name}</span>
                    {selectedOption(t) && (
                      <small>
                        {
                          taskOptions(t).find((o) => o.id === selectedOption(t))
                            ?.label
                        }
                      </small>
                    )}
                  </div>
                  <span className="mobile-task-score">
                    {earnedScore(t)}
                    <span> pts</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
          {loaded && !done.length && (
            <p className="mobile-empty">
              Les tâches terminées apparaîtront ici.
            </p>
          )}
        </section>
        {journal}
        <span className="sr-only" role="status">
          {tasks.filter((t) => t.done).length} tâches terminées. {earned} points
          sur {total}.
        </span>
      </main>
    </div>
  );
}
