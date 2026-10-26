-- Weekly Spiritual Growth Assessment — schema (MySQL 8.0.16+, InnoDB, utf8mb4)
-- phpMyAdmin: select (or create) your database, then Import this file.
-- All DATETIME columns hold UTC; the app sets the session time_zone to +00:00.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('member','admin') NOT NULL DEFAULT 'member',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  failed_logins SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role_active (role, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,          -- SHA-256 (hex) of random 32-byte token
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sessions_user (user_id),
  INDEX idx_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity_groups (                -- checklist tabs, e.g. "Spiritual"
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activities (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  description VARCHAR(500) NULL,
  group_id INT UNSIGNED NULL,
  points TINYINT UNSIGNED NOT NULL CHECK (points BETWEEN 0 AND 100),
  allows_note TINYINT(1) NOT NULL DEFAULT 0,       -- shows a free-text box when ticked
  sort_order SMALLINT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_activities_active_sort (is_active, sort_order),
  INDEX idx_activities_group (group_id, sort_order),
  CONSTRAINT fk_activities_group FOREIGN KEY (group_id) REFERENCES activity_groups(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS weekly_assessments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  week_start DATE NOT NULL,                      -- Monday (IST)
  status ENUM('draft','submitted') NOT NULL DEFAULT 'draft',
  total_points SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  max_points SMALLINT UNSIGNED NOT NULL DEFAULT 0, -- snapshot at submit
  submitted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_week (user_id, week_start),
  INDEX idx_wa_week_status (week_start, status),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assessment_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  assessment_id INT UNSIGNED NOT NULL,
  activity_id INT UNSIGNED NOT NULL,
  activity_title VARCHAR(150) NOT NULL,          -- snapshot
  points_awarded TINYINT UNSIGNED NOT NULL,      -- snapshot of points at time of completion
  completed TINYINT(1) NOT NULL DEFAULT 0,
  note VARCHAR(500) NULL,                       -- member's free text (activities with allows_note)
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_assessment_activity (assessment_id, activity_id),
  INDEX idx_items_activity_completed (activity_id, completed), -- per-activity completion stats
  FOREIGN KEY (assessment_id) REFERENCES weekly_assessments(id) ON DELETE CASCADE,
  FOREIGN KEY (activity_id) REFERENCES activities(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_id INT UNSIGNED NULL,
  action VARCHAR(60) NOT NULL,                   -- e.g. activity.update, week.reopen, user.role_change
  entity VARCHAR(40) NOT NULL,
  entity_id INT UNSIGNED NULL,
  details JSON NULL,
  ip VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_actor (actor_id),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket VARCHAR(120) PRIMARY KEY,               -- e.g. login:ip:1.2.3.4
  hits INT UNSIGNED NOT NULL,
  reset_at DATETIME NOT NULL,
  INDEX idx_rate_limits_reset (reset_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_resets (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,          -- SHA-256 (hex) of the emailed one-time token
  expires_at DATETIME NOT NULL,                 -- 60 minutes after creation (UTC)
  used_at DATETIME NULL,
  ip VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_resets_user (user_id),
  INDEX idx_resets_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
