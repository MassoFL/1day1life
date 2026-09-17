# 1day1life

> A life is somehow a day.

A minimal daily intention tracker. Check off tasks, see their individual points, and watch today's total grow.

- **Desktop:** track your day and configure recurring tasks and scores.
- **Mobile:** minimalist task bars with options revealed on demand. Completed tasks turn green and move into Done; unchecking returns them to the list. The background gradually becomes greener as earned points approach the maximum. Tracking only; configuration stays on desktop.
- **Persistence:** Supabase PostgreSQL on Vercel; SQLite remains available for local development. Data is shared by devices using the same instance.
- **Daily reset:** the browser's local date selects a fresh checklist. Earlier days retain their task and score snapshots.
- **Journal:** one text entry per date, available on mobile and desktop. Save with Enregistrer; use the journal date picker to read or edit earlier entries. Journal storage is added automatically to existing SQLite and Supabase databases without changing tasks or scores.

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

The app opens without a password. Anyone with the URL can view and track the shared day, and configure tasks from a desktop. Serve behind HTTPS.

### Vercel + Supabase

1. In Supabase **Connect**, select the PostgreSQL **Transaction pooler** connection string (port 6543).
2. Add it as `DATABASE_URL` in your Vercel project's environment variables for **Production**. Replace the password placeholder with your database password, URL-encoding special characters. Never commit this value or prefix it with `NEXT_PUBLIC_`.
3. In Supabase **Database Settings → SSL Configuration**, download the CA certificate. In Vercel add `DATABASE_CA_CERT` containing the complete PEM text, including `-----BEGIN CERTIFICATE-----` and `-----END CERTIFICATE-----`. Paste actual line breaks or literal `\n` separators, without surrounding quotes. This supplies the trusted CA when the runtime does not already trust Supabase’s certificate chain.
4. Redeploy after changing environment variables. `APP_PASSWORD` is no longer used and can be removed from Vercel.

The server uses TLS with certificate verification and disables prepared statements for transaction-pooler compatibility. On the first request it creates `oneday.intentions` and `oneday.days` in a private schema and seeds the default tasks and five prayers. Use the project's database owner connection so it can create the schema. No manual SQL setup, browser API keys, or Supabase client configuration is required. Table row-level security is enabled; only the server database owner accesses data. Keep the `oneday` schema out of the Supabase Data API exposed schemas.

Vercel will never fall back to local SQLite if `DATABASE_URL` is missing. A failed remote connection also does not fall back. Preview deployments should use a separate Supabase database/project to avoid changing production data.

A newly connected Supabase database starts fresh. Existing local SQLite records are **not automatically copied** to Supabase; retain your local database backup if you have earlier data to migrate.

### Self-hosted / local SQLite

Without `DATABASE_URL`, non-Vercel installations use `DATABASE_PATH` (default `./data/1day1life.sqlite`). This needs a persistent writable volume and one Node server instance. SQLite is not used for storage on Vercel. GitHub Pages cannot run the backend.

Phone and computer must open the same server URL with the same credentials. No task data is stored in browser local storage. The app follows each device's local calendar date; keep devices in the same timezone to track the same day around midnight.

## Configuration behavior

Desktop configuration requires a viewport at least 900 pixels wide, a fine pointer, and a non-mobile user agent. Mobile user agents are also rejected by the configuration endpoint. This is an interface restriction, not device attestation: browsers can spoof their device identity.

Saving configuration updates today and future daily checklists while preserving completion for existing task IDs. Earlier daily snapshots are unchanged. Tasks can be added, edited, or removed; scores are integers from 1 to 1,000. Up to 50 daily intentions are supported.

Each task has a name, a type (used to group the checklist), a score, and optional choices. The desktop editor offers add, rename, and remove controls for up to 10 unique options per task. Each option has its own integer score from 0 to 1,000. Choosing one option completes the task and earns that option’s score, replacing the base task score. Switching options replaces the earned points rather than accumulating them. The daily maximum sums the highest available option score per task; tasks without options use their base score. Legacy options without a score inherit the task’s original score, preserving history. Tasks without options use a checkbox. Removing the selected option from today’s configuration clears that completion so a valid choice can be made; earlier days are unchanged. Five prayers (Fajr, Dhuhr, Asr, Maghrib, Isha) are included in the Prières category, initially worth 10 points each. Selecting Fi jama3a or Seul completes a prayer; changing modes replaces the points with the selected option’s configured score, and Annuler clears its completion and mode. Prayer modes reset each day. Desktop configuration edits names, types, scores and options; mobile remains tracking-only. Existing prayer choices are preserved automatically.

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
