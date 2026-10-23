-- Housekeeping: run periodically (e.g. daily via cron / MySQL EVENT / phpMyAdmin SQL tab).

DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP();
DELETE FROM rate_limits WHERE reset_at < UTC_TIMESTAMP();
DELETE FROM password_resets WHERE expires_at < UTC_TIMESTAMP() - INTERVAL 1 DAY;

-- Optional: let MySQL do it itself (needs the EVENT privilege and event_scheduler=ON;
-- run as an admin user, not the app user):
--
-- CREATE EVENT IF NOT EXISTS ev_ssca_cleanup
--   ON SCHEDULE EVERY 1 DAY
--   DO BEGIN
--     DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP();
--     DELETE FROM rate_limits WHERE reset_at < UTC_TIMESTAMP();
--     DELETE FROM password_resets WHERE expires_at < UTC_TIMESTAMP() - INTERVAL 1 DAY;
--   END;
