import request from "supertest";

import { app } from "../../../src/app";

describe("Navigation routes", () => {
  it("registers /navigation (auth required)", async () => {
    const response = await request(app).get("/en/v1/navigation/page-visits");

    expect(response.status).toBe(401);
    expect(response.body.error).not.toBe("Route not found");
  });

  it("blocks unauthenticated nav search logging", async () => {
    const response = await request(app).post("/en/v1/navigation/search-logs").send({
      query: "log hours"
    });

    expect(response.status).toBe(401);
  });

  it("blocks unauthenticated page visit recording", async () => {
    const response = await request(app).post("/en/v1/navigation/page-visits").send({
      path: "/tasks"
    });

    expect(response.status).toBe(401);
  });
});
