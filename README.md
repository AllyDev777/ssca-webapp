# Weekly Spiritual Growth Assessment

A small, secure, mobile-first web app for the **Society of Saint Carlo Acutis**. Members tick off their spiritual
activities for the week, submit the week, and track their progress. Admins manage the activities and points and see
how everyone is doing.

- **Members:** This Week checklist (saves automatically), Submit Week, Dashboard (streak, average, 12-week chart),
  History.
- **Admins:** add/edit/reorder/deactivate/delete activities; members list with search, history, role changes and
  deactivation; overview dashboard; CSV export; reopen a week; audit log.
- **Stack:** Next.js 15 (App Router) · React 19 · TypeScript · MySQL 8 / MariaDB 10.4+ (raw SQL via `mysql2`) ·
  argon2id · zod · plain CSS Modules.

---

## Contents

1. [Requirements](#1-requirements)
2. [Local setup with XAMPP](#2-local-setup-with-xampp)
3. [Everyday commands](#3-everyday-commands)
4. [Production build](#4-production-build)
5. [Deploying to a Node host with remote MySQL](#5-deploying-to-a-node-host-with-remote-mysql)
6. [Configuration](#6-configuration)
7. [Maintenance](#7-maintenance)
8. [Security overview](#8-security-overview)
9. [Test checklist](#9-test-checklist)
10. [Troubleshooting](#10-troubleshooting)
11. [Project structure](#11-project-structure)

---

## 1. Requirements

| Tool | Version | Notes |
|---|---|---|
| Node.js | **20.12 or newer** (22 LTS recommended) | `node -v` to check |
| Database | **MySQL 8.0.16+** or **MariaDB 10.4+** | XAMPP ships MariaDB; both work |
| phpMyAdmin | any recent | comes with XAMPP |

> **Important:** this is a Node.js app. It is **not** served by Apache, so opening
> `http://localhost/ssca-webapp` will not work. XAMPP is only used for **MySQL** (and phpMyAdmin). The app runs on its
> own at **http://localhost:3000**.

---

## 2. Local setup with XAMPP

### 2.1 Start MySQL

Open the XAMPP Control Panel and start **MySQL**. Start **Apache** too if you want to use phpMyAdmin at
`http://localhost/phpmyadmin`.

### 2.2 Create the database and tables (phpMyAdmin)

1. **Databases** tab → create a database named **`ssca`**, collation **`utf8mb4_unicode_ci`**.
2. Click **`ssca`** in the left sidebar → **Import** tab → choose **`db/schema.sql`** → **Import**.
3. Still on `ssca` → **Import** → choose **`db/seed.sql`** → **Import**. This adds the 5 default activities.

Check: `ssca` should have 7 tables (`users`, `sessions`, `activities`, `weekly_assessments`, `assessment_items`,
`audit_log`, `rate_limits`), and `activities` should have 5 rows.

### 2.3 Create a least-privilege database user

The app must **not** connect as `root`. Create a user that can only read and write rows in `ssca`. It can't drop
tables, change the schema, or see other databases.

1. Open **`db/app-user.sql`** in an editor and replace `replace-with-a-long-random-password` with a long random
   password. You'll put the same password in `.env.local`.
2. In phpMyAdmin, open the **SQL** tab (top level, not inside a table), paste the edited file and click **Go**.

It runs:

```sql
CREATE USER IF NOT EXISTS 'ssca_app'@'localhost' IDENTIFIED BY '…your password…';
GRANT SELECT, INSERT, UPDATE, DELETE ON `ssca`.* TO 'ssca_app'@'localhost';
FLUSH PRIVILEGES;
```

<details>
<summary>Prefer clicking? Same thing through the phpMyAdmin UI</summary>

**User accounts** → **Add user account** → User name `ssca_app`, Host name `localhost`, set a password → leave
"Global privileges" **all unticked** → **Go**. Then **Edit privileges** for `ssca_app` → **Database** → choose `ssca`
→ tick only **SELECT, INSERT, UPDATE, DELETE** → **Go**.
</details>

### 2.4 Create `.env.local`

Copy `.env.example` to **`.env.local`** in the project folder and fill it in:

```ini
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=ssca_app
DB_PASSWORD=the-password-from-step-2.3
DB_NAME=ssca
DB_POOL_SIZE=10
SESSION_SECRET=paste-a-random-value-here
```

Generate `SESSION_SECRET` (it must be at least 32 characters):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

`.env.local` holds secrets. Never commit it or share it (it is already in `.gitignore`).

### 2.5 Install dependencies

```bash
npm install
```

> **Windows PowerShell says "running scripts is disabled"?** Run this once:
> `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`. Or use `npm.cmd` instead of `npm`, or use the
> Command Prompt or Git Bash terminal.

### 2.6 Create the first admin

```bash
npm run create-admin
```

The first run may ask to download `tsx` (a TypeScript runner); answer **y**. It asks for an email, a display name and a password. The password is hidden while you type (no `*` either), so just
type it and press **Enter**. No password is ever stored in a file.

> **Git Bash:** if it seems stuck at "Password:", press Ctrl+C and run `winpty npm.cmd run create-admin` instead
> (or run it from Command Prompt).

Running it again with an existing email offers to promote that account to admin and reset its password.

### 2.7 Run it

```bash
npm run dev
```

Open **http://localhost:3000** and sign in with the admin you just created. Members create their own accounts at
`/register`.

---

## 3. Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload at http://localhost:3000 |
| `npm run build` | Production build (type-checks and lints too) |
| `npm start` | Runs the production build (`PORT=8080 npm start` for another port) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no output files |
| `npm run create-admin` | Create or promote an admin from the terminal |

The little round **"N"** button in the corner during `npm run dev` is the Next.js developer tool. It only appears in
development, never in production.

---

## 4. Production build

```bash
npm run build
npm start          # listens on port 3000 by default
```

- **Stop `npm run dev` first**: both use the `.next` folder.
- In production the session cookies are `__Host-` prefixed and **Secure**, so the site **must be served over
  HTTPS**. Chrome and Firefox make an exception for `http://localhost`, so a local test of the production build works
  there. Safari does not.
- `NODE_ENV=production` (set automatically by `npm start`) also turns on HSTS and removes the extra permissions
  development needs from the content security policy.

**Prebuilt package (no build on the server).** Set `BUILD_STANDALONE=1` before `npm run build` to get
`.next/standalone/`, a self-contained server started with `node server.js`. Copy `.next/static` into
`.next/standalone/.next/static` and `public/` into `.next/standalone/public`. Native modules (`@node-rs/argon2`,
`sharp`) are platform-specific, so build on the same OS/CPU as the server, or replace them with the target's
packages (e.g. `@node-rs/argon2-linux-x64-gnu`, `@img/sharp-linux-x64`).

---

## 5. Deploying to a Node host with remote MySQL

Any host that runs a long-lived Node.js process works: a VPS (Ubuntu + nginx), Railway, Render, Fly.io, a cPanel
"Node.js app", and so on. Static-only hosting won't work, because the app needs a server.

### 5.1 Database

1. Create a MySQL 8 / MariaDB database (managed, or on the VPS).
2. Import `db/schema.sql`, then `db/seed.sql`.
3. Create the least-privilege user from `db/app-user.sql`. Replace `'localhost'` with the **app server's IP** (or
   `'%'` only if the provider firewalls the database), and use a long random password.
4. **Never expose port 3306 to the whole internet.** Allow only the app server's IP.
5. If the database is on another machine or network, ask your provider for TLS. To enable it, add an `ssl` option to
   the pool in `lib/db.ts` (e.g. `ssl: { ca: process.env.DB_CA }`).

### 5.2 App server

```bash
git clone … && cd ssca-webapp
npm ci
# create .env.local (or set the same variables in the host's dashboard)
npm run build
npm run create-admin      # once
npm start                 # keep it running with pm2 / systemd / the host's process manager
```

Example with **pm2**: `npx pm2 start npm --name ssca -- start`, then `npx pm2 save`.

### 5.3 Reverse proxy and HTTPS (nginx example)

Put nginx (or your host's proxy) in front of the app for HTTPS. **Pass the real client IP and the Host header.** The
rate limiter and audit log read `X-Real-IP`, and Server Actions compare `Origin` with `Host` to block cross-site
requests.

```nginx
server {
  listen 443 ssl http2;
  server_name ssca.example.org;
  # ssl_certificate / ssl_certificate_key … (e.g. from certbot)

  location / {
    proxy_pass         http://127.0.0.1:3000;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;   # overwrite, never pass through the client's value
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
  }
}
server { listen 80; server_name ssca.example.org; return 301 https://$host$request_uri; }
```

> Without a proxy that sets `X-Real-IP`, a client can claim any IP and get round the per-IP limits. Per-account
> lockout still applies either way.

### 5.4 Serving at `example.org/ssca` (no subdomain needed)

The app can live under a sub-path, alongside an existing website such as WordPress on the same domain.

1. Add this to the server's `.env.local` **before building**. Next.js reads that file both when you build and when you
   start, and the value must be the same both times:
   ```ini
   NEXT_PUBLIC_BASE_PATH=/ssca
   ```
2. `npm run build` and `npm start` as usual. The app answers only under `/ssca/…`, and everything else on the domain
   stays with the existing site.
3. Route `/ssca` to the Node app:
   - **cPanel "Setup Node.js App":** set *Application URL* to `example.org/ssca` and keep the app folder **outside**
     `public_html`. Don't delete the `.htaccess` cPanel creates for it.
   - **nginx:** `location /ssca { proxy_pass http://127.0.0.1:3000; … }` (same headers as 5.3). Don't strip the
     prefix; the app expects to receive `/ssca/…`.

Links, redirects, images, icons, the CSV export and the install manifest all pick up the prefix automatically.

> **Windows + Git Bash:** `NEXT_PUBLIC_BASE_PATH=/ssca npm run build` gets mangled into `C:/Program Files/Git/ssca`.
> Put the value in `.env.local` (recommended) or use PowerShell/CMD.

### 5.5 Checklist before going live

- [ ] HTTPS works and HTTP redirects to HTTPS
- [ ] App connects as `ssca_app`, **not** `root`; MySQL `root` has a password
- [ ] Port 3306 is not reachable from the internet
- [ ] `SESSION_SECRET` is a fresh random value (not the one from your laptop)
- [ ] `.env.local` is not in git
- [ ] Daily cleanup scheduled (see [Maintenance](#7-maintenance))
- [ ] Automatic, encrypted database backups
- [ ] Run `npm audit` and update dependencies from time to time

---

## 6. Configuration

| Setting | Where | Default |
|---|---|---|
| Week timezone | `lib/week.ts` → `TIMEZONE` | `Asia/Kolkata` (week = Mon 00:00 → Sun 23:59:59 IST) |
| Late submission window | `lib/week.ts` → `ALLOW_LATE_SUBMISSION_DAYS` | `0` (only the current week is editable) |
| Rate limits | `lib/rate-limit.ts` → `LIMITS` | login 5 / 15 min per IP+email · register 5 / hour per IP · saves 60 / min per user |
| Account lockout | `actions/auth.ts` | 15 min after 5 wrong passwords |
| Session length | `lib/session-cookie.ts` | 7 days, extended as you use it (sliding) |
| Default theme | `lib/theme.ts` | Light (users can pick Auto / Light / Dark) |
| Activities and points | Admin → Activities | the 5 seeded activities, max 12 pts |

All dates are stored in **UTC**; they are converted to IST only for display and for working out weeks.

---

## 7. Maintenance

**Cleanup (run daily).** Expired sessions and old rate-limit rows pile up. Run `db/cleanup.sql` from phpMyAdmin's SQL
tab, a cron job, or let MySQL do it on a schedule (instructions inside the file; needs an admin DB user, not
`ssca_app`):

```sql
DELETE FROM sessions    WHERE expires_at < UTC_TIMESTAMP();
DELETE FROM rate_limits WHERE reset_at  < UTC_TIMESTAMP();
```

**Audit log.** Every admin change (activities, roles, deactivations, reopened weeks, CSV exports) is written to
`audit_log` with who, what, when and the IP address. The latest entries show on the Admin overview.

**Locked out?** Wait 15 minutes, or in phpMyAdmin set `failed_logins = 0, locked_until = NULL` for that user.

**Forgot the admin password?** Run `npm run create-admin` with the same email and choose to reset it.

**Removing an activity** keeps history intact. If any week ever used the activity it is hidden, not deleted, and past
weeks keep showing it with the points they earned.

---

## 8. Security overview

- **Passwords:** argon2id (OWASP parameters), minimum 8 characters, common passwords rejected. Plain passwords are never
  stored or logged.
- **Sessions:** 32 random bytes per session; only the SHA-256 hash is stored. HttpOnly, Secure, SameSite=Lax
  `__Host-` cookies. A new token on every login, all sessions revoked on role change or deactivation, and logout
  deletes the row.
- **Authorization:** `requireUser()` / `requireAdmin()` run in every page, server action and route handler. The user id
  always comes from the session, never from the browser. Middleware also gates routes, but it is not the real check.
- **SQL:** parameterised queries only (`pool.execute` with `?`). Dynamic sort orders come from a fixed list.
- **Input:** zod validates every input; unknown fields are rejected and lengths match the database columns.
- **Totals:** always recomputed on the server inside a transaction. Submitting locks the week row
  (`SELECT … FOR UPDATE`).
- **Headers:** strict Content-Security-Policy with a per-request nonce (no inline scripts), `X-Frame-Options: DENY`,
  `nosniff`, `Referrer-Policy`, minimal `Permissions-Policy`, and HSTS in production.
- **CSRF:** Server Actions check `Origin` against `Host`, plus SameSite=Lax cookies.
- **Abuse:** database-backed rate limits on login, registration and every save; account lockout; generic
  "Invalid email or password" messages.
- **CSV:** cells starting with `= + - @` (or tab/CR) are prefixed with `'`, so spreadsheets can't run them as formulas.
- **Errors:** users see friendly messages; details go only to the server log.

---

## 9. Test checklist

Use two browsers (or one normal + one private window) so you can be an **admin** in one and a **member** in the
other. Ticks: ✅ = expected result.

### Must pass

| # | Test | How | Expected |
|---|---|---|---|
| 1 | **A member can't read another member's week** | As member A, open a past week from History and note the URL, e.g. `/history/2026-10-12`. Sign in as member B and open the **same URL**. | ✅ B sees **their own** week (or "Not submitted"), never A's. The URL only picks the week; the member always comes from the session. |
| 2 | **A member can't open admin pages** | As a member, visit `/admin`, `/admin/activities`, `/admin/members`. | ✅ Redirected to Home. No Admin tab is shown. |
| 3 | **A member can't call admin actions or the export** | As a member, visit `/api/admin/export?from=2026-01-01&to=2026-01-31`. | ✅ `{"error":"Forbidden"}` (signed out: `Unauthorized`). Admin server actions called by a member redirect without changing anything. |
| 4 | **Totals can't be forged** | Tick 2 activities and note the total. In phpMyAdmin compare `weekly_assessments.total_points` with the sum of `points_awarded` for completed items. | ✅ They match. The browser never sends a total; extra fields such as `total: 999` are rejected as "Invalid request". |
| 5 | **Past weeks are locked** | Open last week from History. | ✅ Read-only: every checkbox is disabled and there is no Submit button. Saving to a past week is refused ("This week is closed"). |
| 6 | **Submitted weeks are locked** | Submit this week, then refresh **This Week**. | ✅ "Submitted …" badge, read-only checklist. |
| 7 | **Changing points doesn't change past scores** | Member submits a week with **Attended Mass** ticked (2 pts). Admin → Activities → change Attended Mass to 4. | ✅ The member's submitted week still shows 2 pts for Mass and the same total. Current drafts show the new 4 pts. |

### Also worth checking

| # | Test | Expected |
|---|---|---|
| 8 | 6 wrong passwords for one account | First 5: "Invalid email or password". Then "Too many attempts… 15 minutes". |
| 9 | Register with the password `password123` | "That password is too common." |
| 10 | Delete an activity that was used in some week | "Removed. Past weeks still show it." It leaves the checklist, history keeps it. |
| 11 | Admin makes a member an admin | That member is signed out everywhere and gets the Admin tab after signing in again. |
| 12 | Admin deactivates a member | The member is signed out at once; signing in gives "Invalid email or password". |
| 13 | Admin reopens the member's current submitted week | The member can edit and must resubmit; an entry appears in "Recent admin activity". |
| 14 | Register a member named `=1+1`, then export CSV | The Name cell reads `'=1+1` (shown as text, not calculated). |
| 15 | Tick several boxes quickly, refresh | All ticks are kept ("Saved" toast). |
| 16 | Appearance → Dark, refresh | Stays dark, with no flash of light. |
| 17 | Keyboard only: Tab through This Week | Visible teal focus ring; Space ticks a row; the Submit sheet traps focus and Escape closes it. |

---

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| `http://localhost/ssca-webapp` shows a folder listing | Expected: Apache doesn't run this app. Use `npm run dev` → **http://localhost:3000**. |
| `npm : … running scripts is disabled` | See the PowerShell note in [2.5](#25-install-dependencies). |
| `create-admin` stuck at "Password:" in Git Bash | `winpty npm.cmd run create-admin`, or run it from Command Prompt. The password is meant to be invisible while you type. |
| `Access denied for user 'ssca_app'` | The password in `.env.local` doesn't match step 2.3, or the user's host isn't `localhost`. |
| `Missing environment variable DB_HOST` | `.env.local` is missing or in the wrong folder (it must sit next to `package.json`). Restart `npm run dev` after editing it. |
| Sign-in says "Something went wrong" (terminal: `SESSION_SECRET must be set…`) | Add a `SESSION_SECRET` of 32+ characters to `.env.local` and restart. |
| Admin is sent back to Home when opening `/admin` | `SESSION_SECRET` was changed since you signed in. Sign out and sign in again. |
| "Something went wrong" on every page | MySQL isn't running, or the DB settings are wrong. Check the terminal running the app for the real error. |
| Port 3000 already in use | Another `npm run dev` is running. Stop it, or use `npx next dev -p 3001`. |
| `npm run build` fails with file-in-use errors | Stop `npm run dev` first; both use `.next`. |
| Production build: can't stay signed in | Secure cookies need HTTPS (Safari won't accept them even on localhost). |

---

## 11. Project structure

```
app/
  (auth)/login, register        sign-in pages (+ theme switcher)
  (app)/                        signed-in member area: layout = tab bar + requireUser()
    page.tsx                    Dashboard
    week/                       This Week checklist (autosave + submit)
    history/, history/[weekStart]
  (admin)/admin/                admin area: layout = requireAdmin()
    page.tsx                    Overview, CSV export form, recent audit log
    activities/                 activity CRUD + reorder
    members/, members/[id]/, members/[id]/[weekStart]/
  api/admin/export/route.ts     streamed CSV (admin only)
  error.tsx, global-error.tsx, not-found.tsx, loading.tsx files
  globals.css                   design tokens, light/dark themes
actions/                        server actions: auth, week, admin
components/                     ChecklistRow, ProgressRing, StatTile, BottomSheet, TabBar, Toggle,
                                Segmented, BarChart, LineChart, ThemeSwitcher, icons.tsx, …
lib/
  db.ts                         mysql2 pool, query/execute/transaction helpers (server-only)
  auth.ts                       sessions, requireUser/requireAdmin (server-only)
  session-cookie.ts             cookie names + signed role hint (edge-safe, used by middleware)
  password.ts, password-rules.ts
  assessments.ts                week load/sync/totals
  history.ts, admin.ts          read models for dashboards and lists
  week.ts                       IST week maths and formatting
  rate-limit.ts, validation.ts, audit.ts, request.ts, theme.ts
middleware.ts                   route gating, CSP nonce, sliding cookie renewal
db/schema.sql, seed.sql, app-user.sql, cleanup.sql
scripts/create-admin.ts
```

### Performance notes

Every page is rendered on the server; only interactive parts (checklist, forms, sheets, theme switcher) ship
JavaScript. Our code adds about 0.1–11 kB (gzipped) per page on top of the ~103 kB that Next.js 15 + React 19 ship
to every page. CSS totals about 10 kB gzipped. Charts are hand-drawn SVG with no chart library.
