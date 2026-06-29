import { Controller, Get, Param, Res } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import type { Response } from "express";
import { User } from "../auth/decorators/user.decorator";
import { User as UserEntity } from "../users/entities/user.entity";
import { ToolkitReportService } from "./toolkit-report.service";

@ApiTags("Toolkit Report")
@ApiBearerAuth("Clerk-Bearer")
@Controller("child-toolkit-report")
export class ToolkitReportController {
  constructor(private readonly toolkitReportService: ToolkitReportService) {}

  @Get(":childId")
  @ApiOperation({ summary: "Download a child's toolkit report as PDF" })
  @ApiProduces("application/pdf")
  @ApiResponse({ status: 200, description: "Returns the toolkit report PDF" })
  async downloadReport(
    @User() user: UserEntity,
    @Param("childId") childId: string,
    @Res() res: Response,
  ): Promise<void> {
    const pdf = await this.toolkitReportService.generatePdf(user.id, childId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="child-toolkit-report.pdf"',
    );
    res.setHeader("Content-Length", pdf.length);
    res.end(pdf);
  }

  @Get(":childId/preview")
  @ApiOperation({ summary: "Preview a child's toolkit report as HTML" })
  @ApiProduces("text/html")
  @ApiResponse({ status: 200, description: "Returns the toolkit report HTML" })
  async previewReport(
    @User() user: UserEntity,
    @Param("childId") childId: string,
    @Res() res: Response,
  ): Promise<void> {
    const html = await this.toolkitReportService.buildHtml(user.id, childId);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(html);
  }
}
