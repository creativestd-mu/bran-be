import request from "supertest";

import { app } from "../../../src/app";

describe("KPI routes", () => {
  it("registers /kpis (auth required)", async () => {
    const response = await request(app).get("/en/v1/kpis");

    expect(response.status).toBe(401);
    expect(response.body.error).not.toBe("Route not found");
  });

  it("blocks unauthenticated KPI creation", async () => {
    const response = await request(app).post("/en/v1/kpis").send({
      userId: "00000000-0000-0000-0000-000000000001",
      title: "Test KPI",
      description: "Expected outcome"
    });

    expect(response.status).toBe(401);
  });
});
