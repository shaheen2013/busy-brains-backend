import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ExceptionAccountsService } from "./exception-accounts.service";
import { ExceptionAccount } from "./entities/exception-account.entity";

describe("ExceptionAccountsService", () => {
  let service: ExceptionAccountsService;
  const repo = { findOne: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExceptionAccountsService,
        { provide: getRepositoryToken(ExceptionAccount), useValue: repo },
      ],
    }).compile();
    service = module.get(ExceptionAccountsService);
  });

  it("returns null without querying when the email is empty", async () => {
    await expect(service.findActive(undefined)).resolves.toBeNull();
    expect(repo.findOne).not.toHaveBeenCalled();
  });

  it("queries by trimmed lowercase email and only active entries", async () => {
    const row = { email: "e@x.com", childAllowed: 9, exceptionGiven: true };
    repo.findOne.mockResolvedValue(row);

    await expect(service.findActive("  E@X.com ")).resolves.toBe(row);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { email: "e@x.com", exceptionGiven: true },
    });
  });
});
