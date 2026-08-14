import { mergeEarnedDailyRecords } from "../../../src/modules/meltwater-earned/meltwater-earned.normalize";

describe("mergeEarnedDailyRecords", () => {
  it("merges daily volume, sentiment, and reach into one row per date", () => {
    const volumePayload = {
      result: {
        document_count: 150,
        analysis: [
          {
            key: "2026-08-01T00:00:00",
            document_count: 100,
            analysis: [
              { key: "positive", document_count: 40 },
              { key: "neutral", document_count: 45 },
              { key: "negative", document_count: 10 },
              { key: "unknown", document_count: 5 }
            ]
          },
          {
            key: "2026-08-02T00:00:00",
            document_count: 50,
            analysis: [{ key: "neutral", document_count: 50 }]
          }
        ]
      }
    };

    const reachPayload = {
      result: {
        analysis: [
          {
            key: "2026-08-01T00:00:00",
            document_count: 100,
            analysis: {
              reach: { sum: 25000, avg: 250 },
              estimated_views: { sum: 18000, avg: 180 }
            }
          },
          {
            key: "2026-08-02T00:00:00",
            document_count: 50,
            analysis: {
              reach: { sum: 8000 },
              estimated_views: { sum: 4000 }
            }
          }
        ]
      }
    };

    const result = mergeEarnedDailyRecords(volumePayload, reachPayload, {
      searchId: "2382415",
      searchName: "Masters Union",
      timezone: "Asia/Kolkata"
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      searchId: "2382415",
      date: "2026-08-01",
      mentionCount: 100,
      reach: 25000,
      estimatedViews: 18000,
      sentiment: { positive: 40, neutral: 45, negative: 10, unknown: 5 }
    });
    expect(result[1]).toMatchObject({
      date: "2026-08-02",
      mentionCount: 50,
      reach: 8000,
      estimatedViews: 4000,
      sentiment: { positive: 0, neutral: 50, negative: 0, unknown: 0 }
    });
  });

  it("reads measure sums from array-shaped nested analysis", () => {
    const volumePayload = {
      result: {
        analysis: [{ key: "2026-08-03", document_count: 12, analysis: [] }]
      }
    };
    const reachPayload = {
      result: {
        analysis: [
          {
            key: "2026-08-03",
            analysis: [
              { key: "reach", sum: 900 },
              { measure: "estimated_views", total: 300 }
            ]
          }
        ]
      }
    };

    const result = mergeEarnedDailyRecords(volumePayload, reachPayload, {
      searchId: "1",
      timezone: "UTC"
    });

    expect(result[0].reach).toBe(900);
    expect(result[0].estimatedViews).toBe(300);
  });

  it("keeps volume rows when reach payload is empty", () => {
    const volumePayload = {
      result: {
        analysis: [{ key: "2026-08-04T00:00:00", document_count: 7, analysis: [] }]
      }
    };

    const result = mergeEarnedDailyRecords(volumePayload, {}, {
      searchId: "1",
      timezone: "Asia/Kolkata"
    });

    expect(result).toHaveLength(1);
    expect(result[0].mentionCount).toBe(7);
    expect(result[0].reach).toBe(0);
  });
});
