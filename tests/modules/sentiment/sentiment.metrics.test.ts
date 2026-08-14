import { enrichTotals, rollupSeries } from "../../../src/modules/sentiment/sentiment.metrics";
import { resolveSentimentRange } from "../../../src/modules/sentiment/sentiment.service";

describe("sentiment metrics", () => {
  it("computes share, net score, and dominant label", () => {
    const totals = enrichTotals(100, 5000, 2000, {
      positive: 40,
      neutral: 45,
      negative: 10,
      unknown: 5
    });

    expect(totals.sentimentShare.positive).toBe(40);
    expect(totals.sentimentShare.negative).toBe(10);
    expect(totals.netSentiment).toBe(0.3);
    expect(totals.dominant).toBe("neutral");
  });

  it("rolls multiple searches into one series point per date", () => {
    const { series, searches } = rollupSeries([
      {
        date: "2026-08-01",
        searchId: "1",
        searchName: "Brand",
        mentionCount: 10,
        reach: 100,
        estimatedViews: 50,
        sentiment: { positive: 6, neutral: 3, negative: 1, unknown: 0 }
      },
      {
        date: "2026-08-01",
        searchId: "2",
        searchName: "Campus",
        mentionCount: 5,
        reach: 40,
        estimatedViews: 20,
        sentiment: { positive: 1, neutral: 2, negative: 2, unknown: 0 }
      }
    ]);

    expect(searches).toHaveLength(2);
    expect(series).toHaveLength(1);
    expect(series[0].mentionCount).toBe(15);
    expect(series[0].reach).toBe(140);
    expect(series[0].sentiment.positive).toBe(7);
    expect(series[0].sentiment.negative).toBe(3);
  });
});

describe("resolveSentimentRange", () => {
  it("uses an explicit from/to window", () => {
    expect(resolveSentimentRange({ from: "2026-08-01", to: "2026-08-14" })).toEqual({
      from: "2026-08-01",
      to: "2026-08-14"
    });
  });

  it("rejects a reversed range", () => {
    expect(() => resolveSentimentRange({ from: "2026-08-14", to: "2026-08-01" })).toThrow(
      "`from` must be on or before `to`"
    );
  });
});
