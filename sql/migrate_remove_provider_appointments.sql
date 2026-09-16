-- ============================================================
-- migrate_remove_provider_appointments.sql
-- Run this ONLY if you already imported the old schema.sql that had
-- a "provider" role and an "appointments" table.
-- (If this is a brand new install, just use schema.sql -- skip this file.)
--
-- Run in phpMyAdmin: select the `pregnacare` database -> SQL tab ->
-- paste this whole file -> Go.
-- ============================================================
USE pregnacare;

-- 1. Delete any provider accounts (and their profile rows via cascade)
DELETE FROM users WHERE role = 'provider';

-- 2. Drop the now-unused tables
DROP TABLE IF EXISTS provider_profiles;
DROP TABLE IF EXISTS appointments;

-- 3. Narrow the users.role enum down to patient/admin only
ALTER TABLE users MODIFY role ENUM('patient','admin') NOT NULL;

SELECT 'Migration complete. Only patient and admin roles remain, appointments removed.' AS status;
