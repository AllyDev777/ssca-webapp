# Project: Weekly Spiritual Growth Assessment — Society of Saint Carlo Acutis

You are building a production-ready, lightweight, secure, mobile-first web app where members log in, tick off their spiritual activities for the current week, submit the week, and track their progress over time. Administrators manage activities/points and view overall progress.

Read this whole file before writing code. Follow it exactly unless something is technically impossible — if so, say why and propose the closest alternative.

---

## 1. Tech Stack (fixed — do not substitute)

| Layer | Choice |
|---|---|
| Framework | **Next.js 15 (App Router)** + **React 19**, TypeScript (strict) |
| Database | **MySQL 8** (managed via phpMyAdmin) |
| DB driver | **mysql2/promise** with a connection pool — **raw parameterized SQL only, no ORM** |
| Auth | Custom session auth: **argon2id** (`@node-rs/argon2`) password hashing + **opaque session tokens stored hashed in DB**, delivered as `HttpOnly; Secure; SameSite=Lax` cookie |
| Validation | **zod** on every server action / route handler input |
| Styling | **Plain CSS with CSS Modules + one `globals.css` of design tokens**. No Tailwind, no UI kits, no CSS-in-JS, no icon fonts |
| Icons | Inline SVGs (small hand-written set in `components/icons.tsx`) |
| Charts | Hand-rolled SVG (bar/line) — **no chart library** |
| Dates | Native `Intl` + small helpers. No moment/dayjs |

**Allowed dependencies (total):** `next`, `react`, `react-dom`, `mysql2`, `zod`, `@node-rs/argon2`, `server-only`. Dev: `typescript`, `@types/*`, `eslint`, `eslint-config-next`. Ask before adding anything else.

Performance budget: first-load JS per route **< 100 KB gzipped**, total CSS **< 20 KB**. Prefer **React Server Components** everywhere; use `"use client"` only for interactive leaves (checklist toggles, forms, modals).

---

## 2. Functional Requirements

### 2.1 Default activities (seed data)
| # | Activity | Points |
|---|---|---|
| 1 | Attended Mass | 2 |
| 2 | Shared Post with 3 Groups/Forwards | 1 |
| 3 | Reflected on Bible Verse at 10 AM | 2 |
| 4 | Created one article/blog on St. Carlo | 2 |
| 5 | Led the 12 PM Meet and talked on any topic | 5 |

Max weekly total with defaults = **12**. Always compute max dynamically from active activities.

### 2.2 Member features
- Register / log in / log out.
- **This Week** screen: each active activity shown as a separate iOS-style checklist row (title, description, points pill, toggle/checkmark).
- Toggling marks completed / not completed; state **autosaves as a draft** (optimistic UI, debounced server action).
- Live total: "8 / 12 pts" with a circular progress ring.
- **Submit Week** button → confirmation sheet → locks the week. After submission the checklist is read-only.
- **History** screen: list of previous weeks (week range, score, % of max, submitted date); tap to see details of that week.
- **Dashboard** (home): completed vs pending activities this week, total weekly points, current streak (consecutive submitted weeks), average score, and a progress-history chart (last 12 weeks).

### 2.3 Admin features
- Activities management: **add, edit (title, description, points, sort order), activate/deactivate, delete**.
  - If an activity already has historical entries, "delete" becomes **soft delete** (`is_active = 0`, `deleted_at` set) so history stays intact.
- Points changes apply **only to current & future weeks**. Past submissions keep the points they were awarded (snapshot — see schema).
- Overview dashboard: number of members, submission rate this week, average score this week, top members this week, per-activity completion rate, weekly trend chart.
- Members list: search, view any member's history (read-only), change role (member/admin), deactivate account.
- Export selected week (or range) to **CSV** (generated server-side, streamed).
- Optional: admin can reopen a member's submitted week (audit-logged).

### 2.4 Week rules
- Timezone: **Asia/Kolkata**. Week = **Monday 00:00 → Sunday 23:59:59** IST. Store `week_start` as a `DATE` (the Monday).
- One assessment per user per week (unique constraint).
- Members can only edit the **current** week. Unsubmitted past weeks auto-lock (show as "Not submitted" with their draft score, or 0 if none). Make this a config constant `ALLOW_LATE_SUBMISSION_DAYS = 0`.

