import { INestApplication, UnauthorizedException, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getDataSourceToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { AppModule } from "../../src/app.module";
import { AuthService } from "../../src/modules/auth/auth.service";
import { S3Service } from "../../src/modules/storage/s3.service";
import { KitService } from "../../src/modules/kit/kit.service";

/**
 * In E2E tests, send:  Authorization: Bearer test-<userId>
 * The mock AuthService resolves the token to { sub: userId }
 * so the ClerkGuard looks up the real User row from the test DB.
 */
export const TEST_TOKEN_PREFIX = "test-";
export const authHeader = (userId: string) =>
  `Bearer ${TEST_TOKEN_PREFIX}${userId}`;

export const mockS3 = {
  upload: jest.fn().mockResolvedValue({
    key: "test/mock-key.jpg",
    url: "https://s3.test/mock-key.jpg",
  }),
  delete: jest.fn().mockResolvedValue(undefined),
};

export const mockKit = {
  notifyModule1Completed: jest.fn().mockResolvedValue(undefined),
  sendAccountDeletionOtp: jest.fn().mockResolvedValue(undefined),
  sendChildDeletionOtp: jest.fn().mockResolvedValue(undefined),
  subscribeToSequence: jest.fn().mockResolvedValue(undefined),
};

let app: INestApplication;
let dataSource: DataSource;
let moduleRef: TestingModule;

export async function initApp(): Promise<{
  app: INestApplication;
  dataSource: DataSource;
}> {
  moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AuthService)
    .useValue({
      verifyToken: (token: string) => {
        if (token.startsWith(TEST_TOKEN_PREFIX)) {
          return Promise.resolve({
            sub: token.slice(TEST_TOKEN_PREFIX.length),
          });
        }
        return Promise.reject(new UnauthorizedException("Invalid token"));
      },
      getClerkClient: () => ({}),
    })
    .overrideProvider(S3Service)
    .useValue(mockS3)
    .overrideProvider(KitService)
    .useValue(mockKit)
    .compile();

  app = moduleRef.createNestApplication({ rawBody: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.init();

  dataSource = moduleRef.get<DataSource>(getDataSourceToken());
  return { app, dataSource };
}

export async function closeApp(): Promise<void> {
  await app?.close();
}

export function getApp(): INestApplication {
  return app;
}

export function getDataSource(): DataSource {
  return dataSource;
}
