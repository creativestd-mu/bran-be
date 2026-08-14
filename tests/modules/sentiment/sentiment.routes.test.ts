import request from "supertest";

import { app } from "../../../src/app";

describe("Sentiment routes", () => {
  it("registers /sentiment for the frontend module (auth required)", async () => {
    const versioned = await request(app).get("/en/v1/sentiment");
    const alias = await request(app).get("/api/sentiment");

    expect(versioned.status).toBe(401);
    expect(versioned.body.error).not.toBe("Route not found");
    expect(alias.status).toBe(401);
    expect(alias.body.error).not.toBe("Route not found");
  });
});
