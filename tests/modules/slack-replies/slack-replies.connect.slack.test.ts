import {
  buildSlackConnectBlocks,
  looksLikeSlackConnectQuery,
  SLACK_CONNECT_OAUTH_ACTION_ID
} from "../../../src/modules/slack-replies/slack-replies.connect.slack";
import { filterHitsForChannel } from "../../../src/modules/slack-intents/slack-intents.resolve";

describe("Slack DM connection flow", () => {
  it.each([
    "connect my Slack",
    "link my Slack account",
    "authorize Slack",
    "reconnect my Slack to Bran",
    "is my Slack linked?"
  ])("detects %s", (text) => {
    expect(looksLikeSlackConnectQuery(text)).toBe(true);
  });

  it.each([
    "connect me with Amisha on Slack",
    "show my unanswered Slack messages",
    "Slack sentiment this week"
  ])("does not claim unrelated text %s", (text) => {
    expect(looksLikeSlackConnectQuery(text)).toBe(false);
  });

  it("builds a private authorization button with the short-lived URL", () => {
    const url = "https://slack.com/oauth/v2/authorize?state=signed";
    const blocks = buildSlackConnectBlocks(url) as Array<{
      type: string;
      elements?: Array<{ action_id?: string; url?: string }>;
    }>;
    const actions = blocks.find((block) => block.type === "actions");
    expect(actions?.elements).toEqual([
      expect.objectContaining({ action_id: SLACK_CONNECT_OAUTH_ACTION_ID, url })
    ]);
  });

  it("filters the connect intent out of channel routing", () => {
    const hits = [
      { intent: "connect_slack" as const, precision: "envelope" as const, label: "Connect Slack" }
    ];
    expect(filterHitsForChannel(hits, false)).toEqual([]);
    expect(filterHitsForChannel(hits, true)).toEqual(hits);
  });
});
