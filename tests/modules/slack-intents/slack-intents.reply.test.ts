import {
  buildDidYouMeanBlocks,
  didYouMeanActionId,
  formatDidYouMeanFallbackText,
  parseDidYouMeanActionId,
  SLACK_DID_YOU_MEAN_NONE_ACTION
} from "../../../src/modules/slack-intents/slack-intents.reply";
import type { IntentCandidate } from "../../../src/modules/slack-intents/slack-intents.matcher";

const candidates: IntentCandidate[] = [
  { intent: "add_task", label: "Add a Task", score: 0.8, source: "catalog" },
  { intent: "list_tasks", label: "List Tasks", score: 0.7, source: "catalog" },
  { intent: "sentiment", label: "Brand Sentiment", score: 0.65, source: "llm" },
  { intent: "pods", label: "Pods / Inspiration", score: 0.5, source: "catalog" }
];

describe("slack-intents.reply", () => {
  it("builds at most 3 intent buttons plus None of these", () => {
    const blocks = buildDidYouMeanBlocks({
      suggestionId: "sug-1",
      candidates
    }) as Array<{ type: string; elements?: Array<{ action_id?: string; value?: string }> }>;

    const actions = blocks.find((b) => b.type === "actions");
    expect(actions?.elements).toBeDefined();
    expect(actions!.elements).toHaveLength(4);
    expect(actions!.elements![0].action_id).toBe(didYouMeanActionId("add_task"));
    expect(actions!.elements![1].action_id).toBe(didYouMeanActionId("list_tasks"));
    expect(actions!.elements![2].action_id).toBe(didYouMeanActionId("sentiment"));
    expect(actions!.elements![3].action_id).toBe(SLACK_DID_YOU_MEAN_NONE_ACTION);
    expect(actions!.elements!.every((el) => el.value === "sug-1")).toBe(true);
  });

  it("parses did-you-mean action ids", () => {
    expect(parseDidYouMeanActionId(didYouMeanActionId("add_task"))).toEqual({
      kind: "intent",
      intent: "add_task"
    });
    expect(parseDidYouMeanActionId(SLACK_DID_YOU_MEAN_NONE_ACTION)).toEqual({
      kind: "none"
    });
    expect(parseDidYouMeanActionId("work_complete")).toBeNull();
    expect(parseDidYouMeanActionId("bran_didyoumean_not_real")).toBeNull();
  });

  it("formats fallback text with labels", () => {
    const text = formatDidYouMeanFallbackText(candidates);
    expect(text).toContain("Add a Task");
    expect(text).toContain("List Tasks");
    expect(text).toContain("Brand Sentiment");
  });
});
