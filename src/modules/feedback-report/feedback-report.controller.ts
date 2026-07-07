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
import { FeedbackReportService } from "./feedback-report.service";

@ApiTags("Feedback Report")
@ApiBearerAuth("Clerk-Bearer")
@Controller("child-feedback-report")
export class FeedbackReportController {
  constructor(private readonly feedbackReportService: FeedbackReportService) {}

  @Get(":childId")
  @ApiOperation({ summary: "Download a child's parent feedback report as PDF" })
  @ApiProduces("application/pdf")
  @ApiResponse({ status: 200, description: "Returns the feedback report PDF" })
  async downloadReport(
    @User() user: UserEntity,
    @Param("childId") childId: string,
    @Res() res: Response,
  ): Promise<void> {
    const pdf = await this.feedbackReportService.generatePdf(user.id, childId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="parent-feedback-report.pdf"',
    );
    res.setHeader("Content-Length", pdf.length);
    res.end(pdf);
  }

  @Get(":childId/preview")
  @ApiOperation({ summary: "Preview a child's parent feedback report as HTML" })
  @ApiProduces("text/html")
  @ApiResponse({ status: 200, description: "Returns the feedback report HTML" })
  async previewReport(
    @User() user: UserEntity,
    @Param("childId") childId: string,
    @Res() res: Response,
  ): Promise<void> {
    const html = await this.feedbackReportService.buildHtml(user.id, childId);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(html);
  }

  @Get(":childId/child")
  @ApiOperation({
    summary: "Download a child's own feedback (final quiz) report as PDF",
  })
  @ApiProduces("application/pdf")
  @ApiResponse({
    status: 200,
    description: "Returns the child feedback report PDF",
  })
  async downloadChildReport(
    @User() user: UserEntity,
    @Param("childId") childId: string,
    @Res() res: Response,
  ): Promise<void> {
    const pdf = await this.feedbackReportService.generateChildPdf(
      user.id,
      childId,
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="child-feedback-report.pdf"',
    );
    res.setHeader("Content-Length", pdf.length);
    res.end(pdf);
  }

  @Get(":childId/child/preview")
  @ApiOperation({
    summary: "Preview a child's own feedback (final quiz) report as HTML",
  })
  @ApiProduces("text/html")
  @ApiResponse({
    status: 200,
    description: "Returns the child feedback report HTML",
  })
  async previewChildReport(
    @User() user: UserEntity,
    @Param("childId") childId: string,
    @Res() res: Response,
  ): Promise<void> {
    const html = await this.feedbackReportService.buildChildHtml(
      user.id,
      childId,
    );
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(html);
  }
}
