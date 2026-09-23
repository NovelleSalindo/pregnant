CREATE TABLE IF NOT EXISTS coopland_assessments (
  id              VARCHAR(20) PRIMARY KEY,
  user_id         VARCHAR(20) NOT NULL,
  date            DATETIME NOT NULL,
  score           INT NOT NULL,
  risk_level      ENUM('Low','High','Severe') NOT NULL,
  factors_json    JSON NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS clinical_alerts (
  id              VARCHAR(20) PRIMARY KEY,
  user_id         VARCHAR(20) NOT NULL,
  date            DATETIME NOT NULL,
  alert_text      VARCHAR(255) NOT NULL,
  severity        ENUM('Low','Moderate','High','Severe') NOT NULL DEFAULT 'Moderate',
  source_type     VARCHAR(50) NULL, -- e.g., 'symptom', 'vitals'
  source_id       VARCHAR(40) NULL, -- ID of the symptom or vital reading
  status          ENUM('active','resolved') NOT NULL DEFAULT 'active',
  resolved_at     DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS coopland_factors (
  factor_key      VARCHAR(50) PRIMARY KEY,
  category        VARCHAR(50) NOT NULL,
  points          INT NOT NULL,
  description     VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

-- Seed basic Coopland factors based on standard medical guidelines
INSERT IGNORE INTO coopland_factors (factor_key, category, points, description) VALUES
('age_under_16', 'Reproductive History', 1, 'Age < 16 years'),
('age_16_35', 'Reproductive History', 0, 'Age 16 - 35 years'),
('age_over_35', 'Reproductive History', 2, 'Age > 35 years'),
('parity_0', 'Reproductive History', 1, 'Parity = 0 (Nulliparous)'),
('parity_1_4', 'Reproductive History', 0, 'Parity 1 - 4'),
('parity_over_4', 'Reproductive History', 2, 'Parity > 4'),
('prior_miscarriage', 'Reproductive History', 1, 'Prior Miscarriage'),
('prior_csection', 'Reproductive History', 2, 'Prior Cesarean Section'),
('prior_preeclampsia', 'Reproductive History', 2, 'Prior Preeclampsia'),
('chronic_hypertension', 'Medical Conditions', 2, 'Chronic Hypertension'),
('diabetes', 'Medical Conditions', 3, 'Diabetes Mellitus'),
('cardiac_disease', 'Medical Conditions', 3, 'Cardiac Disease');
