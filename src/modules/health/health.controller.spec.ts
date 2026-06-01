import { Test, TestingModule } from "@nestjs/testing";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe("check()", () => {
    it('should return an object with status "ok"', () => {
      const result = controller.check();
      expect(result.status).toBe("ok");
    });

    it("should return an object with a timestamp string", () => {
      const result = controller.check();
      expect(typeof result.timestamp).toBe("string");
    });

    it("should return a timestamp in valid ISO 8601 format", () => {
      const result = controller.check();
      const parsed = new Date(result.timestamp);
      expect(parsed.toISOString()).toBe(result.timestamp);
    });

    it("should return a fresh timestamp close to now", () => {
      const before = Date.now();
      const result = controller.check();
      const after = Date.now();
      const ts = new Date(result.timestamp).getTime();
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it("should return an object with exactly status and timestamp keys", () => {
      const result = controller.check();
      expect(Object.keys(result)).toEqual(
        expect.arrayContaining(["status", "timestamp"]),
      );
    });
  });
});
