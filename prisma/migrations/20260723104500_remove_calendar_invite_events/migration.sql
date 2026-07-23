-- Calendar invites, meeting notifications and automated meeting-report emails
-- are just "meetings", not org/business/student topics. They were seeding AUTO
-- events via the GMAIL source. Remove those updates, then drop any AUTO event
-- that is left with fewer than 2 updates or no genuine business anchor.

-- 1) Delete meeting-noise GMAIL updates (calendar invites / notifications / reports).
DELETE FROM "org_event_updates"
WHERE "source_type" = 'GMAIL'
  AND (
    "title" ~* '^(invitation|updated invitation|accepted|declined|tentative|canceled|cancelled|new time proposed|reminder):'
    OR "title" ~* '(invited you to|invitation to join|read meeting report|meeting records?:|meeting summary|meeting report)'
    OR "title" ~* '@\s+(mon|tue|wed|thu|fri|sat|sun)\s+[0-9]{1,2}\s+[a-z]{3}\s+[0-9]{4}'
    OR "body" ~* '(invited you to|mentioned in the meeting summary|read meeting report|meeting records?:|join with google meet|this event has been updated|has accepted this invitation|has declined this invitation|been invited by .* to attend an event|scheduled with akiflow)'
    OR "actor_name" ~* '(calendar-notification@google\.com|@resource\.calendar\.google\.com|read\.ai|otter\.ai|fireflies|fathom|tldv|meetgeek|akiflow)'
  );

-- 2) Drop AUTO events left with <2 updates or with no non-MEETING anchor.
DELETE FROM "org_events" e
WHERE e."kind" = 'AUTO'
  AND (
    (SELECT COUNT(*) FROM "org_event_updates" u WHERE u."event_id" = e."id") < 2
    OR NOT EXISTS (
      SELECT 1 FROM "org_event_updates" u
      WHERE u."event_id" = e."id" AND u."source_type" <> 'MEETING'
    )
  );

-- 3) Recompute latest_update_at for survivors.
UPDATE "org_events" e
SET "latest_update_at" = sub.max_occurred
FROM (
  SELECT "event_id", MAX("occurred_at") AS max_occurred
  FROM "org_event_updates"
  GROUP BY "event_id"
) sub
WHERE sub."event_id" = e."id";
