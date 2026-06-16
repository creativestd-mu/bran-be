import request from "supertest";

import { app } from "../../../src/app";

describe("Vision routes", () => {
  it("registers /visions (auth required)", async () => {
    const response = await request(app).get("/en/v1/visions");

    expect(response.status).toBe(401);
    expect(response.body.error).not.toBe("Route not found");
  });

  it("blocks unauthenticated vision upload", async () => {
    const response = await request(app).post("/en/v1/visions");

    expect(response.status).toBe(401);
  });
});
