import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Child } from "../children/entities/child.entity";
import { ChildModule as ChildModuleEntity } from "../children/entities/child-module.entity";
import { ChildQuest } from "../children/entities/child-quest.entity";
import { ChildScreen } from "../children/entities/child-screen.entity";
import { CertificateReportController } from "./certificate-report.controller";
import { CertificateReportService } from "./certificate-report.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Child,
      ChildModuleEntity,
      ChildQuest,
      ChildScreen,
    ]),
  ],
  controllers: [CertificateReportController],
  providers: [CertificateReportService],
})
export class CertificateReportModule {}
