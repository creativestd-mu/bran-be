import { looksLikePendingRepliesQuery } from "../../../src/modules/pending-replies/pending-replies.slack";

describe("pending reply Slack query detection", () => {
  it.each([
    "who do I need to reply to?",
    "what messages are waiting on me",
    "show my unanswered messages",
    "my replies",
    "myreplies",
    "which emails should I respond to",
    "who's waiting on me"
  ])("recognizes %s", (text) => {
    expect(looksLikePendingRepliesQuery(text)).toBe(true);
  });

  it.each([
    "reply to Ananya saying yes",
    "add a task to follow up with the team",
    "show my open tasks",
    "what is waiting for review"
  ])("does not claim unrelated message %s", (text) => {
    expect(looksLikePendingRepliesQuery(text)).toBe(false);
  });
});
