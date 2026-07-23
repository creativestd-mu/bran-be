-- Staff attendance (ETA/WFH/leave) is operational data, not org/business events.
DELETE FROM "org_event_updates" WHERE "source_type" = 'ATTENDANCE';

DELETE FROM "org_events" e
WHERE e."kind" = 'AUTO'
  AND NOT EXISTS (
    SELECT 1 FROM "org_event_updates" u WHERE u."event_id" = e."id"
  );

UPDATE "org_events" e
SET "latest_update_at" = sub.max_occurred
FROM (
  SELECT "event_id", MAX("occurred_at") AS max_occurred
  FROM "org_event_updates"
  GROUP BY "event_id"
) sub
WHERE sub."event_id" = e."id";
