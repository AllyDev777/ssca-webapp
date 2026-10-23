-- Least-privilege MySQL user for the app. Run as root/admin in phpMyAdmin → SQL tab.
-- Replace the database name, host and password. Use '%' (or the app server's IP)
-- instead of 'localhost' if the app runs on a different machine.

CREATE USER IF NOT EXISTS 'ssca_app'@'localhost' IDENTIFIED BY 'replace-with-a-long-random-password';
GRANT SELECT, INSERT, UPDATE, DELETE ON `ssca`.* TO 'ssca_app'@'localhost';
FLUSH PRIVILEGES;
