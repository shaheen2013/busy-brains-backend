import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ExceptionAccount } from "./entities/exception-account.entity";
import { ExceptionAccountsService } from "./exception-accounts.service";

@Module({
  imports: [TypeOrmModule.forFeature([ExceptionAccount])],
  providers: [ExceptionAccountsService],
  exports: [ExceptionAccountsService],
})
export class ExceptionAccountsModule {}
