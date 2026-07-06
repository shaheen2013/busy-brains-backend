import { Body, Controller, Get, Param, Post, Res } from "@nestjs/common";
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
import { CertificateReportService } from "./certificate-report.service";
import { DownloadCertificateDto } from "./dto/download-certificate.dto";

@ApiTags("Certificate Report")
@ApiBearerAuth("Clerk-Bearer")
@Controller("child-certificate")
export class CertificateReportController {
  constructor(
    private readonly certificateReportService: CertificateReportService,
  ) {}

  @Post(":childId")
  @ApiOperation({
    summary:
      "Render client-captured certificate HTML into a PDF and download it",
  })
  @ApiProduces("application/pdf")
  @ApiResponse({ status: 200, description: "Returns the certificate PDF" })
  async downloadCertificate(
    @User() user: UserEntity,
    @Param("childId") childId: string,
    @Body() body: DownloadCertificateDto,
    @Res() res: Response,
  ): Promise<void> {
    const pdf = await this.certificateReportService.generatePdfFromHtml(
      user.id,
      childId,
      body.html,
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="brain-boss-certificate.pdf"',
    );
    res.setHeader("Content-Length", pdf.length);
    res.end(pdf);
  }

  @Get(":childId/preview")
  @ApiOperation({ summary: "Preview a child's Brain Boss certificate as HTML" })
  @ApiProduces("text/html")
  @ApiResponse({ status: 200, description: "Returns the certificate HTML" })
  async previewCertificate(
    @User() user: UserEntity,
    @Param("childId") childId: string,
    @Res() res: Response,
  ): Promise<void> {
    const html = await this.certificateReportService.buildHtml(
      user.id,
      childId,
    );
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(html);
  }
}
