import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import puppeteer from "puppeteer";
import { Child } from "../children/entities/child.entity";
import { ChildModule } from "../children/entities/child-module.entity";
import { ChildQuest } from "../children/entities/child-quest.entity";
import { ChildScreen } from "../children/entities/child-screen.entity";
import { buildCertificateHtml } from "../../common/certificate-html.util";

const CERTIFICATE_MODULE_NO = 6;
const CERTIFICATE_QUEST_NO = 4;
const CERTIFICATE_SCREEN_NO = 1;

@Injectable()
export class CertificateReportService {
  constructor(
    @InjectRepository(Child)
    private readonly childRepository: Repository<Child>,
    @InjectRepository(ChildModule)
    private readonly childModuleRepository: Repository<ChildModule>,
    @InjectRepository(ChildQuest)
    private readonly childQuestRepository: Repository<ChildQuest>,
    @InjectRepository(ChildScreen)
    private readonly childScreenRepository: Repository<ChildScreen>,
  ) {}

  async generatePdf(userId: string, childId: string): Promise<Buffer> {
    const html = await this.buildHtml(userId, childId);
    return this.renderPdfFromDocument(html);
  }

  /**
   * Render a client-captured certificate HTML fragment (inline styles,
   * inlined image data URIs) into a PDF. The child/completion checks are
   * still enforced server-side; only the visual markup comes from the client.
   */
  async generatePdfFromHtml(
    userId: string,
    childId: string,
    html: string,
  ): Promise<Buffer> {
    await this.assertCertificateAvailable(userId, childId);
    return this.renderPdfFromDocument(this.wrapCapturedHtml(html));
  }

  private async renderPdfFromDocument(html: string): Promise<Buffer> {
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
      await page.setViewport({ width: 1000, height: 700 });
      await page.setContent(html, { waitUntil: "load" });

      // `load` doesn't wait for @font-face swaps, so measuring scrollHeight
      // right away can undershoot the final layout once fonts finish
      // rendering, overflowing content onto a second PDF page.
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(resolve)),
      );

      const contentHeight = await page.evaluate(
        () => document.documentElement.scrollHeight,
      );

      const pdf = await page.pdf({
        printBackground: true,
        width: "1000px",
        height: `${contentHeight}px`,
        margin: {
          top: "0.5in",
          right: "0.5in",
          bottom: "0.5in",
          left: "0.5in",
        },
      });

      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private wrapCapturedHtml(bodyHtml: string): string {
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Nunito+Sans:wght@400;500;600;700;800;900&family=Dancing+Script:wght@600;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Nunito", sans-serif;
    background: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
  }

  private async assertCertificateAvailable(
    userId: string,
    childId: string,
  ): Promise<void> {
    const child = await this.childRepository.findOne({
      where: { id: childId, userId },
    });
    if (!child) throw new ForbiddenException("Child not found");

    const completedAt = await this.getAdventureCompletedAt(childId);
    if (!completedAt) {
      throw new ForbiddenException("Certificate not yet available");
    }
  }

  /**
   * Build the HTML string for a child's Brain Boss certificate.
   * Useful for preview endpoints or external rendering.
   */
  async buildHtml(userId: string, childId: string): Promise<string> {
    const child = await this.childRepository.findOne({
      where: { id: childId, userId },
    });
    if (!child) throw new ForbiddenException("Child not found");

    const completedAt = await this.getAdventureCompletedAt(childId);
    if (!completedAt) {
      throw new ForbiddenException("Certificate not yet available");
    }

    return buildCertificateHtml({
      assetsDir: __dirname + "/assets",
      childName: child.name,
      completedAt,
    });
  }

  private async getAdventureCompletedAt(childId: string): Promise<Date | null> {
    const childModule = await this.childModuleRepository.findOne({
      where: { childId, moduleNo: CERTIFICATE_MODULE_NO },
    });
    if (!childModule) return null;

    const childQuest = await this.childQuestRepository.findOne({
      where: { moduleId: childModule.id, questNo: CERTIFICATE_QUEST_NO },
    });
    if (!childQuest) return null;

    const childScreen = await this.childScreenRepository.findOne({
      where: { questId: childQuest.id, screenNo: CERTIFICATE_SCREEN_NO },
    });
    if (!childScreen || !childScreen.isCompleted) return null;

    return childScreen.completedAt;
  }
}
