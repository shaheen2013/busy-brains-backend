import { SetMetadata } from "@nestjs/common";
import { IS_PUBLIC_KEY, Public } from "./public.decorator";

describe("Public decorator", () => {
  describe("IS_PUBLIC_KEY constant", () => {
    it("should equal 'isPublic'", () => {
      expect(IS_PUBLIC_KEY).toBe("isPublic");
    });
  });

  describe("@Public()", () => {
    it("should set metadata with key 'isPublic' and value true on a class", () => {
      @Public()
      class TestController {}

      const metadata = Reflect.getMetadata(IS_PUBLIC_KEY, TestController);
      expect(metadata).toBe(true);
    });

    it("should set metadata with key 'isPublic' and value true on a method", () => {
      class TestController {
        @Public()
        publicEndpoint() {}
      }

      const metadata = Reflect.getMetadata(
        IS_PUBLIC_KEY,
        TestController.prototype.publicEndpoint,
      );
      expect(metadata).toBe(true);
    });

    it("should produce the same decorator as SetMetadata(IS_PUBLIC_KEY, true)", () => {
      @Public()
      class WithPublic {}

      @SetMetadata(IS_PUBLIC_KEY, true)
      class WithSetMetadata {}

      const metaPublic = Reflect.getMetadata(IS_PUBLIC_KEY, WithPublic);
      const metaSetMetadata = Reflect.getMetadata(
        IS_PUBLIC_KEY,
        WithSetMetadata,
      );

      expect(metaPublic).toBe(metaSetMetadata);
    });
  });
});
