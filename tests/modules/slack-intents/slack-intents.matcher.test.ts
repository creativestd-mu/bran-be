import {
  decideIntentMatchMode,
  type IntentCandidate
} from "../../../src/modules/slack-intents/slack-intents.matcher";

function candidate(
  intent: IntentCandidate["intent"],
  score: number,
  source: IntentCandidate["source"] = "catalog"
): IntentCandidate {
  return { intent, label: intent, score, source };
}

describe("decideIntentMatchMode", () => {
  it("auto-runs when score and margin clear thresholds", () => {
    const decision = decideIntentMatchMode(
      [candidate("add_task", 0.9), candidate("list_tasks", 0.7)],
      { autoThreshold: 0.82, suggestThreshold: 0.6, margin: 0.08 }
    );
    expect(decision.mode).toBe("auto");
    if (decision.mode === "auto") {
      expect(decision.intent).toBe("add_task");
    }
  });

  it("auto-runs confirmed fast-path even below auto threshold margin", () => {
    const decision = decideIntentMatchMode(
      [candidate("sentiment", 0.91, "confirmed"), candidate("competitors", 0.9)],
      {
        autoThreshold: 0.95,
        suggestThreshold: 0.6,
        margin: 0.2,
        confirmedFastPath: 0.9
      }
    );
    expect(decision.mode).toBe("auto");
    if (decision.mode === "auto") {
      expect(decision.intent).toBe("sentiment");
    }
  });

  it("suggests when confident enough but not auto", () => {
    const decision = decideIntentMatchMode(
      [candidate("add_task", 0.75), candidate("list_tasks", 0.72)],
      { autoThreshold: 0.82, suggestThreshold: 0.6, margin: 0.08 }
    );
    expect(decision.mode).toBe("suggest");
    if (decision.mode === "suggest") {
      expect(decision.top3).toHaveLength(2);
      expect(decision.top3[0].intent).toBe("add_task");
    }
  });

  it("falls back to generic when scores are low", () => {
    const decision = decideIntentMatchMode(
      [candidate("pods", 0.4), candidate("ideas", 0.3)],
      { autoThreshold: 0.82, suggestThreshold: 0.6, margin: 0.08 }
    );
    expect(decision.mode).toBe("generic");
  });

  it("returns generic with empty candidates", () => {
    const decision = decideIntentMatchMode([]);
    expect(decision.mode).toBe("generic");
    expect(decision.confidence).toBe(0);
  });
});
