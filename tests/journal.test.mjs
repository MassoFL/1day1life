import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { createStore } from '../lib/store.mjs';
import { createPostgresStore } from '../lib/postgres-store.mjs';

for (const backend of ['sqlite', 'postgres']) {
  test(`${backend}: journal stays with its day and survives task updates`, async () => {
    let store;
    if (backend === 'sqlite') store = createStore(':memory:');
    else {
      const db = new PGlite();
      // Exercise the migration against a pre-journal database.
      await db.exec("CREATE SCHEMA oneday; CREATE TABLE oneday.days (date TEXT PRIMARY KEY, tasks JSONB NOT NULL)");
      store = createPostgresStore({
        begin: (fn) => db.transaction((tx) => fn({ unsafe: async (q, a = []) => (await tx.query(q, a)).rows })),
        end: () => db.close(),
      });
    }
    try {
      const date = '2026-09-17';
      assert.equal(await store.getJournal(date), '');
      const text = "Une belle journée.\nJ’ai appris quelque chose 🌿 <script>texte</script>";
      await store.setJournal(date, text);
      await store.setComplete(date, 'a', true);
      await store.configure(date, [{ id: 'a', name: 'Marcher', score: 20 }]);
      assert.equal(await store.getJournal(date), text);
      assert.equal(await store.getJournal('2026-09-18'), '');
      await store.setJournal('2026-09-18', 'Demain');
      assert.equal(await store.getJournal(date), text);
      assert.equal((await store.getDay(date))[0].done, true);
      for (const [d, t] of [['2026-02-30', 'x'], [date, null], [date, 'a'.repeat(20001)]]) {
        await assert.rejects(async () => store.setJournal(d, t));
      }
      assert.equal(await store.getJournal(date), text);
      await store.setJournal(date, '');
      assert.equal(await store.getJournal(date), '');
    } finally { await store.close(); }
  });
}
