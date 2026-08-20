import {
  getSlackIntent,
  isSlackIntentId,
  SLACK_INTENT_CATALOG,
  SLACK_INTENT_IDS,
  slackIntentLabel
} from "../../../src/modules/slack-intents/slack-intents.catalog";

describe("slack-intents.catalog", () => {
  it("lists every planned intent with examples and a label", () => {
    expect([...SLACK_INTENT_IDS].sort()).toEqual([
      "add_task",
      "calendar",
      "competitors",
      "ideas",
      "list_tasks",
      "pods",
      "sentiment"
    ]);

    for (const id of SLACK_INTENT_IDS) {
      const entry = getSlackIntent(id);
      expect(entry).toBeDefined();
      expect(entry!.label.length).toBeGreaterThan(0);
      expect(entry!.description.length).toBeGreaterThan(0);
      expect(entry!.examples.length).toBeGreaterThanOrEqual(3);
      expect(slackIntentLabel(id)).toBe(entry!.label);
    }
  });

  it("marks ideas as DM-only", () => {
    expect(getSlackIntent("ideas")?.dmOnly).toBe(true);
    expect(getSlackIntent("add_task")?.dmOnly).toBeUndefined();
  });

  it("validates intent ids", () => {
    expect(isSlackIntentId("add_task")).toBe(true);
    expect(isSlackIntentId("not_real")).toBe(false);
  });

  it("keeps catalog length aligned with ids", () => {
    expect(SLACK_INTENT_CATALOG).toHaveLength(SLACK_INTENT_IDS.length);
  });
});
