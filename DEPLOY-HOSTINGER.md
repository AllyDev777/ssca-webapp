# Deploying to Hostinger — app.societyofsaintcarloacutis.org

Next.js 15 (App Router) + MySQL/MariaDB app. It needs a **Node.js app** in hPanel, not the PHP website folder.
Full documentation is in `README.md` (section 5).

## 0. Clean up the subdomain's public folder

Source files were uploaded into the subdomain's public document root and are downloadable right now
(e.g. `/package.json`, `/lib/db.ts`). Delete them from that folder. The app must live in Hostinger's Node.js app
location, not in a public web folder.

## 1. Database

1. Import `db/schema.sql`, then `db/seed.sql` (the 5 default activities) into the app's database.
   **Database already imported before 23 Oct 2026?** Also import `db/migrations/2026-10-23-password-resets.sql`
   once (adds the table for "Forgot password"). It is safe to run more than once.
   **Database imported before 26 Oct 2026?** Import `db/migrations/2026-10-26-activity-groups.sql` **once**
   (checklist groups + member notes), then import `db/seed.sql` again to add the groups and new activities
   (`seed.sql` never duplicates or overwrites anything, so re-running it is safe).
2. The app's DB user needs only **SELECT, INSERT, UPDATE, DELETE** on that database. Don't grant ALL.

## 2. Node.js app (hPanel → Websites → Add Website → Node.js Apps → Upload files)

| Setting | Value |
|---|---|
| Upload | this zip |
| Domain | `app.societyofsaintcarloacutis.org` |
| Node.js | **20 or higher** |
| Install | `npm ci` (devDependencies are needed for the build: TypeScript, ESLint) |
| Build command | `npm run build` |
| Start command | `npm start` (respects `PORT`). Passenger-style setups: startup file `server.cjs` |

## 3. Environment variables (set in hPanel, not committed in any file)

Enter each value on its own, without the `# …` notes.

```
DB_HOST=        # as provided by Hostinger for this database
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_NAME=
DB_POOL_SIZE=5
SESSION_SECRET= # 32+ random chars: node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

# Forgot-password emails
APP_URL=https://app.societyofsaintcarloacutis.org   # used to build the reset link; no trailing slash
SMTP_HOST=smtp.hostinger.com                       # Hostinger email; or your provider's SMTP host
SMTP_PORT=465                                      # 465 = SSL/TLS, 587 = STARTTLS
SMTP_SECURE=true                                   # true for 465, false for 587
SMTP_USER=no-reply@societyofsaintcarloacutis.org   # the mailbox login
SMTP_PASSWORD=                                     # that mailbox's password
MAIL_FROM=SSCA <no-reply@societyofsaintcarloacutis.org>
```

Create the sending mailbox first (hPanel → Emails → create `no-reply@…`). Without `SMTP_HOST` the app still works;
the "Forgot password" page just tells members to ask an admin. Mail errors are logged as `[mail]`/`[auth]` lines.

**Check the mail settings** (needs SSH/terminal in the app folder): `npm run test-email -- you@example.com`. It
connects, logs in and sends a sample reset email, or prints exactly what failed (wrong password, port, certificate…).

Do **not** set `NEXT_PUBLIC_BASE_PATH`, because the app is served at the subdomain root.
HTTPS is required: session cookies are `__Host-` / `Secure` in production.

## 4. First admin

- With SSH: in the app folder, `npm run create-admin` (interactive; the password is hidden while typing).
- Without SSH: register at `/register` with the owner's email, then run
  `UPDATE users SET role='admin' WHERE email='owner@example.com';` and sign out and back in.

## 5. Maintenance

Run `db/cleanup.sql` daily (cron or phpMyAdmin) to purge expired sessions, rate-limit rows and old reset links.

## 6. Smoke test

- `/` redirects to `/login` and shows the SSCA login page (not the hosting "Default page").
- Sign in, refresh, and you are still signed in (confirms HTTPS and cookies).
- Tick an activity, refresh, and it is still ticked (confirms DB writes).
- `https://societyofsaintcarloacutis.org` (WordPress) is unaffected.
- `/package.json` and `/lib/db.ts` return 404 (source no longer public).
