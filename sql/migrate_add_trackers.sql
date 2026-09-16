-- ============================================================
-- migrate_add_trackers.sql
-- Run this if you already have a pregnacare database from before
-- the Kick Counter / Contraction Timer feature was added.
-- Run in phpMyAdmin: select the `pregnacare` database -> SQL tab ->
-- paste this whole file -> Go.
-- ============================================================
USE pregnacare;

CREATE TABLE IF NOT EXISTS trackers (
  id               VARCHAR(20) PRIMARY KEY,
  user_id          VARCHAR(20) NOT NULL,
  kind             ENUM('kick','contraction') NOT NULL,
  at               DATETIME NOT NULL,
  duration_seconds INT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

SELECT 'Migration complete. trackers table added.' AS status;
