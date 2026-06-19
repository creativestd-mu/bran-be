import request from "supertest";

import { app } from "../../../src/app";

describe("Inventory routes", () => {
  it("registers /inventory (auth required)", async () => {
    const response = await request(app).get("/en/v1/inventory");

    expect(response.status).toBe(401);
    expect(response.body.error).not.toBe("Route not found");
  });

  it("blocks unauthenticated inventory creation", async () => {
    const response = await request(app).post("/en/v1/inventory").send({
      name: "Sony FX3"
    });

    expect(response.status).toBe(401);
  });
});
