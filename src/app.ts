import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";

import { env } from "./config/env";
import { errorHandler } from "./middlewares/errorHandler";
import { notFoundHandler } from "./middlewares/notFound";
import { attendanceRouter } from "./modules/attendance/attendance.routes";
import {
  etaCronHandler,
  slackCommandsHandler,
  slackEventsHandler
} from "./modules/attendance/attendance.webhook";
import { handleCalendarOAuthCallback } from "./modules/meetings/meetings.service";
import { recallWebhookHandler } from "./modules/meetings/meetings.webhook";
import { apiRouter } from "./routes";

const app = express();

// Serve admin tools before helmet so inline scripts are not blocked by CSP
app.get("/admin/ingestion", (_req, res) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src *; img-src *;"
  );
  res.sendFile(path.join(__dirname, "../tools/user-ingestion.html"));
});

app.post(
  "/webhooks/recall",
  express.raw({ type: "application/json" }),
  recallWebhookHandler
);

// Slack + cron webhooks need raw body for signature / form verification
app.post(
  "/api/slack/events",
  express.raw({ type: "*/*" }),
  slackEventsHandler
);
app.post(
  "/api/slack/commands",
  express.raw({ type: "*/*" }),
  slackCommandsHandler
);
app.get("/api/cron/eta-check", etaCronHandler);

app.get("/oauth/google/calendar/callback", (req, res) => {
  void handleCalendarOAuthCallback(req, res);
});

app.use(helmet());
app.use(cors());
app.use(express.json());
if (env.nodeEnv !== "test") {
  app.use(morgan("dev"));
}

// Guide-compatible aliases (JWT auth) — same handlers as /:lang/v1/attendance
app.use("/api/eta", attendanceRouter);

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend service is running"
  });
});

app.use(apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
