import { Module } from "@nestjs/common";
import { ToolkitReportController } from "./toolkit-report.controller";
import { ToolkitReportService } from "./toolkit-report.service";

@Module({
  controllers: [ToolkitReportController],
  providers: [ToolkitReportService],
})
export class ToolkitReportModule {}
