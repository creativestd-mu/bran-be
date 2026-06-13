import request from "supertest";

import { app } from "../../../src/app";

describe("Adhoc work routes", () => {
  it("registers the singular adhoc-work path (auth required)", async () => {
    const response = await request(app).get("/en/v1/adhoc-work");

    expect(response.status).toBe(401);
    expect(response.body.error).not.toBe("Route not found");
  });

  it("registers the plural adhoc-works alias (auth required)", async () => {
    const response = await request(app).get("/en/v1/adhoc-works");

    expect(response.status).toBe(401);
    expect(response.body.error).not.toBe("Route not found");
  });

  it("returns Route not found for an unknown adhoc path", async () => {
    const response = await request(app).get("/en/v1/adhoc");

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("Route not found");
  });
});
