import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { docsAuthMiddleware } from "./config/docs-auth/docs-auth.middleware";
import { docsUiCss, docsUiScript } from "./config/docs-auth/swagger-ui-brand";

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

const API_VERSION = "1.0.0";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Gate every Swagger route behind the docs sign-in. config/env.ts makes the
  // credentials mandatory in production, so prod docs are never anonymous;
  // locally they stay open unless DOCS_USER/DOCS_PASSWORD are set.
  const docsUser = process.env.DOCS_USER;
  const docsPassword = process.env.DOCS_PASSWORD;
  const nodeEnv = process.env.NODE_ENV ?? "development";
  if (docsUser && docsPassword) {
    app.use(
      docsAuthMiddleware({
        user: docsUser,
        password: docsPassword,
        // Mixing the password in means rotating it signs everyone out.
        secret: `${process.env.CLERK_SECRET_KEY ?? ""}:${docsPassword}`,
        environment: nodeEnv,
        version: API_VERSION,
        // Every deployed environment (production, staging) terminates TLS.
        secureCookie: nodeEnv !== "development" && nodeEnv !== "test",
      }),
    );
  }

  // Swagger/OpenAPI setup
  const config = new DocumentBuilder()
    .setTitle("Busy Brains API")
    .setDescription("Busy Brains platform API documentation")
    .setVersion(API_VERSION)
    .addBearerAuth(
      { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      "Clerk-Bearer",
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document, {
    customSiteTitle: "Busy Brains API docs",
    customCss: docsUiCss,
    customJsStr: docsUiScript("/api/docs"),
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // Certificate download sends a large self-contained HTML payload
  // (inlined image data URIs) to be rendered server-side into a PDF.
  app.useBodyParser("json", { limit: "10mb" });

  // Enable CORS
  app.enableCors({
    origin: createCorsOriginChecker([
      "http://localhost:3000",
      "http://127.0.0.1:3000",

      "https://busy-brains.com.au",
      "https://www.busy-brains.com.au",

      "https://staging.busy-brains.com.au",
      "https://www.staging.busy-brains.com.au",
    ]),
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  });
  const port = process.env.PORT || 3001;

  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}`);
  console.log(`API Docs available at http://localhost:${port}/api/docs`);
}
void bootstrap();
