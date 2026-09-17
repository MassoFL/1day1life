"use client";
import { useEffect, useState, useId } from "react";

export function useJournal(today: string) {
  const [chosenDate, setDate] = useState("");
  const date = chosenDate || today;
  const [record, setRecord] = useState({ date: "", text: "", saved: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [reload, setReload] = useState(0);
  const loaded = !!date && record.date === date;
  const dirty = loaded && record.text !== record.saved;
  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();
    fetch("/api/journal?date=" + date, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw Error("Impossible de charger le journal.");
        const body = await r.json();
        if (typeof body.text !== "string")
          throw Error("Réponse du journal invalide.");
        if (!controller.signal.aborted) {
          setRecord({ date, text: body.text, saved: body.text });
          setError("");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Impossible de charger le journal. Réessaie.");
      });
    return () => controller.abort();
  }, [date, reload]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function save() {
    if (!loaded || saving) return;
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/journal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, text: record.text }),
      });
      if (!r.ok) throw Error();
      setRecord((current) => ({ ...current, saved: record.text }));
    } catch {
      setError(
        "Le journal n’a pas été enregistré. Ton texte est conservé ici ; réessaie.",
      );
    } finally {
      setSaving(false);
    }
  }
  return {
    date,
    setDate,
    text: loaded ? record.text : "",
    setText: (text: string) => {
      // Pin this day while editing, including across midnight.
      setDate(date);
      setRecord((current) => ({ ...current, text }));
    },
    loaded,
    dirty,
    error,
    saving,
    save,
    retry: () => setReload((n) => n + 1),
  };
}

export function Journal({
  journal: j,
}: {
  journal: ReturnType<typeof useJournal>;
}) {
  const id = useId();
  return (
    <section className="daily-journal" aria-labelledby={id + "-title"}>
      <div className="journal-heading">
        <h2 id={id + "-title"}>Mon journal</h2>
        <input
          type="date"
          aria-label="Date du journal"
          value={j.date}
          disabled={j.dirty || j.saving}
          onChange={(e) => {
            if (e.target.value) j.setDate(e.target.value);
          }}
        />
      </div>
      <label className="sr-only" htmlFor={id}>
        Texte du journal
      </label>
      <textarea
        id={id}
        value={j.text}
        disabled={!j.loaded || j.saving}
        maxLength={20000}
        placeholder="Comment s’est passée ta journée ?"
        rows={5}
        onChange={(e) => j.setText(e.target.value)}
      />
      {j.error && (
        <p role="alert" className="journal-error">
          {j.error}
          {!j.loaded && <button onClick={j.retry}>Réessayer</button>}
        </p>
      )}
      <div className="journal-actions">
        <span role="status">
          {j.saving
            ? "Enregistrement…"
            : !j.loaded
              ? "Chargement…"
              : j.dirty
                ? "Modifications non enregistrées"
                : "Enregistré"}
        </span>
        <button onClick={j.save} disabled={!j.loaded || j.saving || !j.dirty}>
          Enregistrer
        </button>
      </div>
    </section>
  );
}