### 2.5 Access control
- Member: only their own records. Every query that touches user data **must filter by `session.userId` on the server** — never trust a userId from the client.
- Admin: everything above plus admin routes.
- Enforce roles in **both** `middleware.ts` (route gating) **and** inside each server action / route handler / data function (real authorization). Middleware alone is not security.

---

## 3. Database (MySQL 8, InnoDB, utf8mb4)

Produce `db/schema.sql` (importable via phpMyAdmin → Import) and `db/seed.sql`. Use this as the baseline:

```sql
CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('member','admin') NOT NULL DEFAULT 'member',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  failed_logins SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE sessions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,          -- SHA-256 of random 32-byte token
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX (user_id), INDEX (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE activities (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  description VARCHAR(500) NULL,
  points TINYINT UNSIGNED NOT NULL CHECK (points BETWEEN 0 AND 100),
  sort_order SMALLINT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE weekly_assessments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  week_start DATE NOT NULL,                      -- Monday (IST)
  status ENUM('draft','submitted') NOT NULL DEFAULT 'draft',
  total_points SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  max_points SMALLINT UNSIGNED NOT NULL DEFAULT 0,   -- snapshot at submit
  submitted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_week (user_id, week_start),
  INDEX (week_start, status),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE assessment_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  assessment_id INT UNSIGNED NOT NULL,
  activity_id INT UNSIGNED NOT NULL,
  activity_title VARCHAR(150) NOT NULL,          -- snapshot
  points_awarded TINYINT UNSIGNED NOT NULL,      -- snapshot of points at time of completion
  completed TINYINT(1) NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_assessment_activity (assessment_id, activity_id),
  FOREIGN KEY (assessment_id) REFERENCES weekly_assessments(id) ON DELETE CASCADE,
  FOREIGN KEY (activity_id) REFERENCES activities(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE audit_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_id INT UNSIGNED NULL,
  action VARCHAR(60) NOT NULL,                   -- e.g. activity.update, week.reopen, user.role_change
  entity VARCHAR(40) NOT NULL,
  entity_id INT UNSIGNED NULL,
  details JSON NULL,
  ip VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX (actor_id), INDEX (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE rate_limits (
  bucket VARCHAR(120) PRIMARY KEY,               -- e.g. login:ip:1.2.3.4
  hits INT UNSIGNED NOT NULL,
  reset_at DATETIME NOT NULL
) ENGINE=InnoDB;
```

Rules:
- **Totals are always recomputed on the server** from `assessment_items` (`SUM(points_awarded WHERE completed=1)`) inside a transaction — never accept a total from the client.
- Submission runs in a single transaction with `SELECT … FOR UPDATE` on the assessment row.
- Seed: the 5 activities above + one admin. **Do not hardcode an admin password** — provide `scripts/create-admin.ts` (run with `npx tsx`) that prompts for email/password and inserts a hashed admin.
- Store all `DATETIME` in UTC; convert to IST only for display/week calculation.
- Add a cleanup query (documented) for expired sessions and stale rate-limit rows.

---

## 4. Security (non-negotiable)

