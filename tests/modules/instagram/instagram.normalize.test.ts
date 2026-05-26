import { normalizeMeltwaterInstagramPayload } from "../../../src/modules/instagram/instagram.normalize";

describe("normalizeMeltwaterInstagramPayload", () => {
  it("normalizes Meltwater response items into internal records", () => {
    const payload = {
      data: {
        items: [
          {
            id: "post-1",
            mentions: 4,
            impressions: 1200,
            reach: 900,
            engagement: 85,
            sentiment: "positive",
            publishedAt: "2026-04-01T00:00:00.000Z"
          }
        ]
      }
    };

    const result = normalizeMeltwaterInstagramPayload(payload);

    expect(result).toHaveLength(1);
    expect(result[0].sourceItemId).toBe("post-1");
    expect(result[0].mentionCount).toBe(4);
    expect(result[0].estimatedViews).toBe(1200);
    expect(result[0].estimatedReach).toBe(900);
    expect(result[0].engagementCount).toBe(85);
    expect(result[0].engagementRate).toBe(0);
    expect(result[0].sentiment).toBe("positive");
  });

  it("falls back to defaults when optional fields are missing", () => {
    const payload = {
      items: [
        {
          id: "post-2"
        }
      ]
    };

    const result = normalizeMeltwaterInstagramPayload(payload);

    expect(result).toHaveLength(1);
    expect(result[0].mentionCount).toBe(1);
    expect(result[0].estimatedViews).toBe(0);
    expect(result[0].estimatedReach).toBe(0);
    expect(result[0].engagementCount).toBe(0);
    expect(result[0].engagementRate).toBe(0);
    expect(result[0].sentiment).toBe("unknown");
  });

  it("normalizes Meltwater owned top_posts payload (linkedin shape)", () => {
    const payload = {
      count: 1,
      posts: [
        {
          post_id: "urn:li:share:123",
          created_at: "2026-04-01T10:00:00+0000",
          metrics: {
            comment_count: 5,
            impressions: 1500,
            post_impressions_organic_unique: 900
          }
        }
      ]
    };

    const result = normalizeMeltwaterInstagramPayload(payload);

    expect(result).toHaveLength(1);
    expect(result[0].sourceItemId).toBe("urn:li:share:123");
    expect(result[0].estimatedViews).toBe(1500);
    expect(result[0].estimatedReach).toBe(900);
    expect(result[0].engagementCount).toBe(5);
    expect(result[0].engagementRate).toBe(0);
    expect(result[0].mentionCount).toBe(1);
  });

  it("normalizes Meltwater owned top_posts payload (youtube shape)", () => {
    const payload = {
      count: 1,
      posts: [
        {
          post_id: "yt-post-1",
          created_at: "2026-04-01T10:00:00+0000",
          metrics: {
            view_count: 2200,
            unique_viewers: 1800,
            engagements: 140,
            engagement_rate: 6.4
          }
        }
      ]
    };

    const result = normalizeMeltwaterInstagramPayload(payload);

    expect(result).toHaveLength(1);
    expect(result[0].sourceItemId).toBe("yt-post-1");
    expect(result[0].estimatedViews).toBe(2200);
    expect(result[0].estimatedReach).toBe(1800);
    expect(result[0].engagementCount).toBe(140);
    expect(result[0].engagementRate).toBe(6.4);
  });
});
