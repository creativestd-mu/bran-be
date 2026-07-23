-- Attendance (ETA / WFH / leave) is operational HR data, not an org/business/
-- student topic, so it must not appear in org events.
-- 1) Drop every attendance-sourced update.
DELETE FROM "org_event_updates" WHERE "source_type" = 'ATTENDANCE';

-- 2) Remove AUTO events that were built only from attendance and are now empty.
--    (MANUAL events are preserved even if they currently have no updates.)
DELETE FROM "org_events" e
WHERE e."kind" = 'AUTO'
  AND NOT EXISTS (
    SELECT 1 FROM "org_event_updates" u WHERE u."event_id" = e."id"
  );

-- 3) Recompute latest_update_at for any surviving event whose newest update
--    may have been a (now-deleted) attendance update.
UPDATE "org_events" e
SET "latest_update_at" = sub.max_occurred
FROM (
  SELECT "event_id", MAX("occurred_at") AS max_occurred
  FROM "org_event_updates"
  GROUP BY "event_id"
) sub
WHERE sub."event_id" = e."id";