1. **SQL injection:** only `pool.execute(sql, params)` with placeholders. No string-concatenated SQL anywhere. Whitelist any dynamic `ORDER BY` columns.
2. **Passwords:** argon2id, min length 8, check against a tiny common-password list. Never log passwords or tokens.
3. **Sessions:** 32 random bytes (`crypto.randomBytes`), store only SHA-256 hash; cookie `__Host-session`, `HttpOnly`, `Secure` (in prod), `SameSite=Lax`, `Path=/`, 7-day expiry with sliding renewal. Rotate token on login and on role change. Logout deletes the DB row.
4. **CSRF:** Server Actions' built-in origin check + `SameSite=Lax`; for any route handler that mutates, verify `Origin` header matches the host.
5. **Rate limiting** (DB-backed `rate_limits` table): login 5/15 min per IP+email, register 5/hour per IP, mutations 60/min per user. Account lockout 15 min after 5 failed logins. Generic error messages ("Invalid email or password").
6. **Authorization:** central `requireUser()` / `requireAdmin()` helpers in `lib/auth.ts` (marked `server-only`), called at the top of every server action, route handler and data loader.
7. **Validation:** zod schemas for every input; reject unknown keys; cap string lengths to match DB columns.
8. **Headers** (set in `next.config.ts` / middleware): strict CSP with nonces (no `unsafe-inline` scripts), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimal, HSTS in production.
9. **Secrets** only in `.env.local` (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `SESSION_SECRET` if used). Provide `.env.example`. Use a **least-privilege MySQL user** (SELECT/INSERT/UPDATE/DELETE only on this DB) — document how to create it in phpMyAdmin.
10. **Output:** rely on React escaping; never use `dangerouslySetInnerHTML`. CSV export must escape cells beginning with `= + - @` to prevent formula injection.
11. Audit-log every admin mutation.
12. Errors: friendly messages to the user, details only in server logs.

---

## 5. UI / Design System

**Feel:** iOS Settings / Health app — calm, airy, minimal, rounded, generous whitespace, soft shadows, system font. Soothing, not loud.

### 5.1 Brand palette (derived from the society logo)
The logo uses a deep navy wordmark, and a ring of figures in teal, sunflower yellow, coral-red and green around a chalice/globe. Use navy + teal as the core; use the other logo colours only as soft accents.

```css
:root {
  /* Brand */
  --navy: #2E3A87;        /* primary text accents, buttons, wordmark */
  --teal: #1A9AA8;        /* primary action / progress */
  --teal-soft: #E3F4F5;
  --sun: #F2C14E;         /* streaks, highlights */
  --sun-soft: #FDF5DF;
  --coral: #EF6A4C;       /* pending / warnings (never harsh red) */
  --coral-soft: #FDECE7;
  --leaf: #4CB860;        /* completed */
  --leaf-soft: #E7F6EA;

  /* Neutrals (iOS-like) */
  --bg: #F4F6FA;          /* grouped background */
  --surface: #FFFFFF;
  --text: #1C1F33;
  --text-2: #6B7085;
  --separator: rgba(60, 60, 67, 0.12);

  --radius-s: 10px; --radius-m: 14px; --radius-l: 20px;
  --shadow: 0 1px 2px rgba(20,30,70,.04), 0 4px 16px rgba(20,30,70,.06);
  --font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --ease: cubic-bezier(.25,.8,.25,1);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0E1120; --surface: #181C2E; --text: #EEF0F8; --text-2: #9AA0B8;
    --separator: rgba(255,255,255,.08);
    --teal-soft: #12343A; --leaf-soft: #15301C; --sun-soft: #3A3218; --coral-soft: #3A1E18;
  }
}
```

### 5.2 Components (all hand-written, CSS Modules)
- **Grouped list cards** (iOS inset-grouped tables) for the checklist: each row = circular check (fills teal → leaf on complete with a subtle spring scale animation), title, secondary description, right-aligned points pill (`+2`).
- **iOS toggle switch** variant for admin "Active" setting.
- **Progress ring** (SVG) showing weekly points / max at the top of This Week and Dashboard.
- **Stat tiles** (2×2 grid on mobile): Completed, Pending, This Week's Points, Streak.
- **Bottom sheet** for confirmations (submit week, delete activity) — slides up, dimmed backdrop, `Escape`/backdrop to close, focus-trapped.
- **Bottom tab bar** on mobile (Home, This Week, History, + Admin tab if admin) with safe-area insets (`env(safe-area-inset-bottom)`); collapses to a left sidebar ≥ 900px.
- **Large title header** that shrinks on scroll (CSS `position: sticky` + small IntersectionObserver, no library).
- Segmented control (e.g., History: 4W / 12W / All).
- Toast for "Saved" / errors.
- Empty states with the logo faintly in the background.
- Place the logo at `public/logo.png` (user will supply); show it on login screen and in the header (small, 28px).

