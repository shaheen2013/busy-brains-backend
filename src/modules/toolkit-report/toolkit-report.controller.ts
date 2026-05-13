import { Controller, Get, Res } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiProduces,
  ApiResponse,
} from "@nestjs/swagger";
import type { Response } from "express";
import { Public } from "../auth/decorators/public.decorator";
import { ToolkitReportService } from "./toolkit-report.service";

@ApiTags("Toolkit Report")
@Controller("child-toolkit-report")
export class ToolkitReportController {
  constructor(private readonly toolkitReportService: ToolkitReportService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: "Download child toolkit report as PDF" })
  @ApiProduces("application/pdf")
  @ApiResponse({ status: 200, description: "Returns the toolkit report PDF" })
  async downloadReport(@Res() res: Response): Promise<void> {
    const pdf = await this.toolkitReportService.generatePdf();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="child-toolkit-report.pdf"',
    );
    res.setHeader("Content-Length", pdf.length);
    res.end(pdf);
  }
}
