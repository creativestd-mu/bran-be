const mockResolveUser = jest.fn();
const mockPostSlackMessage = jest.fn();
const mockStartSlackConnect = jest.fn();
const mockStartGmailConnect = jest.fn();
const mockSlackConnection = jest.fn();
const mockGmailConnection = jest.fn();
const mockStateFind = jest.fn();
const mockStateUpsert = jest.fn();
const mockStateUpdate = jest.fn();
const mockStateUpdateMany = jest.fn();

jest.mock("../../../src/lib/prisma", () => ({
  prisma: {
    slackConnection: { findUnique: mockSlackConnection },
    gmailConnection: { findUnique: mockGmailConnection },
    replyConnectionPromptState: {
      findUnique: mockStateFind,
      upsert: mockStateUpsert,
      update: mockStateUpdate,
      updateMany: mockStateUpdateMany
    }
  }
}));
jest.mock("../../../src/modules/attendance/attendance.slack", () => ({
  postSlackMessage: mockPostSlackMessage
}));
jest.mock("../../../src/modules/gmail/gmail.service", () => ({
  startGmailConnect: mockStartGmailConnect
}));
jest.mock("../../../src/modules/slack-replies/slack-replies.service", () => ({
  startSlackReplyConnect: mockStartSlackConnect
}));
jest.mock("../../../src/modules/work/work.slack", () => ({
  resolveBranUserIdForSlackUser: mockResolveUser
}));
jest.mock("../../../src/modules/pending-replies/pending-replies.slack", () => ({
  looksLikePendingRepliesQuery: (text: string) => text.toLowerCase().includes("reply")
}));

import {
  buildReplyConnectionPromptBlocks,
  connectionReminderThreshold,
  maybeSendReplyConnectionReminder
} from "../../../src/modules/pending-replies/pending-replies.connection-reminder";

describe("reply connection reminder cadence", () => {
  const now = new Date("2026-09-30T12:00:00.000Z");

  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveUser.mockResolvedValue("user-a");
    mockSlackConnection.mockResolvedValue(null);
    mockGmailConnection.mockResolvedValue({ status: "CONNECTED" });
    mockStateFind.mockResolvedValue({
      messagesSincePrompt: 4,
      lastMessageAt: new Date("2026-09-30T11:30:00.000Z")
    });
    mockStateUpsert.mockResolvedValue({ messagesSincePrompt: 5 });
    mockStateUpdateMany.mockResolvedValue({ count: 1 });
    mockStartSlackConnect.mockResolvedValue({ authorizationUrl: "https://example.com/slack" });
    mockStartGmailConnect.mockResolvedValue({ authorizationUrl: "https://example.com/gmail" });
    mockPostSlackMessage.mockResolvedValue({ ts: "1" });
  });

  it("uses five messages for reply context, seven for rapid use, and ten otherwise", () => {
    expect(connectionReminderThreshold({ text: "who should I reply to?", previousMessageAt: null, now }))
      .toBe(5);
    expect(connectionReminderThreshold({
      text: "show my tasks",
      previousMessageAt: new Date(now.getTime() - 5 * 60_000),
      now
    })).toBe(7);
    expect(connectionReminderThreshold({
      text: "show my tasks",
      previousMessageAt: new Date(now.getTime() - 60 * 60_000),
      now
    })).toBe(10);
  });

  it("renders only the missing service buttons", () => {
    const blocks = buildReplyConnectionPromptBlocks({
      gmailAuthorizationUrl: "https://example.com/gmail"
    });
    const serialized = JSON.stringify(blocks);
    expect(serialized).toContain("Connect Gmail");
    expect(serialized).not.toContain("Connect Slack");
  });

  it("sends the missing connection reminder when the contextual threshold is reached", async () => {
    const result = await maybeSendReplyConnectionReminder({
      channelId: "D1",
      slackUserId: "U1",
      text: "Who do I need to reply to?",
      now
    });

    expect(result).toEqual(expect.objectContaining({ sent: true, threshold: 5, missing: ["SLACK"] }));
    expect(mockStateUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ messagesSincePrompt: 0 })
    }));
    expect(mockPostSlackMessage).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mockPostSlackMessage.mock.calls[0][2])).toContain("Connect Slack");
  });

  it("does not remind before the threshold", async () => {
    mockStateUpsert.mockResolvedValue({ messagesSincePrompt: 4 });
    const result = await maybeSendReplyConnectionReminder({
      channelId: "D1",
      slackUserId: "U1",
      text: "Who do I need to reply to?",
      now
    });
    expect(result.sent).toBe(false);
    expect(mockPostSlackMessage).not.toHaveBeenCalled();
  });

  it("stops reminders when both services are connected", async () => {
    mockSlackConnection.mockResolvedValue({ status: "CONNECTED" });
    const result = await maybeSendReplyConnectionReminder({
      channelId: "D1",
      slackUserId: "U1",
      text: "Who do I need to reply to?",
      now
    });
    expect(result).toEqual(expect.objectContaining({ sent: false, reason: "all_connected" }));
    expect(mockStateUpsert).not.toHaveBeenCalled();
    expect(mockPostSlackMessage).not.toHaveBeenCalled();
  });
});
