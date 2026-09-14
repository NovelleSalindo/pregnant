-- ============================================================
-- PregnaCare -- MySQL schema
-- Roles: patient (user) and admin only.
-- Import this first: create the "pregnacare" database, then run
-- this whole file against it (phpMyAdmin > Import, or:
--   mysql -u root -p pregnacare < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS pregnacare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pregnacare;

-- ---------- users ----------
CREATE TABLE users (
  id            VARCHAR(20)  PRIMARY KEY,
  role          ENUM('patient','admin') NOT NULL,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- patient profile ----------
CREATE TABLE patient_profiles (
  user_id            VARCHAR(20) PRIMARY KEY,
  dob                DATE NULL,
  age                INT NULL,
  height_cm          DECIMAL(5,1) NULL,
  weight_kg          DECIMAL(5,1) NULL,
  pre_pregnancy_weight_kg DECIMAL(5,1) NULL,
  blood_type         VARCHAR(5) NULL,
  occupation         VARCHAR(100) NULL,
  lmp                DATE NULL,
  edd                DATE NULL,
  gravida            INT NULL,
  prior_miscarriage  TINYINT(1) DEFAULT 0,
  prior_csection     TINYINT(1) DEFAULT 0,
  conditions         VARCHAR(255) NULL,
  phone              VARCHAR(30) NULL,
  address            VARCHAR(255) NULL,
  emergency_name     VARCHAR(120) NULL,
  emergency_relation VARCHAR(60) NULL,
  emergency_phone    VARCHAR(30) NULL,
  medical_history_score     DECIMAL(3,2) DEFAULT 0,
  prior_complications_score DECIMAL(3,2) DEFAULT 0,
  next_ob_visit DATE NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- vitals monitoring ----------
CREATE TABLE monitoring (
  id             VARCHAR(20) PRIMARY KEY,
  user_id        VARCHAR(20) NOT NULL,
  date           DATETIME NOT NULL,
  bp_sys         INT NULL,
  bp_dia         INT NULL,
  weight_kg      DECIMAL(5,1) NULL,
  bmi            DECIMAL(4,1) NULL,
  hemoglobin     DECIMAL(4,1) NULL,
  blood_sugar    INT NULL,
  temp           DECIMAL(4,1) NULL,
  heart_rate     INT NULL,
  fetal_movement INT NULL,
  sleep_hours    DECIMAL(3,1) NULL,
  water_intake   INT NULL,
  mood           VARCHAR(30) NULL,
  activity       VARCHAR(60) NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- symptom catalog (editable reference list) ----------
CREATE TABLE symptom_catalog (
  id     VARCHAR(40) PRIMARY KEY,
  name   VARCHAR(80) NOT NULL,
  icon   VARCHAR(60) NOT NULL,
  weight DECIMAL(3,2) NOT NULL
) ENGINE=InnoDB;

-- ---------- symptom logs ----------
CREATE TABLE symptom_logs (
  id      VARCHAR(20) PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL,
  date    DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE symptom_log_items (
  id              VARCHAR(20) PRIMARY KEY,
  symptom_log_id  VARCHAR(20) NOT NULL,
  symptom_id      VARCHAR(40) NOT NULL,
  severity        ENUM('None','Mild','Moderate','Severe') NOT NULL DEFAULT 'None',
  duration        VARCHAR(30) NOT NULL DEFAULT 'Today',
  frequency       VARCHAR(20) NOT NULL DEFAULT 'Rare',
  FOREIGN KEY (symptom_log_id) REFERENCES symptom_logs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- risk assessments (AHP + Fuzzy + Rule output) ----------
CREATE TABLE assessments (
  id                VARCHAR(20) PRIMARY KEY,
  user_id           VARCHAR(20) NOT NULL,
  date              DATETIME NOT NULL,
  score             INT NOT NULL,
  level             ENUM('Low','High','Severe') NOT NULL,
  weighted_score    DECIMAL(6,3) NOT NULL,
  centroid          INT NOT NULL,
  ahp_json          JSON NULL,
  fuzzy_json        JSON NULL,
  rules_json        JSON NULL,
  recommendations_json JSON NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- notifications ----------
CREATE TABLE notifications (
  id      VARCHAR(20) PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL,
  title   VARCHAR(160) NOT NULL,
  body    VARCHAR(255) NULL,
  date    DATETIME NOT NULL,
  is_read TINYINT(1) DEFAULT 0,
  kind    VARCHAR(30) DEFAULT 'info',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- admin-configurable AHP weights ----------
CREATE TABLE ahp_weights (
  criterion VARCHAR(40) PRIMARY KEY,
  weight    DECIMAL(4,3) NOT NULL
) ENGINE=InnoDB;

-- ---------- admin-configurable rule base ----------
CREATE TABLE rule_base (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  rule_key VARCHAR(10) NOT NULL UNIQUE,
  if_text  VARCHAR(255) NOT NULL,
  then_text VARCHAR(255) NOT NULL,
  active   TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- ---------- trackers (kick counts + contraction timing) ----------
CREATE TABLE trackers (
  id               VARCHAR(20) PRIMARY KEY,
  user_id          VARCHAR(20) NOT NULL,
  kind             ENUM('kick','contraction') NOT NULL,
  at               DATETIME NOT NULL,
  duration_seconds INT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- medications & vitamin reminders ----------
CREATE TABLE medications (
  id       VARCHAR(20) PRIMARY KEY,
  user_id  VARCHAR(20) NOT NULL,
  name     VARCHAR(120) NOT NULL,
  dosage   VARCHAR(80) NULL,
  schedule_time VARCHAR(60) NULL, -- free text e.g. "Morning, After Breakfast"
  active   TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE medication_logs (
  id            VARCHAR(20) PRIMARY KEY,
  medication_id VARCHAR(20) NOT NULL,
  user_id       VARCHAR(20) NOT NULL,
  date          DATE NOT NULL,
  taken         TINYINT(1) NOT NULL DEFAULT 1,
  taken_at      DATETIME NULL,
  FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_med_day (medication_id, date)
) ENGINE=InnoDB;

-- ---------- pregnancy journal ----------
CREATE TABLE journal_entries (
  id      VARCHAR(20) PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL,
  date    DATETIME NOT NULL,
  mood    VARCHAR(30) NULL,
  content TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- bump photo timeline ----------
CREATE TABLE bump_photos (
  id          VARCHAR(20) PRIMARY KEY,
  user_id     VARCHAR(20) NOT NULL,
  week_number INT NOT NULL,
  date        DATE NOT NULL,
  filename    VARCHAR(255) NOT NULL,
  note        VARCHAR(255) NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- audit log ----------
CREATE TABLE audit_logs (
  id       VARCHAR(20) PRIMARY KEY,
  action   VARCHAR(255) NOT NULL,
  at       DATETIME NOT NULL,
  by_email VARCHAR(160) NULL
) ENGINE=InnoDB;

-- ============================================================
-- SEED DATA
-- ============================================================

-- demo accounts (password for both = "demo123")
INSERT INTO users (id, role, name, email, password_hash) VALUES
('u-patient-1', 'patient', 'Ana Dela Cruz', 'ana@demo.com', '$2y$10$Vg1E2s0Q1t8s0k1kK7q0EeQ1xW1lQd1nQ8eF9pS5tYb0oT8B6h3Gy'),
('u-admin-1',   'admin',   'System Admin',  'admin@demo.com','$2y$10$Vg1E2s0Q1t8s0k1kK7q0EeQ1xW1lQd1nQ8eF9pS5tYb0oT8B6h3Gy');

-- NOTE: the hash above is a placeholder. Run reset_demo_passwords.php once
-- (included in this project) to set both demo accounts' password to
-- demo123 using PHP's own password_hash(), so login works out of the box.

INSERT INTO patient_profiles (user_id, dob, age, height_cm, weight_kg, blood_type, occupation, lmp, edd, gravida, prior_miscarriage, prior_csection, conditions, phone, address, emergency_name, emergency_relation, emergency_phone)
VALUES ('u-patient-1', '1997-04-12', 29, 160, 62, 'O+', 'Teacher', '2026-03-10', '2026-12-15', 2, 0, 0, 'None', '0917-555-0199', 'Oroquieta City, Misamis Occidental', 'Marco Dela Cruz', 'Spouse', '0917-555-0200');

INSERT INTO symptom_catalog (id, name, icon, weight) VALUES
('headache','Headache','fa-head-side-cough',0.50),
('blurred_vision','Blurred Vision','fa-eye',0.90),
('bleeding','Bleeding','fa-droplet',1.00),
('swelling','Swelling','fa-hand-dots',0.60),
('vomiting','Vomiting','fa-face-dizzy',0.40),
('fever','Fever','fa-temperature-high',0.60),
('abdominal_pain','Abdominal Pain','fa-user-injured',0.80),
('back_pain','Back Pain','fa-bone',0.25),
('dizziness','Dizziness','fa-rotate',0.50),
('difficulty_breathing','Difficulty Breathing','fa-lungs',0.95),
('reduced_movement','Reduced Baby Movement','fa-baby',1.00),
('high_bp_feel','High Blood Pressure Symptoms','fa-heart-pulse',0.85),
('convulsions','Convulsions','fa-bolt',1.00),
('fatigue','Fatigue','fa-battery-quarter',0.20),
('shortness_of_breath','Shortness of Breath','fa-wind',0.70);

INSERT INTO ahp_weights (criterion, weight) VALUES
('maternal_age',0.08),
('trimester',0.07),
('blood_pressure',0.22),
('bmi',0.10),
('hemoglobin',0.13),
('medical_history',0.13),
('prior_complications',0.12),
('symptoms',0.15);

INSERT INTO rule_base (rule_key, if_text, then_text, active) VALUES
('r1','Blood Pressure is High AND Headache is Severe','Severe Risk -- Immediate Hospital Consultation',1),
('r2','Bleeding is Severe','Severe Risk -- Go to Emergency Room now',1),
('r3','Convulsions reported at any severity','Severe Risk -- Emergency, seek care immediately',1),
('r4','Difficulty Breathing is Moderate or Severe','Severe Risk -- Immediate Hospital Consultation',1),
('r5','Reduced Baby Movement is Moderate or Severe','Severe Risk -- Contact OB-GYN today',1),
('r6','Blood Sugar is High AND Trimester is 2nd/3rd','High Risk -- Monitor Blood Sugar closely',1),
('r7','Hemoglobin is Low','High Risk -- Take Iron Supplement, recheck labs',1),
('r8','Swelling is Moderate/Severe AND BP elevated','Severe Risk -- Preeclampsia screening advised',1),
('r9','No symptoms AND all vitals within range','Low Risk -- Continue routine prenatal care',1);
