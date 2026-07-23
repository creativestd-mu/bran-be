-- A real org/business/student event must be anchored by a substantive business
-- source (email, escalation, or work unit). Meetings are only context.
-- Remove AUTO events that have NO non-meeting update (i.e. they are just one or
-- more meetings dressed up as an event, or are empty). MANUAL notes count as an
-- anchor, so events an admin has annotated are preserved.
-- Deleting the event cascades its updates, freeing those meetings to be
-- re-clustered later only when a genuine business anchor exists.
DELETE FROM "org_events" e
WHERE e."kind" = 'AUTO'
  AND NOT EXISTS (
    SELECT 1 FROM "org_event_updates" u
    WHERE u."event_id" = e."id"
      AND u."source_type" <> 'MEETING'
  );

-- Recompute latest_update_at for any survivors (defensive; no-op for most).
UPDATE "org_events" e
SET "latest_update_at" = sub.max_occurred
FROM (
  SELECT "event_id", MAX("occurred_at") AS max_occurred
  FROM "org_event_updates"
  GROUP BY "event_id"
) sub
WHERE sub."event_id" = e."id";
