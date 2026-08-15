import {
  isRelevantCompetitorContent,
  normalizeCompetitorDocuments
} from "../../../src/modules/competitor-content/competitor-content.normalize";

describe("normalizeCompetitorDocuments", () => {
  it("extracts impactful positive documents and skips zero-engagement rows", () => {
    const payload = {
      result: {
        document_count: 3,
        documents: [
          {
            id: "doc-1",
            title: "Scaler raises funding",
            url: "https://example.com/scaler-funding",
            content: {
              title: "Scaler raises funding",
              body: "Scaler School of Business announced a new round…"
            },
            source: {
              name: "Economic Times",
              type: "news",
              metrics: { reach: 800000 }
            },
            author: { name: "Reporter A" },
            published_date: "2026-08-10T08:00:00Z",
            enrichments: { sentiment: "positive" },
            metrics: { engagement: { total: 12500 }, estimated_views: 400000 }
          },
          {
            id: "doc-2",
            content: { body: "quiet mention with no traction" },
            sentiment: "positive",
            metrics: { engagement: 0, reach: 0, estimated_views: 0 }
          },
          {
            meta: { document_id: "doc-3" },
            content: {
              headline: "Ashoka University campus news",
              opening_text: "Students celebrated…",
              matched_url: "https://example.com/ashoka"
            },
            source: { title: "The Hindu" },
            metrics: { engagement: 900, reach: 12000 },
            enrichment: { sentiment: "positive" },
            datetime: "2026-08-11T12:00:00Z"
          }
        ]
      }
    };

    const records = normalizeCompetitorDocuments(payload, {
      searchId: "28994734",
      searchName: "Bran MU Competitors",
      timezone: "Asia/Kolkata",
      sentiment: "positive"
    });

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      searchId: "28994734",
      documentId: "doc-1",
      title: "Scaler raises funding",
      url: "https://example.com/scaler-funding",
      sourceName: "Economic Times",
      sentiment: "positive",
      engagement: 12500,
      reach: 800000
    });
    expect(records[1]).toMatchObject({
      documentId: "doc-3",
      title: "Ashoka University campus news",
      url: "https://example.com/ashoka",
      sourceName: "The Hindu",
      engagement: 900,
      reach: 12000
    });
  });

  it("falls back to requested sentiment when document sentiment is missing", () => {
    const payload = {
      documents: [
        {
          id: "neg-1",
          content: {
            title: "Complaint thread",
            body: "Users unhappy with Newton School of Technology…"
          },
          metrics: { engagement: 50, reach: 1000 }
        }
      ]
    };

    const records = normalizeCompetitorDocuments(payload, {
      searchId: "28994734",
      timezone: "Asia/Kolkata",
      sentiment: "negative"
    });

    expect(records).toHaveLength(1);
    expect(records[0].sentiment).toBe("negative");
    expect(records[0].snippet).toContain("Users unhappy");
  });

  it("rejects stemming and substring false positives from the saved search", () => {
    const payload = {
      result: {
        documents: [
          {
            id: "false-scaler",
            content: {
              body: "Custom RC mini truck #scalerc #scaler #customrc"
            },
            metrics: { engagement: { total: 900 } },
            source: { name: "Pinterest" }
          },
          {
            id: "false-upgrad",
            content: {
              body: "Every pet deserves an upgraded luxury dog bed"
            },
            metrics: { engagement: { total: 500 } },
            source: { name: "Pinterest" }
          }
        ]
      }
    };

    const records = normalizeCompetitorDocuments(payload, {
      searchId: "28994734",
      timezone: "Asia/Kolkata",
      sentiment: "positive"
    });

    expect(records).toEqual([]);
    expect(
      isRelevantCompetitorContent({
        title: "Luxury dog bed",
        snippet: "Every pet deserves an upgrad"
      })
    ).toBe(false);
    expect(
      isRelevantCompetitorContent({
        title: "upGrad Campus launches a new programme"
      })
    ).toBe(true);
  });
});
