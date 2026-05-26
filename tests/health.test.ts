import request from "supertest";

import { app } from "../src/app";

describe("Versioned and language aware API", () => {
  it("returns health status for a supported language", async () => {
    const response = await request(app).get("/en/v1/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.language).toBe("en");
    expect(response.body.version).toBe("v1");
  });

  it("rejects unsupported language", async () => {
    const response = await request(app).get("/xx/v1/health");

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});
