import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Child } from "../children/entities/child.entity";
import { DashboardModule } from "../dashboard/dashboard.module";
import { ToolkitReportController } from "./toolkit-report.controller";
import { ToolkitReportService } from "./toolkit-report.service";

@Module({
  imports: [TypeOrmModule.forFeature([Child]), DashboardModule],
  controllers: [ToolkitReportController],
  providers: [ToolkitReportService],
})
export class ToolkitReportModule {}
