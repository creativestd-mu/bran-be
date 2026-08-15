import { formatBrandContentSummary, heuristicBrandContentSummary } from "../../../src/modules/sentiment/sentiment.summary";
import type { CompetitorContentImpact } from "../../../src/modules/competitor-content/competitor-content.types";

describe("heuristicBrandContentSummary", () => {
  it("returns null when there are no pieces", () => {
    const impact: CompetitorContentImpact = {
      timezone: "Asia/Kolkata",
      range: { from: "2026-08-10", to: "2026-08-16" },
      topN: 5,
      positive: [],
      negative: [],
      searches: []
    };
    expect(heuristicBrandContentSummary(impact)).toBeNull();
  });

  it("summarizes sides without dumping every caption", () => {
    const impact: CompetitorContentImpact = {
      timezone: "Asia/Kolkata",
      range: { from: "2026-08-10", to: "2026-08-16" },
      topN: 5,
      positive: [
        {
          searchId: "27811562",
          documentId: "p1",
          title: "Hyrox Delhi",
          snippet: "Masters’ Union presents Hyrox Delhi",
          url: "https://www.instagram.com/reel/pos/",
          sourceName: "Instagram",
          sentiment: "positive",
          engagement: 290,
          reach: 0,
          estimatedViews: 0,
          timezone: "Asia/Kolkata",
          rawPayload: {}
        }
      ],
      negative: [
        {
          searchId: "27811562",
          documentId: "n1",
          snippet: "High-risk investing only works when you understand the downside",
          url: "https://www.instagram.com/p/neg/",
          sourceName: "Instagram",
          sentiment: "negative",
          engagement: 3,
          reach: 0,
          estimatedViews: 0,
          timezone: "Asia/Kolkata",
          rawPayload: {}
        }
      ],
      searches: []
    };

    const summary = heuristicBrandContentSummary(impact);
    expect(summary?.positive).toContain("Instagram");
    expect(summary?.negative).toContain("High-risk investing");
    expect(formatBrandContentSummary(summary!, "this week")).toContain("*What worked for MU");
    expect(formatBrandContentSummary(summary!, "this week")).toContain("<https://www.instagram.com/reel/pos/|Example>");
  });
});
