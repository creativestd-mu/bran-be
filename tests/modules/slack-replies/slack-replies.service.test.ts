import { HttpError } from "../../../src/utils/httpError";
import {
  isSkippableSlackConversationError,
  shouldRecommendSlackReply
} from "../../../src/modules/slack-replies/slack-replies.service";

function message(text: string, user = "U_OTHER", ts = "2") {
  return { text, user, ts };
}

describe("Slack reply sync error handling", () => {
  it.each([
    "Slack API conversations.history failed: channel_not_found",
    "Slack API conversations.history failed: not_in_channel",
    "Slack API conversations.replies failed: is_archived",
    "Slack API conversations.replies failed: thread_not_found"
  ])("skips a stale or inaccessible conversation error: %s", (message) => {
    expect(isSkippableSlackConversationError(new HttpError(502, message))).toBe(true);
  });

  it.each([
    "Slack API conversations.history failed: invalid_auth",
    "Slack API conversations.history failed: missing_scope",
    "database unavailable"
  ])("does not hide account-wide failures: %s", (message) => {
    expect(isSkippableSlackConversationError(new Error(message))).toBe(false);
  });
});

describe("Slack pending-reply relevance", () => {
  const ownUserId = "U_SELF";

  it("keeps a direct work request in a DM", () => {
    const latest = message("Could you review the client deck and share feedback?");
    expect(shouldRecommendSlackReply(latest, [latest], ownUserId, "DM")).toBe(true);
  });

  it.each([
    "FYI, the campaign report was published.",
    "No action needed — sharing the project update for visibility.",
    "Thanks!",
    "Are you free for dinner tonight?",
    "Automated message: your daily digest is ready."
  ])("excludes non-actionable or non-work DM: %s", (text) => {
    const latest = message(text);
    expect(shouldRecommendSlackReply(latest, [latest], ownUserId, "DM")).toBe(false);
  });

  it("keeps an actionable update in an active work DM", () => {
    const latest = message("The client deadline moved to Friday and approval is still pending.");
    const sent = message("What is the launch status?", ownUserId, "1");
    expect(shouldRecommendSlackReply(latest, [latest, sent], ownUserId, "DM")).toBe(true);
  });

  it("excludes a work update when the user has not participated and no response is requested", () => {
    const latest = message("The client deadline moved to Friday.");
    expect(shouldRecommendSlackReply(latest, [latest], ownUserId, "DM")).toBe(false);
  });

  it("keeps a work-thread request directed to the user", () => {
    const latest = message(`<@${ownUserId}> can you approve the campaign brief?`);
    expect(shouldRecommendSlackReply(latest, [latest], ownUserId, "THREAD")).toBe(true);
  });

  it("excludes another participant's general thread update", () => {
    const latest = message("The campaign deck is ready.");
    const sent = message("I uploaded the first draft.", ownUserId, "1");
    expect(shouldRecommendSlackReply(latest, [latest, sent], ownUserId, "THREAD")).toBe(false);
  });

  it("keeps a work question in a thread where the user participated", () => {
    const latest = message("Should we send the revised client proposal today?");
    const sent = message("I can handle the final proposal.", ownUserId, "1");
    expect(shouldRecommendSlackReply(latest, [latest, sent], ownUserId, "THREAD")).toBe(true);
  });
});
