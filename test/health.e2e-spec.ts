import request from "supertest";
import { initApp, closeApp, getApp } from "./helpers/create-app";

describe("HealthController (e2e)", () => {
  beforeAll(async () => {
    await initApp();
  });

  afterAll(async () => {
    await closeApp();
  });

  describe("GET /health", () => {
    it("returns 200 without any authorization header", async () => {
      const res = await request(getApp().getHttpServer())
        .get("/health")
        .expect(200);

      expect(res.body.status).toBe("ok");
      expect(typeof res.body.timestamp).toBe("string");
      // should be a valid ISO 8601 timestamp
      expect(() => new Date(res.body.timestamp)).not.toThrow();
      expect(new Date(res.body.timestamp).toISOString()).toBe(
        res.body.timestamp,
      );
    });

    it("returns 200 even with an invalid/missing token (public route)", async () => {
      await request(getApp().getHttpServer())
        .get("/health")
        .set("Authorization", "Bearer invalid-token")
        .expect(200);
    });
  });
});
