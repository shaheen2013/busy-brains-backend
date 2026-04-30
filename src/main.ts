import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";

/**
 * Normalize origin input (string | string[]) -> string[]
 */
function normalizeOrigins(origins: string | string[] | undefined): string[] {
  if (!origins) return [];
  return Array.isArray(origins) ? origins : [origins];
}

/**
 * CORS checker supporting:
 *  - exact match (protocol + hostname + port)
 *  - wildcard subdomains (*.domain.com)
 *  - wildcard ports (*.localhost:3000)
 *  - domain only
 *  - full wildcard (*)
 */
function createCorsOriginChecker(origins: string[] | undefined) {
  const allowedOrigins = normalizeOrigins(origins);

  return (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => {
    if (!origin) return callback(null, true); // allow non-browser requests like Postman

    if (allowedOrigins.includes("*")) return callback(null, true); // full wildcard

    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      return callback(new Error(`Invalid origin: ${origin}`), false);
    }

    const originHost = url.hostname; // e.g., "technova.localhost"
    const originPort = url.port; // e.g., "3000" or empty string for default
    const originProto = url.protocol; // "http:"

    const isAllowed = allowedOrigins.some((allowed) => {
      // full wildcard
      if (allowed === "*") return true;

      // exact match with protocol + host + port
      if (allowed === origin) return true;

      // parse allowed origin
      let allowedHost = allowed;
      let allowedPort = "";
      let allowedProto = "";

      // Split protocol
      if (allowed.includes("://")) {
        const protoSplit = allowed.split("://");
        allowedProto = protoSplit[0] + ":";
        allowedHost = protoSplit[1];
      }

      // Split port
      if (allowedHost.includes(":")) {
        const parts = allowedHost.split(":");
        allowedHost = parts[0];
        allowedPort = parts[1];
      }

      // Wildcard subdomain
      if (allowedHost.startsWith("*")) {
        const domain = allowedHost.replace("*", "");
        if (
          originHost.endsWith(domain) &&
          (allowedPort === "" || allowedPort === originPort) &&
          (allowedProto === "" || allowedProto === originProto)
        ) {
          return true;
        }
      }

      // Exact hostname + optional port + optional protocol
      if (
        allowedHost === originHost &&
        (allowedPort === "" || allowedPort === originPort) &&
        (allowedProto === "" || allowedProto === originProto)
      ) {
        return true;
      }

      return false;
    });

    callback(
      isAllowed ? null : new Error(`CORS blocked: ${origin}`),
      isAllowed,
    );
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  // Swagger/OpenAPI setup
  const config = new DocumentBuilder()
    .setTitle("Busy Brains API")
    .setDescription("Busy Brains platform API documentation")
    .setVersion("1.0.0")
    .addBearerAuth(
      { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      "Clerk-Bearer",
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // Enable CORS
  app.enableCors({
    origin: createCorsOriginChecker(["*"]),
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  });
  const port = process.env.PORT || 3001;

  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}`);
  console.log(`API Docs available at http://localhost:${port}/api/docs`);
}
void bootstrap();
