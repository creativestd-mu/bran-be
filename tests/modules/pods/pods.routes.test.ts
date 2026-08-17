import request from "supertest";

import { app } from "../../../src/app";
import { normalizeApifyItem } from "../../../src/modules/pods/pods.apify";
import {
  defaultUrlForPlatform,
  normalizeSocialHandle
} from "../../../src/modules/pods/pods.service";
import {
  formatPodSlackMessage,
  looksLikePodQuery,
  resolvePodSlackRange
} from "../../../src/modules/pods/pods.slack";

describe("Pods routes", () => {
  it("registers /pods (auth required)", async () => {
    const response = await request(app).get("/en/v1/pods");

    expect(response.status).toBe(401);
    expect(response.body.error).not.toBe("Route not found");
  });

  it("blocks unauthenticated pod creation", async () => {
    const response = await request(app).post("/en/v1/pods").send({
      name: "Growth",
      verticalId: "00000000-0000-4000-8000-000000000001",
      headUserId: "00000000-0000-4000-8000-000000000002"
    });

    expect(response.status).toBe(401);
  });

  it("registers projects create with podId requirement (auth required)", async () => {
    const response = await request(app).post("/en/v1/projects").send({
      name: "Campaign",
      podId: "00000000-0000-4000-8000-000000000003"
    });

    expect(response.status).toBe(401);
  });

  it("protects pods-social cron without secret", async () => {
    const response = await request(app).get("/api/cron/pods-social");
    expect([401, 500]).toContain(response.status);
  });
});

describe("Pods helpers", () => {
  it("normalizes handles and default URLs", () => {
    expect(normalizeSocialHandle("@GrowthPod")).toBe("growthpod");
    expect(defaultUrlForPlatform("INSTAGRAM", "growthpod")).toContain("instagram.com/growthpod");
    expect(defaultUrlForPlatform("X", "growthpod")).toContain("x.com/growthpod");
  });

  it("normalizes Apify items for Instagram", () => {
    const normalized = normalizeApifyItem(
      "INSTAGRAM",
      {
        id: "post-1",
        url: "https://instagram.com/p/abc",
        caption: "Hello",
        likesCount: 10,
        commentsCount: 2,
        timestamp: "2026-08-01T10:00:00.000Z"
      },
      "growthpod"
    );

    expect(normalized?.platformPostId).toBe("post-1");
    expect(normalized?.metrics.likes).toBe(10);
    expect(normalized?.caption).toBe("Hello");
  });

  it("detects Slack pod queries and ranges", () => {
    expect(looksLikePodQuery('show pod "Growth" top IP posts this week')).toBe(true);
    expect(looksLikePodQuery("what is inspiring pod Fiction on Instagram")).toBe(true);
    expect(looksLikePodQuery("sentiment this week")).toBe(false);

    const range = resolvePodSlackRange("pod Growth posts this week");
    expect(range.label.toLowerCase()).toContain("week");
  });

  it("formats Slack pod messages with empty and populated states", () => {
    const empty = formatPodSlackMessage({
      podName: "Growth",
      rangeLabel: "last 7 days (IST)",
      kind: "OWNED_IP",
      platform: "INSTAGRAM",
      posts: []
    });
    expect(empty).toContain("No stored posts");

    const filled = formatPodSlackMessage({
      podName: "Growth",
      rangeLabel: "last 7 days (IST)",
      kind: "INSPIRATION",
      posts: [
        {
          title: "Cool reel",
          caption: null,
          url: "https://instagram.com/p/abc",
          publishedAt: new Date(),
          metrics: { likes: 1200, comments: 40 },
          account: {
            kind: "INSPIRATION",
            platform: "INSTAGRAM",
            handle: "someone",
            lastSyncedAt: new Date()
          }
        }
      ]
    });
    expect(filled).toContain("Cool reel");
    expect(filled).toContain("1.2k likes");
  });
});
