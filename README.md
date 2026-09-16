# 1day1life

> A life is somehow a day.

A minimal daily intention tracker. Check off tasks, see their individual points, and watch today's total grow.

- **Desktop:** track your day and configure recurring tasks and scores.
- **Mobile:** tracking only; configuration controls are not rendered.
- **Persistence:** SQLite on the server, shared by all devices using this private instance.
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

Set `DATABASE_PATH` to a file on a persistent writable volume (default `./data/1day1life.sqlite`). Run one application instance on a Node server or container. Serverless deployments with ephemeral filesystems and GitHub Pages are not supported. GitHub hosts the source; the application requires a running Node server. SQLite is built into Node; some Node versions display an experimental warning.

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

Storage tests cover persistence after reopening the database, undo, daily reset, historical score preservation, empty lists, and input rejection. The app exposes an optional read-only `get_today_tasks` WebMCP tool when the browser supports it.

## Stack

Next.js App Router, React, TypeScript, Tailwind CSS, Shadcn primitives, and Node's built-in SQLite. No dependency on Sites or Cloudflare.
