-- ============================================================
-- migrate_severe_level.sql
-- Run this ONLY if you already imported the old schema.sql before
-- risk levels were renamed from Low/Moderate/High to Low/High/Severe.
-- (If this is a brand new install, just use schema.sql — skip this file.)
--
-- Run in phpMyAdmin: select the `pregnacare` database -> SQL tab ->
-- paste this whole file -> Go.
-- ============================================================
USE pregnacare;

-- 1. Widen the enum first so it temporarily accepts both old and new values
ALTER TABLE assessments MODIFY level ENUM('Low','Moderate','High','Severe') NOT NULL;

-- 2. Rename old 'High' rows to 'Severe' FIRST (frees up 'High' to be reused),
--    then rename old 'Moderate' rows to 'High'
UPDATE assessments SET level = 'Severe' WHERE level = 'High';
UPDATE assessments SET level = 'High'   WHERE level = 'Moderate';

-- 3. Narrow the enum down to the final 3 values
ALTER TABLE assessments MODIFY level ENUM('Low','High','Severe') NOT NULL;

-- 4. Refresh the rule_base display text to match the new tier names
UPDATE rule_base SET then_text = 'Severe Risk - Immediate Hospital Consultation' WHERE rule_key = 'r1';
UPDATE rule_base SET then_text = 'Severe Risk - Go to Emergency Room now' WHERE rule_key = 'r2';
UPDATE rule_base SET then_text = 'Severe Risk - Emergency, seek care immediately' WHERE rule_key = 'r3';
UPDATE rule_base SET then_text = 'Severe Risk - Immediate Hospital Consultation' WHERE rule_key = 'r4';
UPDATE rule_base SET then_text = 'Severe Risk - Contact OB-GYN today' WHERE rule_key = 'r5';
UPDATE rule_base SET then_text = 'High Risk - Monitor Blood Sugar closely' WHERE rule_key = 'r6';
UPDATE rule_base SET then_text = 'High Risk - Take Iron Supplement, recheck labs' WHERE rule_key = 'r7';
UPDATE rule_base SET then_text = 'Severe Risk - Preeclampsia screening advised' WHERE rule_key = 'r8';
UPDATE rule_base SET then_text = 'Low Risk - Continue routine prenatal care' WHERE rule_key = 'r9';

SELECT 'Migration complete. Risk levels are now Low / High / Severe.' AS status;
