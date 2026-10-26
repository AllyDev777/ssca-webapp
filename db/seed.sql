-- Default activity groups and activities. Safe to re-run: nothing is duplicated and
-- existing rows (including admin edits to titles/points) are never overwritten.
-- The admin account is NOT seeded here: run `npm run create-admin` so no
-- password ever lives in a file.

SET NAMES utf8mb4;

-- Groups = the tabs on the checklist, in this order.
INSERT IGNORE INTO activity_groups (id, name, sort_order) VALUES
  (1, 'Spiritual', 10),
  (2, 'Social media', 20),
  (3, 'Online meetings', 30),
  (4, 'Community', 40),
  (5, 'Mission', 50);

-- The original five activities (fixed ids).
INSERT IGNORE INTO activities (id, title, description, group_id, points, sort_order) VALUES
  (1, 'Attended Mass', 'Took part in Holy Mass this week.', 1, 2, 10),
  (2, 'Shared Post with 3 Groups/Forwards', 'Shared the society''s post with at least three groups or contacts.', 2, 1, 10),
  (3, 'Reflected on Bible Verse at 10 AM', 'Spent time with the daily verse at 10 AM.', 3, 2, 10),
  (4, 'Created one article/blog on St. Carlo', 'Wrote and published an article or blog post about St. Carlo Acutis.', 2, 2, 20),
  (5, 'Led the 12 PM Meet and talked on any topic', 'Hosted the 12 PM meet and gave a short talk.', 3, 5, 20);

-- Databases created before groups existed: file the original five into their groups.
UPDATE activities SET group_id = 1 WHERE id = 1 AND group_id IS NULL;
UPDATE activities SET group_id = 2, sort_order = 10 WHERE id = 2 AND group_id IS NULL;
UPDATE activities SET group_id = 3, sort_order = 10 WHERE id = 3 AND group_id IS NULL;
UPDATE activities SET group_id = 2, sort_order = 20 WHERE id = 4 AND group_id IS NULL;
UPDATE activities SET group_id = 3, sort_order = 20 WHERE id = 5 AND group_id IS NULL;

-- Additional activities, added only if an activity with the same title doesn't exist yet.
INSERT INTO activities (title, description, group_id, points, allows_note, sort_order)
SELECT s.title, s.description, s.group_id, s.points, s.allows_note, s.sort_order
FROM (
  -- Spiritual
  SELECT 'Attending weekday Mass' AS title, NULL AS description, 1 AS group_id, 5 AS points, 0 AS allows_note, 20 AS sort_order
  UNION ALL SELECT 'Attending online Mass', NULL, 1, 3, 0, 30
  UNION ALL SELECT 'Daily Holy Rosary', NULL, 1, 2, 0, 40
  UNION ALL SELECT 'Daily Divine Office', NULL, 1, 2, 0, 50
  UNION ALL SELECT '1 hour of Eucharistic adoration in person', NULL, 1, 5, 0, 60
  UNION ALL SELECT '1 hour of Eucharistic adoration online', NULL, 1, 3, 0, 70
  UNION ALL SELECT 'Other devotions / novenas', NULL, 1, 1, 0, 80
  UNION ALL SELECT 'Weekly fasting', NULL, 1, 3, 0, 90
  UNION ALL SELECT 'Monthly confession', NULL, 1, 3, 0, 100
  -- Social media
  UNION ALL SELECT 'Forwarding SSCA posts / flyers to at least 3 people', 'At least three people this week.', 2, 2, 0, 30
  UNION ALL SELECT 'Posting about St Carlo Acutis with a link to SSCA', NULL, 2, 3, 0, 40
  UNION ALL SELECT 'Creating content on your own social media accounts', NULL, 2, 3, 0, 50
  -- Online meetings
  UNION ALL SELECT 'Reflecting on and contributing to Bible studies', '10 am meetings.', 3, 1, 0, 30
  UNION ALL SELECT 'Preparing a short talk on evangelisation / defence of the faith', '12 pm meetings.', 3, 2, 0, 40
  UNION ALL SELECT 'Leading the 12 pm meeting', NULL, 3, 3, 0, 50
  -- Community
  UNION ALL SELECT 'Engaging in the mentorship programme', 'Looking after Acutisans.', 4, 2, 0, 10
  UNION ALL SELECT 'Supervising the probationers', NULL, 4, 2, 0, 20
  UNION ALL SELECT 'Taking an active leadership role', 'E.g. treasury, communications, publishing.', 4, 2, 0, 30
  UNION ALL SELECT 'Creating a Society leaflet', NULL, 4, 3, 0, 40
  -- Mission
  UNION ALL SELECT 'Representing the SSCA at public Catholic events', 'E.g. March for Life, a Eucharistic procession.', 5, 3, 0, 10
  UNION ALL SELECT 'Street evangelisation', 'Giving out flyers, talking about the faith on the street.', 5, 3, 0, 20
  UNION ALL SELECT 'Spending time promoting the Society', 'E.g. at conventions, retreats, your own parish. Tell us what you did.', 5, 3, 1, 30
  UNION ALL SELECT 'Engaging in SSCA outreaches', NULL, 5, 3, 0, 40
  UNION ALL SELECT 'Engaging in SSCA mission work', 'E.g. Rwanda.', 5, 3, 0, 50
) AS s
WHERE NOT EXISTS (SELECT 1 FROM activities a WHERE a.title = s.title);
