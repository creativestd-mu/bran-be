import {
  formatCompetitorSlackMessage,
  looksLikeCompetitorQuery
} from "../../../src/modules/competitor-content/competitor-content.slack";
import type { CompetitorContentImpact } from "../../../src/modules/competitor-content/competitor-content.types";

describe("looksLikeCompetitorQuery", () => {
  it("detects competitor intent and named-competitor coverage phrasing", () => {
    expect(looksLikeCompetitorQuery("competitor coverage this week")).toBe(true);
    expect(looksLikeCompetitorQuery("<@U123> what are competitors saying")).toBe(true);
    expect(looksLikeCompetitorQuery("Newton sentiment last month")).toBe(true);
    expect(looksLikeCompetitorQuery("Scaler press coverage")).toBe(true);
    expect(looksLikeCompetitorQuery("upGrad news")).toBe(true);
    expect(looksLikeCompetitorQuery("sentiment this week")).toBe(false);
    expect(looksLikeCompetitorQuery("list my pending tasks")).toBe(false);
    expect(looksLikeCompetitorQuery("eta 12:30")).toBe(false);
    expect(looksLikeCompetitorQuery("Scaler")).toBe(false);
  });
});

describe("formatCompetitorSlackMessage", () => {
  const impact: CompetitorContentImpact = {
    timezone: "Asia/Kolkata",
    range: { from: "2026-08-01", to: "2026-08-07" },
    topN: 5,
    positive: [
      {
        searchId: "28994734",
        documentId: "p1",
        title: "Scaler raises funding",
        url: "https://example.com/pos",
        sourceName: "ET",
        publishedAt: "2026-08-05T10:00:00.000Z",
        sentiment: "positive",
        engagement: 12000,
        reach: 500000,
        estimatedViews: 0,
        timezone: "Asia/Kolkata",
        rawPayload: {}
      }
    ],
    negative: [
      {
        searchId: "28994734",
        documentId: "n1",
        title: "Newton student complaint",
        url: "https://example.com/neg",
        sourceName: "Reddit",
        publishedAt: "2026-08-06T10:00:00.000Z",
        sentiment: "negative",
        engagement: 800,
        reach: 20000,
        estimatedViews: 0,
        timezone: "Asia/Kolkata",
        rawPayload: {}
      }
    ],
    searches: [{ searchId: "28994734", searchName: "Bran MU Competitors" }]
  };

  it("renders positive and negative sections with links", () => {
    const text = formatCompetitorSlackMessage(impact, "last 7 days (IST)");
    expect(text).toContain("Competitor impactful content — last 7 days (IST)");
    expect(text).toContain("Positive (highest engagement)");
    expect(text).toContain("Negative (highest engagement)");
    expect(text).toContain("<https://example.com/pos|Scaler raises funding>");
    expect(text).toContain("<https://example.com/neg|Newton student complaint>");
  });

  it("returns null when nothing notable exists", () => {
    const empty: CompetitorContentImpact = {
      ...impact,
      positive: [],
      negative: []
    };
    expect(formatCompetitorSlackMessage(empty, "last 7 days (IST)")).toBeNull();
  });
});
