import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import puppeteer from "puppeteer";
import { Child } from "../children/entities/child.entity";
import { User } from "../users/entities/user.entity";
import { ChildFeedback } from "../feedback/entities/child-feedback.entity";
import { S3Service } from "../storage/s3.service";
import { StorageService } from "../storage/storage.service";
import { KitService } from "../kit/kit.service";
import { buildFeedbackReportHtml } from "../../common/feedback-report-html.util";
import { buildChildFeedbackReportHtml } from "../../common/child-feedback-report-html.util";

// Only one child feedback quiz exists today (module-6/quest-4's final quiz).
const CHILD_QUIZ_MODULE_LABEL = "Module 6 Completion";
const CHILD_QUIZ_RESPONSE_TYPE_LABEL = "Child Final Quiz";

@Injectable()
export class FeedbackReportService {
  private readonly logger = new Logger(FeedbackReportService.name);

  constructor(
    @InjectRepository(Child)
    private readonly childRepository: Repository<Child>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ChildFeedback)
    private readonly feedbackRepository: Repository<ChildFeedback>,
    private readonly s3Service: S3Service,
    private readonly storageService: StorageService,
    private readonly kitService: KitService,
  ) {}

  /**
   * Build the HTML string for a parent feedback report.
   */
  async buildHtml(userId: string, childId: string): Promise<string> {
    const child = await this.childRepository.findOne({
      where: { id: childId, userId },
      relations: { user: true },
    });
    if (!child) throw new ForbiddenException("Child not found");

    const feedback = await this.feedbackRepository.findOneBy({
      childId,
      byChild: false,
    });
    if (!feedback) throw new ForbiddenException("Parent feedback not found");

    const resource = await this.storageService.getResource("user", userId);
    const parentAvatarUrl =
      resource?.documents.find((d) => d.label === "profile")?.url ?? null;

    return buildFeedbackReportHtml({
      assetsDir: __dirname + "/assets",
      parentName: child.user.name,
      parentAvatarUrl,
      parentEmail: child.user.email,
      submittedAt: feedback.submittedAt,
      accountSince: child.user.createdAt,
      childName: child.name,
      childAge: child.age,
      feedback: feedback.feedback,
    });
  }

  /**
   * Build the HTML string for a child's own feedback (final quiz) report.
   */
  async buildChildHtml(userId: string, childId: string): Promise<string> {
    const child = await this.childRepository.findOne({
      where: { id: childId, userId },
      relations: { user: true },
    });
    if (!child) throw new ForbiddenException("Child not found");

    const feedback = await this.feedbackRepository.findOneBy({
      childId,
      byChild: true,
    });
    if (!feedback) throw new ForbiddenException("Child feedback not found");

    const resource = await this.storageService.getResource("user", userId);
    const parentAvatarUrl =
      resource?.documents.find((d) => d.label === "profile")?.url ?? null;
    const childAvatarUrl =
      child.avatar_type === "image" ? child.profileImage : null;

    return buildChildFeedbackReportHtml({
      childName: child.name,
      childAvatarUrl,
      moduleLabel: CHILD_QUIZ_MODULE_LABEL,
      responseTypeLabel: CHILD_QUIZ_RESPONSE_TYPE_LABEL,
      parentName: child.user.name,
      parentAvatarUrl,
      parentEmail: child.user.email,
      submittedAt: feedback.submittedAt,
      feedback: feedback.feedback,
    });
  }

  /**
   * Generate a PDF buffer from the feedback report HTML.
   */
  async generatePdf(userId: string, childId: string): Promise<Buffer> {
    const html = await this.buildHtml(userId, childId);
    return this.renderPdfFromHtml(html);
  }

  /**
   * Generate a PDF buffer from the child's own feedback report HTML.
   */
  async generateChildPdf(userId: string, childId: string): Promise<Buffer> {
    const html = await this.buildChildHtml(userId, childId);
    return this.renderPdfFromHtml(html);
  }

  private async renderPdfFromHtml(html: string): Promise<Buffer> {
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

      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(resolve)),
      );

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
   * Uploads a generated PDF buffer to S3 (replacing any previous one on the
   * feedback record) and returns the updated, saved ChildFeedback.
   */
  private async uploadPdfToFeedback(
    feedback: ChildFeedback,
    parentId: string,
    childId: string,
    folderPrefix: string,
    filenamePrefix: string,
    pdfBuffer: Buffer,
  ): Promise<ChildFeedback> {
    // Create a fake Multer.File for S3Service.upload
    const file: Express.Multer.File = {
      fieldname: "pdf",
      originalname: `${filenamePrefix}-${childId}.pdf`,
      encoding: "7bit",
      mimetype: "application/pdf",
      buffer: pdfBuffer,
      size: pdfBuffer.length,
      stream: null,
      destination: "",
      filename: `${filenamePrefix}-${childId}.pdf`,
      path: "",
    };

    const { key, url } = await this.s3Service.upload(
      file,
      `${folderPrefix}/${parentId}/${childId}`,
    );

    // Delete previous PDF if exists
    if (feedback.pdfKey) {
      try {
        await this.s3Service.delete(feedback.pdfKey);
      } catch (err) {
        this.logger.warn(
          `Failed to delete old feedback PDF: ${feedback.pdfKey}`,
          err,
        );
      }
    }

    feedback.pdfUrl = url;
    feedback.pdfKey = key;
    return this.feedbackRepository.save(feedback);
  }

  /**
   * Generate a feedback PDF, upload it to S3, update the feedback record with the URL,
   * and send the report via Kit email to mdmarufbinsalim@gmail.com.
   * Returns the updated ChildFeedback with pdfUrl.
   */
  async generateAndUploadPdf(
    userId: string,
    childId: string,
  ): Promise<ChildFeedback> {
    const child = await this.childRepository.findOneBy({ id: childId, userId });
    if (!child) throw new ForbiddenException("Child not found");

    const feedback = await this.feedbackRepository.findOneBy({
      childId,
      byChild: false,
    });
    if (!feedback) throw new ForbiddenException("Parent feedback not found");

    const pdfBuffer = await this.generatePdf(userId, childId);
    const saved = await this.uploadPdfToFeedback(
      feedback,
      userId,
      childId,
      "parent-feedback",
      "feedback-report",
      pdfBuffer,
    );

    // Send email via Kit
    try {
      await this.kitService.sendFeedbackReport(
        userId,
        child.name,
        saved.pdfUrl,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send feedback report email for child ${childId}`,
        err,
      );
      // Don't fail the PDF upload if email fails
    }

    return saved;
  }

  /**
   * Generate a child's own feedback PDF, upload it to S3, update the feedback
   * record with the URL, and send the report via Kit to the dedicated child
   * feedback sequence. Returns the updated ChildFeedback with pdfUrl.
   */
  async generateAndUploadChildPdf(
    userId: string,
    childId: string,
  ): Promise<ChildFeedback> {
    const child = await this.childRepository.findOneBy({ id: childId, userId });
    if (!child) throw new ForbiddenException("Child not found");

    const feedback = await this.feedbackRepository.findOneBy({
      childId,
      byChild: true,
    });
    if (!feedback) throw new ForbiddenException("Child feedback not found");

    const pdfBuffer = await this.generateChildPdf(userId, childId);
    const saved = await this.uploadPdfToFeedback(
      feedback,
      userId,
      childId,
      "child-feedback",
      "child-feedback-report",
      pdfBuffer,
    );

    // Send email via Kit
    try {
      await this.kitService.sendChildFeedbackReport(
        userId,
        child.name,
        saved.pdfUrl,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send child feedback report email for child ${childId}`,
        err,
      );
      // Don't fail the PDF upload if email fails
    }

    return saved;
  }
}
