import {
  parseSlackRouterResponse,
  shouldBlockRouterResult
} from "../../../src/modules/slack-router/slack-router";
import {
  buildSlackRouterCacheKey,
  clearSlackRouterCache,
  getSlackRouterCache,
  setSlackRouterCache,
  setSlackRouterCacheEntryForTest,
  slackRouterCacheSize
} from "../../../src/modules/slack-router/slack-router.cache";

describe("slack-router response parsing", () => {
  it("parses a valid router JSON payload", () => {
    const parsed = parseSlackRouterResponse(
      JSON.stringify({
        safe: true,
        category: "ok",
        intent: "list_tasks",
        confidence: 0.91,
        alternatives: ["add_task", "calendar"],
        listRange: { from: "2026-09-24", to: "2026-09-24", label: "today" }
      })
    );
    expect(parsed).toEqual({
      safe: true,
      category: "ok",
      intent: "list_tasks",
      confidence: 0.91,
      alternatives: ["add_task", "calendar"],
      listRange: { from: "2026-09-24", to: "2026-09-24", label: "today" }
    });
  });

  it("returns null for invalid JSON", () => {
    expect(parseSlackRouterResponse("not json")).toBeNull();
    expect(parseSlackRouterResponse('{"intent":"nope"}')).toBeNull();
  });

  it("keeps unsafe hard-block categories blockable", () => {
    const parsed = parseSlackRouterResponse(
      JSON.stringify({
        safe: false,
        category: "illegal",
        intent: "none",
        confidence: 0.2,
        alternatives: [],
        listRange: null
      })
    );
    expect(parsed?.safe).toBe(false);
    expect(shouldBlockRouterResult(parsed!)).toBe(true);
  });

  it("does not hard-block category other when unsafe", () => {
    const parsed = parseSlackRouterResponse(
      JSON.stringify({
        safe: false,
        category: "other",
        intent: "none",
        confidence: 0.1,
        alternatives: [],
        listRange: null
      })
    );
    expect(shouldBlockRouterResult(parsed!)).toBe(false);
  });

  it("preserves low confidence values", () => {
    const parsed = parseSlackRouterResponse(
      JSON.stringify({
        safe: true,
        category: "ok",
        intent: "sentiment",
        confidence: 0.45,
        alternatives: ["competitors"],
        listRange: null
      })
    );
    expect(parsed?.confidence).toBe(0.45);
    expect(parsed?.intent).toBe("sentiment");
  });

  it("clears listRange when intent is not list_tasks", () => {
    const parsed = parseSlackRouterResponse(
      JSON.stringify({
        safe: true,
        category: "ok",
        intent: "add_task",
        confidence: 0.9,
        alternatives: [],
        listRange: { from: "2026-09-24", to: "2026-09-24", label: "today" }
      })
    );
    expect(parsed?.listRange).toBeNull();
  });
});

describe("slack-router cache", () => {
  beforeEach(() => {
    clearSlackRouterCache();
  });

  it("uses different keys for different IST dates", () => {
    const day1 = buildSlackRouterCacheKey({
      text: "list my tasks today",
      isDm: true,
      now: new Date("2026-09-24T08:00:00.000Z")
    });
    const day2 = buildSlackRouterCacheKey({
      text: "list my tasks today",
      isDm: true,
      now: new Date("2026-09-25T08:00:00.000Z")
    });
    expect(day1).not.toEqual(day2);
  });

  it("uses different keys for dm vs channel", () => {
    const now = new Date("2026-09-24T08:00:00.000Z");
    const dm = buildSlackRouterCacheKey({ text: "sentiment this week", isDm: true, now });
    const ch = buildSlackRouterCacheKey({ text: "sentiment this week", isDm: false, now });
    expect(dm).not.toEqual(ch);
  });

  it("expires entries after TTL", () => {
    const key = buildSlackRouterCacheKey({
      text: "my reviews",
      isDm: true,
      now: new Date("2026-09-24T08:00:00.000Z")
    });
    const value = {
      safe: true,
      category: "ok" as const,
      intent: "review" as const,
      confidence: 0.9,
      alternatives: [],
      listRange: null
    };
    setSlackRouterCache(key, value);
    expect(getSlackRouterCache(key)).toEqual(value);
    expect(slackRouterCacheSize()).toBe(1);

    setSlackRouterCacheEntryForTest(key, value, Date.now() - 1);
    expect(getSlackRouterCache(key)).toBeNull();
  });
});
