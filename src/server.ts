import { app } from "./app";
import { env } from "./config/env";
import { startAttendanceCron } from "./modules/attendance/attendance.cron";
import { startEscalationCron } from "./modules/escalation/escalation.cron";
import { startMeetingsSyncCron } from "./modules/meetings/meetings.cron";
import { startGmailSyncCron } from "./modules/gmail/gmail.cron";
import { startEventsDetectCron } from "./modules/events/events.cron";
import { startWorkIngestCron } from "./modules/work/work.ingest.cron";

app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port}`);
  startAttendanceCron();
  startEscalationCron();
  startMeetingsSyncCron();
  startGmailSyncCron();
  startEventsDetectCron();
  startWorkIngestCron();
});
