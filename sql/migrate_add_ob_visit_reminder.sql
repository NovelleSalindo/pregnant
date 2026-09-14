-- ============================================================
-- migrate_add_ob_visit_reminder.sql
-- Run this if you already have a pregnacare database from before
-- the OB Visit Reminder replaced the Kick & Contraction Tracker.
-- Run in phpMyAdmin: select the `pregnacare` database -> SQL tab ->
-- paste this whole file -> Go.
-- ============================================================
USE pregnacare;

ALTER TABLE patient_profiles ADD COLUMN IF NOT EXISTS next_ob_visit DATE NULL;

SELECT 'Migration complete. next_ob_visit column added.' AS status;
