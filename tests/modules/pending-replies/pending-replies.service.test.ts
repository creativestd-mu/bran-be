const mockListPendingRepliesForUser = jest.fn();

jest.mock("../../../src/modules/pending-replies/pending-replies.repository", () => ({
  listPendingRepliesForUser: mockListPendingRepliesForUser
}));

import {
  formatMessageTimestamp,
  formatPendingRepliesForUser,
  summarizeReplyNeed
} from "../../../src/modules/pending-replies/pending-replies.service";

describe("pending reply presentation", () => {
  beforeEach(() => mockListPendingRepliesForUser.mockReset());

  it("formats the source message timestamp rather than an ingestion age", () => {
    expect(formatMessageTimestamp(new Date("2026-09-30T10:45:00.000Z"), "Asia/Kolkata"))
      .toMatch(/30 Sept?, 4:15\s*pm IST/i);
  });

  it("summarizes a direct Slack question", () => {
    expect(summarizeReplyNeed({
      source: "SLACK",
      subject: null,
      snippet: "<@U0B93U8HESG> When will you update your Bran task list?"
    })).toBe("Confirm when you will update your bran task list.");
  });

  it("summarizes a bare shared link without echoing it", () => {
    const summary = summarizeReplyNeed({
      source: "SLACK",
      subject: null,
      snippet: "https://docs.google.com/spreadsheets/d/private-id/edit"
    });
    expect(summary).toBe("Review the shared link and respond if needed.");
    expect(summary).not.toContain("private-id");
  });

  it("uses the Gmail subject instead of the full body", () => {
    expect(summarizeReplyNeed({
      source: "GMAIL",
      subject: "Re: Campaign approval",
      snippet: "A very long email body that should not be repeated"
    })).toBe("Respond about “Campaign approval”.");
  });

  it("requests only two weeks, keeps newest-first output, and omits raw bodies", async () => {
    const now = new Date("2026-09-30T12:00:00.000Z");
    mockListPendingRepliesForUser.mockResolvedValue([
      {
        id: "newer",
        source: "SLACK",
        conversationKind: "SLACK_THREAD",
        senderName: "Sudeep",
        senderAddress: null,
        subject: null,
        snippet: "<@U_SELF> When will you update your Bran task list?",
        channelName: "tech-team",
        lastMessageAt: new Date("2026-09-30T10:45:00.000Z")
      },
      {
        id: "older",
        source: "GMAIL",
        conversationKind: "EMAIL_THREAD",
        senderName: "Asha",
        senderAddress: "asha@example.com",
        subject: "Re: Campaign approval",
        snippet: "PRIVATE RAW BODY SHOULD NOT APPEAR",
        channelName: null,
        lastMessageAt: new Date("2026-09-29T09:00:00.000Z")
      }
    ]);

    const output = await formatPendingRepliesForUser("user-a", now);
    expect(mockListPendingRepliesForUser).toHaveBeenCalledWith(
      "user-a",
      10,
      new Date("2026-09-16T12:00:00.000Z")
    );
    expect(output.indexOf("Sudeep")).toBeLessThan(output.indexOf("Asha"));
    expect(output).toContain("Sent:");
    expect(output).toContain("Respond about “Campaign approval”.");
    expect(output).not.toContain("PRIVATE RAW BODY SHOULD NOT APPEAR");
  });
});