### 5.3 Rules
- Mobile-first, min tap target 44×44px, base font 17px, body line-height 1.4.
- Animations ≤ 250ms, only `transform`/`opacity`; respect `prefers-reduced-motion`.
- Accessibility: semantic HTML, `role="checkbox"` + `aria-checked` on checklist rows (or real inputs), visible focus rings in teal, WCAG AA contrast, labels on every input.
- No layout shift: reserve space for numbers, use `font-variant-numeric: tabular-nums`.

---

## 6. Routes / Pages

```
/login, /register
/                 → Dashboard (member)
/week             → This Week checklist + submit
/history          → Past weeks list
/history/[weekStart] → Week detail (own only)
/admin            → Admin overview dashboard
/admin/activities → CRUD activities (drag or up/down to reorder)
/admin/members    → Member list + search
/admin/members/[id] → Member history (read-only)
/api/admin/export?from=YYYY-MM-DD&to=YYYY-MM-DD → CSV (admin only)
```

---

## 7. Project Structure

```
app/
  (auth)/login/page.tsx, register/page.tsx
  (app)/layout.tsx          # tab bar, requireUser()
  (app)/page.tsx            # dashboard
  (app)/week/page.tsx
  (app)/history/...
  (admin)/admin/...         # requireAdmin() in layout AND each action
  api/admin/export/route.ts
  globals.css
components/                 # ChecklistRow, ProgressRing, StatTile, BottomSheet, TabBar, Toggle, Segmented, Chart, icons.tsx
lib/
  db.ts                     # mysql2 pool (server-only), query helpers, transaction helper
  auth.ts                   # sessions, requireUser, requireAdmin, password hashing
  week.ts                   # IST week math: getWeekStart(date), formatWeekRange
  rate-limit.ts
  validation.ts             # zod schemas
  audit.ts
actions/                    # server actions: toggleItem, submitWeek, activity CRUD, member admin
middleware.ts               # route gating + security headers/CSP nonce
db/schema.sql, db/seed.sql
scripts/create-admin.ts
.env.example
README.md
```

---

## 8. Data Flow Details

- **Opening /week:** server gets or creates the draft assessment for (user, current week_start). Ensure an `assessment_items` row exists for every currently active activity (insert missing ones with current points snapshot). Draft items for activities later deactivated are hidden and excluded from totals until submission.
- **Toggling:** server action `toggleItem(activityId, completed)` → `requireUser` → verify assessment is the user's, is `draft`, and is the current week → update item, refresh its `points_awarded` from the activity's current points → recompute total → return new total.
- **Submitting:** transaction: lock row, re-verify ownership/status/week, recompute `total_points` and `max_points` from active items, set `status='submitted'`, `submitted_at=UTC_TIMESTAMP()`.
- **Dashboard queries:** one aggregated query each; add indexes as needed; use `revalidatePath` after mutations. No client-side data fetching libraries.

---

## 9. Deliverables & Working Style

Build in this order, pausing after each phase with a short summary of what was done and how to test it:

1. Project scaffold, `globals.css` tokens, DB pool, `schema.sql` + `seed.sql`, `.env.example`, `create-admin` script.
2. Auth (register, login, logout, sessions, rate limiting, middleware, security headers).
3. Member: This Week checklist + autosave + submit.
4. Member: Dashboard + History + chart.
5. Admin: activities CRUD, members, overview, CSV export, audit log.
6. Polish: dark mode, accessibility pass, reduced motion, empty/loading/error states (`loading.tsx`, `error.tsx`, `not-found.tsx`).
7. **README.md**: local setup with XAMPP/phpMyAdmin (import schema → seed → create least-privilege user → `.env.local` → `npm run dev`), production build (`npm run build && npm start`), and a deployment note for a Node host + remote MySQL.

Quality bar:
- TypeScript strict, no `any`. ESLint clean. `npm run build` must succeed with zero errors.
- Write small, readable components; comment only non-obvious logic.
- Add a minimal test checklist in the README covering: member can't read another member's week by changing the URL, member can't call admin actions, totals can't be forged, past weeks are locked, editing activity points doesn't change past scores.
- Before finishing each phase, self-review for: SQL injection, missing auth checks, client-trusted values, unescaped output, and bundle size.
