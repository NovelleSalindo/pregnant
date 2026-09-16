# PregnaCare (PHP + MySQL version)

Flat file structure -- every page is its own `.php` file. Focused purely on
**risk monitoring and recommendations** for patients, with an admin panel
for oversight. Two roles only: **patient** (the pregnant user) and **admin**.

## Files
- `base.php` -- shared bootstrap: DB connection, session, helpers, and the ported **AHP + Fuzzy Logic + Rule-Based** risk engine. Every page includes this at the top.
- `sql/schema.sql` -- full database schema + seed data (2 demo accounts, symptom catalog, AHP weights, rule base).
- `sql/migrate_severe_level.sql` -- run only if you have an older DB that still uses Low/Moderate/High (renames to Low/High/Severe).
- `sql/migrate_remove_provider_appointments.sql` -- run only if you have an older DB with a "provider" role and an "appointments" table (removes both).
- `reset_demo_passwords.php` -- run once in the browser after importing the schema, to properly hash the 2 demo accounts' passwords.
- `test_connection.php` -- open this first to confirm the DB is connected; links to every page.
- `index.php` -- entry point, redirects to login or your dashboard.
- `login.php`, `register.php`, `logout.php` -- auth pages (registration creates patients only).
- `dashboard.php` -- patient home: risk gauge, latest vitals, top recommendations, notifications.
- `monitoring.php` -- log & chart vitals (BP, hemoglobin, blood sugar, etc) **and** risk score trend/history.
- `symptoms.php` -- symptom check-in form; on submit it runs the risk engine and saves an assessment.
- `analyze.php` -- full breakdown of the latest assessment (AHP contributions, fuzzy membership, triggered rules, recommendations).
- `education.php` -- trimester tips + knowledge base articles.
- `profile.php` -- patient profile editor.
- `admin_dashboard.php` -- system stats + activity log.
- `admin_patients.php` -- list of all patients sorted by risk level.
- `admin_patient.php?id=...` -- admin's view of one patient (vitals, assessment history, recommendations, send a note).
- `admin_settings.php` -- edit AHP weights (auto-normalized to sum to 1) and toggle rule-base rules on/off.
- `tracker.php` -- Kick Counter (tap-to-log fetal movements) + Contraction Timer (start/stop, logs duration).
- `manifest.json`, `sw.js`, `icon.svg`, `icon-192.png`, `icon-512.png` -- makes the app installable to a phone's home screen (PWA). Static assets are cached for faster loads; PHP pages still require the live server + DB.
- `css/style.css` -- shared design (same tokens/palette as the original, unchanged).

## New in this round
- **Baby size widget** on the dashboard: an illustrative silhouette (not a real/medical image) plus a week-by-week fruit-size comparison (e.g. "about the size of a lemon 🍋"), and a due-date countdown.
- **Kick & Contraction Tracker** (`tracker.php`): big tap-to-log kick counter with a daily count, and a start/stop contraction timer that logs duration.
- **Dark mode toggle**: icon button in the topbar (moon/sun icon). Preference is saved in the browser and applied instantly on next page load, no flash.
- **Installable as an app (PWA)**: on mobile, the browser's "Add to Home Screen" will install PregnaCare with its own icon and fullscreen (no address bar) experience.

## Risk levels
Assessments use three tiers: **Low → High → Severe** (color-coded green/amber/red
throughout, same as before).

## Setup (XAMPP / Laragon / any local MySQL + PHP)

1. Start MySQL and create the database by importing the schema:
   ```
   mysql -u root -p < sql/schema.sql
   ```
   (or open phpMyAdmin -> Import -> choose `sql/schema.sql`)

   If you already had an older copy of this project's database, also run
   (in this order) `sql/migrate_remove_provider_appointments.sql`,
   `sql/migrate_severe_level.sql`, and `sql/migrate_add_trackers.sql`
   instead of re-importing schema.sql.

2. Open `base.php` and check the DB connection constants match your setup:
   ```php
   define('DB_HOST', 'localhost');
   define('DB_NAME', 'pregnacare');
   define('DB_USER', 'root');
   define('DB_PASS', '');
   ```

3. Put this whole folder inside your web server root (e.g. `htdocs/pregnacare`), then in your browser visit:
   ```
   http://localhost/pregnacare/test_connection.php
   ```
   This checks the DB connection and gives you one-click links for the next steps.

4. Run `reset_demo_passwords.php` once (button on the connection-check page, or visit it directly).

5. Log in with:
   - `ana@demo.com` / `demo123` (patient)
   - `admin@demo.com` / `demo123` (admin)

## Notes
- This is decision support, not a medical diagnosis tool.
- The risk engine in `base.php` (functions `assess_risk`, `evaluate_rules`, `fuzzy_sets`, etc.) is a line-for-line PHP port of the original `riskEngine.js`.
- Passwords are hashed with PHP's `password_hash()` / verified with `password_verify()`.
- All queries use PDO prepared statements.
