import { padTop3IntentCandidates } from "../../../src/modules/slack-intents/slack-intents.reply";
import { formatUnsupportedSlackReply } from "../../../src/modules/slack-unsupported/slack-unsupported.service";

describe("unsupported Slack reply copy", () => {
  it("explains mass-assign only works in channels", () => {
    const reply = formatUnsupportedSlackReply("mass_assign_dm");
    expect(reply).toMatch(/channel/i);
    expect(reply).toMatch(/everyone/i);
    expect(reply).not.toMatch(/logged this/i);
  });

  it("explains over-cap mass assign", () => {
    const reply = formatUnsupportedSlackReply("mass_assign_over_cap");
    expect(reply).toMatch(/too many/i);
  });

  it("gives a generic unsupported reply and notes logging", () => {
    const reply = formatUnsupportedSlackReply("no_handler");
    expect(reply).toMatch(/don.t support that request yet/i);
    expect(reply).toMatch(/logged this/i);
    expect(reply).toMatch(/listing\/creating tasks/i);
  });
});

describe("intent suggestion padding for unresolved asks", () => {
  it("always yields three options even when matcher returns nothing", () => {
    const top3 = padTop3IntentCandidates([], { isDm: true, limit: 3 });
    expect(top3).toHaveLength(3);
    expect(new Set(top3.map((c) => c.intent)).size).toBe(3);
  });

  it("keeps semantic ranking ahead of catalog padding", () => {
    const top3 = padTop3IntentCandidates(
      [
        { intent: "review", label: "Reviews", score: 0.55, source: "llm" },
        { intent: "pods", label: "Pods / Inspiration", score: 0.5, source: "catalog" }
      ],
      { isDm: true }
    );
    expect(top3[0].intent).toBe("review");
    expect(top3[1].intent).toBe("pods");
    expect(top3).toHaveLength(3);
  });
});
