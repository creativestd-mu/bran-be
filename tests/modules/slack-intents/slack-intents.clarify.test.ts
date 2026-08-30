/**
 * Unit-level coverage for clarification submit resolution rules.
 * Prisma / Slack I/O are mocked.
 */

jest.mock("../../../src/modules/slack-intents/slack-intents.repository", () => ({
  getSlackIntentSuggestion: jest.fn(),
  markSlackIntentSuggestion: jest.fn()
}));

jest.mock("../../../src/modules/slack-intents/slack-intents.dispatch", () => ({
  runSlackIntent: jest.fn()
}));

jest.mock("../../../src/modules/slack-intents/slack-intents.learn", () => ({
  learnSlackIntent: jest.fn().mockResolvedValue(undefined)
}));

jest.mock("../../../src/modules/slack-intents/slack-intents.matcher", () => ({
  matchSlackIntent: jest.fn()
}));

jest.mock("../../../src/modules/slack-intents/slack-intents.resolve", () => ({
  resolveDeterministicSlackIntents: jest.fn()
}));

jest.mock("../../../src/modules/slack-unsupported/slack-unsupported.repository", () => ({
  updateUnsupportedSlackQueryClarification: jest.fn().mockResolvedValue({})
}));

jest.mock("../../../src/modules/attendance/attendance.slack", () => ({
  openSlackModal: jest.fn(),
  postSlackMessage: jest.fn().mockResolvedValue({ ts: "1.1" }),
  respondToSlackResponseUrl: jest.fn(),
  updateSlackMessage: jest.fn()
}));

jest.mock("../../../src/modules/work/work.slack", () => ({
  resolveBranUserIdForSlackUser: jest.fn().mockResolvedValue("user-1")
}));

import { processSlackIntentClarifySubmit } from "../../../src/modules/slack-intents/slack-intents.actions";
import { getSlackIntentSuggestion, markSlackIntentSuggestion } from "../../../src/modules/slack-intents/slack-intents.repository";
import { runSlackIntent } from "../../../src/modules/slack-intents/slack-intents.dispatch";
import { matchSlackIntent } from "../../../src/modules/slack-intents/slack-intents.matcher";
import { resolveDeterministicSlackIntents } from "../../../src/modules/slack-intents/slack-intents.resolve";
import { updateUnsupportedSlackQueryClarification } from "../../../src/modules/slack-unsupported/slack-unsupported.repository";
import { postSlackMessage, updateSlackMessage } from "../../../src/modules/attendance/attendance.slack";

const suggestion = {
  id: "sug-1",
  slackUserId: "U1",
  branUserId: "user-1",
  channelId: "C1",
  channelType: "im",
  threadTs: null,
  messageTs: "100.1",
  replyTs: "100.2",
  originalText: "do the thing please",
  eventType: "message",
  isDm: true,
  candidatesJson: "[]",
  chosenIntent: null,
  status: "SUGGESTED",
  createdAt: new Date(),
  updatedAt: new Date()
};

describe("processSlackIntentClarifySubmit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSlackIntentSuggestion as jest.Mock).mockResolvedValue(suggestion);
  });

  it("rejects short clarifications", async () => {
    const result = await processSlackIntentClarifySubmit({
      slackUserId: "U1",
      suggestionId: "sug-1",
      clarificationText: "hi"
    });
    expect(result).toEqual({
      ok: false,
      fieldError: expect.stringMatching(/more detail/i)
    });
  });

  it("executes a deterministic single intent and marks reviewed", async () => {
    (resolveDeterministicSlackIntents as jest.Mock).mockReturnValue({
      mode: "single",
      intent: "list_tasks",
      hits: [{ intent: "list_tasks", precision: "strong", label: "List Tasks" }]
    });
    (runSlackIntent as jest.Mock).mockResolvedValue({ handled: true });

    const result = await processSlackIntentClarifySubmit({
      slackUserId: "U1",
      suggestionId: "sug-1",
      clarificationText: "list my tasks for this week"
    });

    expect(result).toEqual({ ok: true });
    expect(runSlackIntent).toHaveBeenCalledWith(
      "list_tasks",
      expect.objectContaining({ text: "list my tasks for this week" })
    );
    expect(markSlackIntentSuggestion).toHaveBeenCalledWith("sug-1", {
      status: "EXECUTED",
      chosenIntent: "list_tasks"
    });
    expect(updateUnsupportedSlackQueryClarification).toHaveBeenCalledWith(
      expect.objectContaining({
        clarificationText: "list my tasks for this week",
        resolvedIntent: "list_tasks",
        status: "REVIEWED"
      })
    );
    expect(matchSlackIntent).not.toHaveBeenCalled();
  });

  it("stores a feature request when no confident intent matches", async () => {
    (resolveDeterministicSlackIntents as jest.Mock).mockReturnValue({
      mode: "none",
      hits: []
    });
    (matchSlackIntent as jest.Mock).mockResolvedValue({
      mode: "generic",
      top3: [],
      confidence: 0.2
    });

    const result = await processSlackIntentClarifySubmit({
      slackUserId: "U1",
      suggestionId: "sug-1",
      clarificationText: "teleport me to the moon cafeteria"
    });

    expect(result).toEqual({ ok: true });
    expect(runSlackIntent).not.toHaveBeenCalled();
    expect(markSlackIntentSuggestion).toHaveBeenCalledWith("sug-1", { status: "DISMISSED" });
    expect(updateUnsupportedSlackQueryClarification).toHaveBeenCalledWith(
      expect.objectContaining({
        clarificationText: "teleport me to the moon cafeteria",
        resolvedIntent: null,
        reason: "user_clarified_feature_request",
        status: "NEW"
      })
    );
    expect(updateSlackMessage).toHaveBeenCalledWith(
      "C1",
      "100.2",
      expect.stringMatching(/feature request/i),
      []
    );
  });

  it("executes semantic auto matches without guessing on suggest-only", async () => {
    (resolveDeterministicSlackIntents as jest.Mock).mockReturnValue({
      mode: "none",
      hits: []
    });
    (matchSlackIntent as jest.Mock).mockResolvedValue({
      mode: "suggest",
      top3: [{ intent: "calendar", label: "Calendar", score: 0.7, source: "llm" }],
      confidence: 0.7
    });

    const result = await processSlackIntentClarifySubmit({
      slackUserId: "U1",
      suggestionId: "sug-1",
      clarificationText: "maybe a meeting or something"
    });

    expect(result).toEqual({ ok: true });
    expect(runSlackIntent).not.toHaveBeenCalled();
    expect(updateUnsupportedSlackQueryClarification).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "user_clarified_feature_request" })
    );
    expect(postSlackMessage).not.toHaveBeenCalled();
  });
});
