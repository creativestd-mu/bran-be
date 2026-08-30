import {
  buildDidYouMeanBlocks,
  buildIntentClarifyModal,
  didYouMeanActionId,
  formatDidYouMeanFallbackText,
  INTENT_CLARIFY_CALLBACK_ID,
  padTop3IntentCandidates,
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
  it("builds at most 3 intent buttons plus No, I meant something else", () => {
    const blocks = buildDidYouMeanBlocks({
      suggestionId: "sug-1",
      candidates
    }) as Array<{
      type: string;
      text?: { text?: string };
      elements?: Array<{ action_id?: string; value?: string; text?: { text?: string } }>;
    }>;

    const actions = blocks.find((b) => b.type === "actions");
    expect(actions?.elements).toBeDefined();
    expect(actions!.elements).toHaveLength(4);
    expect(actions!.elements![0].action_id).toBe(didYouMeanActionId("add_task"));
    expect(actions!.elements![1].action_id).toBe(didYouMeanActionId("list_tasks"));
    expect(actions!.elements![2].action_id).toBe(didYouMeanActionId("sentiment"));
    expect(actions!.elements![3].action_id).toBe(SLACK_DID_YOU_MEAN_NONE_ACTION);
    expect(actions!.elements![3].text?.text).toMatch(/meant something else/i);
    expect(actions!.elements!.every((el) => el.value === "sug-1")).toBe(true);
  });

  it("adds a Run all button for compound confirms", () => {
    const blocks = buildDidYouMeanBlocks({
      suggestionId: "sug-2",
      candidates: candidates.slice(0, 2),
      runAll: true
    }) as Array<{ type: string; elements?: Array<{ action_id?: string }> }>;

    const actions = blocks.find((b) => b.type === "actions");
    expect(actions!.elements![0].action_id).toBe(didYouMeanActionId("all"));
    expect(parseDidYouMeanActionId(didYouMeanActionId("all"))).toEqual({ kind: "all" });
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

  it("pads empty or short candidate lists to exactly 3", () => {
    const paddedEmpty = padTop3IntentCandidates([], { isDm: true });
    expect(paddedEmpty).toHaveLength(3);
    expect(paddedEmpty.map((c) => c.intent)).toEqual(["add_task", "list_tasks", "calendar"]);

    const paddedOne = padTop3IntentCandidates(
      [{ intent: "sentiment", label: "Brand Sentiment", score: 0.5, source: "llm" }],
      { isDm: true }
    );
    expect(paddedOne).toHaveLength(3);
    expect(paddedOne[0].intent).toBe("sentiment");
    expect(paddedOne.map((c) => c.intent)).toContain("add_task");
  });

  it("excludes DM-only intents when padding for channels", () => {
    const padded = padTop3IntentCandidates([], { isDm: false });
    expect(padded.every((c) => c.intent !== "ideas")).toBe(true);
    expect(padded).toHaveLength(3);
  });

  it("builds an intent clarify modal with private metadata", () => {
    const view = buildIntentClarifyModal({
      suggestionId: "sug-99",
      originalText: "please do the thing with the carousel"
    });
    expect(view.callback_id).toBe(INTENT_CLARIFY_CALLBACK_ID);
    expect(JSON.parse(String(view.private_metadata))).toEqual({ suggestionId: "sug-99" });
    expect(JSON.stringify(view)).toMatch(/What should Bran do/i);
  });
});
