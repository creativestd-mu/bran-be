import { app } from "./app";
import { env } from "./config/env";
import { startAttendanceCron } from "./modules/attendance/attendance.cron";
import { startMeetingsSyncCron } from "./modules/meetings/meetings.cron";

app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port}`);
  startAttendanceCron();
  startMeetingsSyncCron();
});
