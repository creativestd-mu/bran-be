import { Router } from "express";

import { facebookRouter } from "../../../modules/instagram/facebook.routes";
import { instagramRouter } from "../../../modules/instagram/instagram.routes";
import { linkedinRouter } from "../../../modules/instagram/linkedin.routes";
import { youtubeRouter } from "../../../modules/instagram/youtube.routes";
import { meltwaterEarnedRouter } from "../../../modules/meltwater-earned/meltwater-earned.routes";
import { competitorContentRouter } from "../../../modules/competitor-content/competitor-content.routes";
import { sentimentRouter } from "../../../modules/sentiment/sentiment.routes";
import { healthRouter } from "./health.routes";

import { authRouter } from "../../../modules/auth/auth.routes";
import { usersRouter } from "../../../modules/users/users.routes";
import { rolesRouter } from "../../../modules/roles/roles.routes";
import { tasksRouter } from "../../../modules/tasks/tasks.routes";
import { aiRouter } from "../../../modules/ai/ai.routes";
import { socialApiRouter } from "../../../modules/social-api/social-api.routes";
import { teamsRouter } from "../../../modules/teams/teams.routes";
import { projectsRouter } from "../../../modules/projects/projects.routes";
import { podsRouter } from "../../../modules/pods/pods.routes";
import { verticalsRouter } from "../../../modules/verticals/verticals.routes";
import { contentRouter } from "../../../modules/content/content.routes";
import { notificationsRouter } from "../../../modules/notifications/notifications.routes";
import { ideationRouter } from "../../../modules/ideation/ideation.routes";
import { adhocWorkRouter } from "../../../modules/adhoc-work/adhoc-work.routes";
import { workRouter } from "../../../modules/work/work.routes";
import { voiceRecordingRouter } from "../../../modules/voice-recording/voice-recording.routes";
import { kpiRouter } from "../../../modules/kpi/kpi.routes";
import { visionRouter } from "../../../modules/vision/vision.routes";
import { navigationRouter } from "../../../modules/navigation/navigation.routes";
import { utilitiesRouter } from "../../../modules/utilities/utilities.routes";
import { inventoryRouter } from "../../../modules/inventory/inventory.routes";
import { meetingsRouter } from "../../../modules/meetings/meetings.routes";
import { gmailRouter } from "../../../modules/gmail/gmail.routes";
import { eventsRouter } from "../../../modules/events/events.routes";
import { attendanceRouter } from "../../../modules/attendance/attendance.routes";
import { graphRouter } from "../../../modules/graph/graph.routes";
import { prereadRouter } from "../../../modules/preread/preread.routes";
import { unsupportedSlackRouter } from "../../../modules/slack-unsupported/slack-unsupported.routes";
import { transcriptionKeywordsRouter } from "../../../modules/transcription-keywords/transcription-keywords.routes";

const v1Router = Router();

v1Router.use("/health", healthRouter);

// Auth (public -- no auth middleware)
v1Router.use("/auth", authRouter);

// Protected modules
v1Router.use("/users", usersRouter);
v1Router.use("/roles", rolesRouter);
v1Router.use("/tasks", tasksRouter);
v1Router.use("/ai", aiRouter);
v1Router.use("/social-api", socialApiRouter);
v1Router.use("/verticals", verticalsRouter);
v1Router.use("/teams", teamsRouter);
v1Router.use("/pods", podsRouter);
v1Router.use("/projects", projectsRouter);
v1Router.use("/contents", contentRouter);
v1Router.use("/notifications", notificationsRouter);
v1Router.use("/ideation", ideationRouter);
v1Router.use("/adhoc-work", adhocWorkRouter);
v1Router.use("/adhoc-works", adhocWorkRouter);
v1Router.use("/work", workRouter);
v1Router.use("/voice-recordings", voiceRecordingRouter);
v1Router.use("/kpis", kpiRouter);
v1Router.use("/visions", visionRouter);
v1Router.use("/navigation", navigationRouter);
v1Router.use("/utilities", utilitiesRouter);
v1Router.use("/inventory", inventoryRouter);
v1Router.use("/meetings", meetingsRouter);
v1Router.use("/gmail", gmailRouter);
v1Router.use("/events", eventsRouter);
v1Router.use("/attendance", attendanceRouter);
v1Router.use("/graph", graphRouter);
v1Router.use("/prereads", prereadRouter);
v1Router.use("/unsupported-slack-queries", unsupportedSlackRouter);
v1Router.use("/transcription-keywords", transcriptionKeywordsRouter);

// Existing Meltwater-based routes
v1Router.use("/instagram", instagramRouter);
v1Router.use("/linkedin", linkedinRouter);
v1Router.use("/youtube", youtubeRouter);
v1Router.use("/facebook", facebookRouter);
v1Router.use("/meltwater/earned", meltwaterEarnedRouter);
v1Router.use("/competitors", competitorContentRouter);
v1Router.use("/sentiment", sentimentRouter);

export { v1Router };
