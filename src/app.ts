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
import { escalationCronHandler } from "./modules/escalation/escalation.cron";
import { handleCalendarOAuthCallback } from "./modules/meetings/meetings.service";
import { recallWebhookHandler } from "./modules/meetings/meetings.webhook";
import { handleGmailOAuthCallback } from "./modules/gmail/gmail.service";
import { apiRouter } from "./routes";

/** Bump when shipping route-surface changes so deploys are easy to verify. */
const BUILD_MARKER = "attendance-v1";

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

// Slack + cron webhooks need raw body for signature / form verification.
// Registered before express.json() so the body stays a Buffer.
const slackRaw = express.raw({ type: () => true, limit: "2mb" });
app.post("/api/slack/events", slackRaw, slackEventsHandler);
app.post("/api/slack/commands", slackRaw, slackCommandsHandler);
app.get("/api/slack/events", (_req, res) => {
  res.status(200).json({
    success: true,
    service: "attendance",
    build: BUILD_MARKER,
    message: "Slack events endpoint is live. Use POST for Event Subscriptions."
  });
});
app.get("/api/cron/eta-check", etaCronHandler);
app.get("/api/cron/escalation-check", escalationCronHandler);

app.get("/oauth/google/calendar/callback", (req, res) => {
  void handleCalendarOAuthCallback(req, res);
});

app.get("/oauth/google/gmail/callback", (req, res) => {
  void handleGmailOAuthCallback(req, res);
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
    message: "Backend service is running",
    build: BUILD_MARKER,
    features: {
      attendance: true,
      slackEvents: "/api/slack/events",
      slackCommands: "/api/slack/commands",
      etaCron: "/api/cron/eta-check",
      escalationCron: "/api/cron/escalation-check"
    }
  });
});

app.use(apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
