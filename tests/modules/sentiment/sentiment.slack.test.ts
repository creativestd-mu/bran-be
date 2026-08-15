import {
  formatSentimentSlackMessage,
  looksLikeSentimentQuery
} from "../../../src/modules/sentiment/sentiment.slack";
import type { SentimentDashboard } from "../../../src/modules/sentiment/sentiment.types";

describe("looksLikeSentimentQuery", () => {
  it("detects brand sentiment phrasing and ignores tasks/attendance", () => {
    expect(looksLikeSentimentQuery("sentiment this week")).toBe(true);
    expect(looksLikeSentimentQuery("<@U123> brand mentions last month")).toBe(true);
    expect(looksLikeSentimentQuery("how is the brand perceived")).toBe(true);
    expect(looksLikeSentimentQuery("press coverage yesterday")).toBe(true);
    expect(looksLikeSentimentQuery("How have we done in the last week")).toBe(true);
    expect(looksLikeSentimentQuery("How has MU done this week")).toBe(true);
    expect(looksLikeSentimentQuery("How has MU done thsi week")).toBe(true);
    expect(looksLikeSentimentQuery("Masters Union coverage this week")).toBe(true);
    expect(looksLikeSentimentQuery("list my pending tasks")).toBe(false);
    expect(looksLikeSentimentQuery("eta 12:30")).toBe(false);
    expect(looksLikeSentimentQuery("wfh")).toBe(false);
  });
});

describe("formatSentimentSlackMessage", () => {
  const dashboard: SentimentDashboard = {
    timezone: "Asia/Kolkata",
    range: { from: "2026-08-01", to: "2026-08-07" },
    totals: {
      mentionCount: 142,
      reach: 1_250_000,
      estimatedViews: 800_000,
      sentiment: { positive: 40, neutral: 80, negative: 22, unknown: 0 },
      sentimentShare: { positive: 28.2, neutral: 56.3, negative: 15.5, unknown: 0 },
      netSentiment: 0.127,
      dominant: "neutral"
    },
    series: [],
    searches: []
  };

  it("renders volume, reach, and sentiment mix", () => {
    const text = formatSentimentSlackMessage(dashboard, "last 7 days (IST)");
    expect(text).toContain("Brand sentiment — last 7 days (IST)");
    expect(text).toContain("Mentions: *142*");
    expect(text).toContain("Reach: *1.3M*");
    expect(text).toContain("Net sentiment: *+13*");
    expect(text).toContain("Positive  40  (28.2%)");
  });

  it("explains an empty window", () => {
    const empty: SentimentDashboard = {
      ...dashboard,
      totals: {
        ...dashboard.totals,
        mentionCount: 0,
        reach: 0,
        estimatedViews: 0,
        sentiment: { positive: 0, neutral: 0, negative: 0, unknown: 0 },
        sentimentShare: { positive: 0, neutral: 0, negative: 0, unknown: 0 },
        netSentiment: 0,
        dominant: "none"
      }
    };
    expect(formatSentimentSlackMessage(empty, "today (IST)")).toContain(
      "No earned mentions stored"
    );
  });
});
