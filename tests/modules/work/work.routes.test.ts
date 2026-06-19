import request from "supertest";

import { app } from "../../../src/app";

const sampleId = "c5054a76-db4d-4fe9-a7a0-a17f92337a87";

describe("Work routes", () => {
  it("registers DELETE /work/:id (auth required)", async () => {
    const response = await request(app).delete(`/en/v1/work/${sampleId}`);

    expect(response.status).toBe(401);
    expect(response.body.error).not.toBe("Route not found");
  });

  it("registers GET /work/:id (auth required)", async () => {
    const response = await request(app).get(`/en/v1/work/${sampleId}`);

    expect(response.status).toBe(401);
    expect(response.body.error).not.toBe("Route not found");
  });
});
