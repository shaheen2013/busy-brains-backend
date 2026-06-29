import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import puppeteer from "puppeteer";
import { Child } from "../children/entities/child.entity";
import { DashboardService } from "../dashboard/dashboard.service";
import { buildToolkitReportHtml } from "../../common/toolkit-report-html.util";

@Injectable()
export class ToolkitReportService {
  constructor(
    private readonly dashboardService: DashboardService,
    @InjectRepository(Child)
    private readonly childRepository: Repository<Child>,
  ) {}

  async generatePdf(userId: string, childId: string): Promise<Buffer> {
    const html = await this.buildHtml(userId, childId);

    const executablePath =
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      process.env.CHROME_BIN ||
      undefined;

    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 794, height: 1123 });
      await page.setContent(html, { waitUntil: "load" });

      const contentHeight = await page.evaluate(
        () => document.documentElement.scrollHeight,
      );

      const pdf = await page.pdf({
        width: "794px",
        height: `${contentHeight}px`,
        printBackground: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  /**
   * Build the HTML string for a child's toolkit report.
   * Useful for preview endpoints or external rendering.
   */
  async buildHtml(userId: string, childId: string): Promise<string> {
    const child = await this.childRepository.findOne({
      where: { id: childId, userId },
    });
    if (!child) throw new ForbiddenException("Child not found");

    const dashboard = await this.dashboardService.getDashboard(
      userId,
      childId,
      [],
    );

    return buildToolkitReportHtml({
      assetsDir: __dirname + "/assets",
      childName: child.name,
      dashboard: dashboard,
    });
  }
}
