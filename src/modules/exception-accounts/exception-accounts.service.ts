import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ExceptionAccount } from "./entities/exception-account.entity";

@Injectable()
export class ExceptionAccountsService {
  constructor(
    @InjectRepository(ExceptionAccount)
    private readonly exceptionAccountRepository: Repository<ExceptionAccount>,
  ) {}

  /**
   * Returns the exception entry for this email, or null when there is none
   * or `exceptionGiven` is false (such rows are inert).
   */
  async findActive(
    email: string | null | undefined,
  ): Promise<ExceptionAccount | null> {
    if (!email) return null;
    return this.exceptionAccountRepository.findOne({
      where: { email: email.trim().toLowerCase(), exceptionGiven: true },
    });
  }
}
