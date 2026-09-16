# 1day1life

> A life is somehow a day.

A minimal daily intention tracker. Check off tasks, see their individual points, and watch today's total grow.

- **Desktop:** track your day and configure recurring tasks and scores.
- **Mobile:** tracking only; configuration controls are not rendered.
- **Persistence:** Supabase PostgreSQL on Vercel; SQLite remains available for local development. Data is shared by devices using the same instance.
- **Daily reset:** the browser's local date selects a fresh checklist. Earlier days retain their task and score snapshots.

## Run locally

Requires Node.js 22.13 or later (Node 24 LTS recommended).

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Initial intentions are suggestions; customize them on desktop. This is a single-person application, not a multi-user service.

## Production

```sh
npm run build
npm start
```

Set `APP_PASSWORD` to a strong password before production startup. The browser login uses username **1day1life** and that password. Serve behind HTTPS. Production requests are blocked when the password is missing; development runs without a password unless configured.

### Vercel + Supabase

1. In Supabase **Connect**, select the PostgreSQL **Transaction pooler** connection string (port 6543).
2. Add it as `DATABASE_URL` in your Vercel project's environment variables for **Production**. Replace the password placeholder with your database password, URL-encoding special characters. Never commit this value or prefix it with `NEXT_PUBLIC_`.
3. Keep `APP_PASSWORD` configured. Redeploy after changing environment variables.

The server uses TLS with certificate verification and disables prepared statements for transaction-pooler compatibility. On the first request it creates `oneday.intentions` and `oneday.days` in a private schema and seeds the default tasks and five prayers. Use the project's database owner connection so it can create the schema. No manual SQL setup, browser API keys, or Supabase client configuration is required. Table row-level security is enabled; only the server database owner accesses data. Keep the `oneday` schema out of the Supabase Data API exposed schemas.

Vercel will never fall back to local SQLite if `DATABASE_URL` is missing. A failed remote connection also does not fall back. Preview deployments should use a separate Supabase database/project to avoid changing production data.

A newly connected Supabase database starts fresh. Existing local SQLite records are **not automatically copied** to Supabase; retain your local database backup if you have earlier data to migrate.

### Self-hosted / local SQLite

Without `DATABASE_URL`, non-Vercel installations use `DATABASE_PATH` (default `./data/1day1life.sqlite`). This needs a persistent writable volume and one Node server instance. SQLite is not used for storage on Vercel. GitHub Pages cannot run the backend.

Phone and computer must open the same server URL with the same credentials. No task data is stored in browser local storage. The app follows each device's local calendar date; keep devices in the same timezone to track the same day around midnight.

## Configuration behavior

Desktop configuration requires a viewport at least 900 pixels wide, a fine pointer, and a non-mobile user agent. Mobile user agents are also rejected by the configuration endpoint. This is an interface restriction, not device attestation: browsers can spoof their device identity.

Saving configuration updates today and future daily checklists while preserving completion for existing task IDs. Earlier daily snapshots are unchanged. Tasks can be added, edited, or removed; scores are integers from 1 to 1,000. Up to 50 daily intentions are supported.

Tasks are grouped by editable categories. Five prayers (Fajr, Dhuhr, Asr, Maghrib, Isha) are included in the Prières category, initially worth 10 points each. Selecting Fi jama3a or Seul completes a prayer; changing modes does not add extra points, and Annuler clears its completion and mode. Prayer modes reset each day. Desktop configuration can edit categories, scores and task types; mobile remains tracking-only.

Existing databases receive a one-time upgrade that adds the prayers and categorizes existing tasks as Général. Existing task scores and completion are preserved; snapshots before the server’s current date remain unchanged. Back up the SQLite database before deploying updates.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

PostgreSQL queries are tested using an embedded PostgreSQL engine (PGlite), without production credentials. Storage tests cover persistence after reopening the database, undo, daily reset, historical score preservation, empty lists, and input rejection. The app exposes an optional read-only `get_today_tasks` WebMCP tool when the browser supports it.

## Stack

Next.js App Router, React, TypeScript, Tailwind CSS, Shadcn primitives, Postgres.js for Supabase, and Node's built-in SQLite for local development. No dependency on Sites or Cloudflare.
