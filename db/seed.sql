-- Default activities. Safe to re-run (fixed ids + INSERT IGNORE).
-- The admin account is NOT seeded here: run `npm run create-admin` so no
-- password ever lives in a file.

SET NAMES utf8mb4;

INSERT IGNORE INTO activities (id, title, description, points, sort_order) VALUES
  (1, 'Attended Mass', 'Took part in Holy Mass this week.', 2, 10),
  (2, 'Shared Post with 3 Groups/Forwards', 'Shared the society''s post with at least three groups or contacts.', 1, 20),
  (3, 'Reflected on Bible Verse at 10 AM', 'Spent time with the daily verse at 10 AM.', 2, 30),
  (4, 'Created one article/blog on St. Carlo', 'Wrote and published an article or blog post about St. Carlo Acutis.', 2, 40),
  (5, 'Led the 12 PM Meet and talked on any topic', 'Hosted the 12 PM meet and gave a short talk.', 5, 50);
