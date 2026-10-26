-- 2026-10-26: activity groups (checklist tabs) and member notes.
-- For databases created BEFORE this date. Run ONCE (phpMyAdmin -> select the database
-- -> Import, or paste into the SQL tab), then import db/seed.sql to add the groups
-- and the new activities (seed.sql is safe to re-run).
-- Fresh installs don't need this file: schema.sql already includes these changes.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS activity_groups (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE activities
  ADD COLUMN group_id INT UNSIGNED NULL AFTER description,
  ADD COLUMN allows_note TINYINT(1) NOT NULL DEFAULT 0 AFTER points,
  ADD INDEX idx_activities_group (group_id, sort_order),
  ADD CONSTRAINT fk_activities_group FOREIGN KEY (group_id) REFERENCES activity_groups(id) ON DELETE SET NULL;

ALTER TABLE assessment_items
  ADD COLUMN note VARCHAR(500) NULL AFTER completed;
