import request from "supertest";

import { app } from "../../../src/app";

describe("Thumbnail generator routes", () => {
  it("registers /utilities/thumbnail-generator (auth required)", async () => {
    const response = await request(app).get("/en/v1/utilities/thumbnail-generator");

    expect(response.status).toBe(401);
    expect(response.body.error).not.toBe("Route not found");
  });

  it("blocks unauthenticated thumbnail generation", async () => {
    const response = await request(app).post("/en/v1/utilities/thumbnail-generator/generate");

    expect(response.status).toBe(401);
  });
});
