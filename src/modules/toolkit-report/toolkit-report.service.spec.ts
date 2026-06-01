import { Test, TestingModule } from "@nestjs/testing";
import { ToolkitReportService } from "./toolkit-report.service";

// ---------------------------------------------------------------------------
// Mock puppeteer before importing the service so the module-level import is
// replaced before any code runs.
// ---------------------------------------------------------------------------
const mockPdfFn = jest.fn().mockResolvedValue(Buffer.from("pdf-bytes"));
const mockEvaluateFn = jest.fn().mockResolvedValue(1200);
const mockSetContentFn = jest.fn().mockResolvedValue(undefined);
const mockSetViewportFn = jest.fn().mockResolvedValue(undefined);
const mockPageCloseFn = jest.fn().mockResolvedValue(undefined);

const mockPage = {
  setViewport: mockSetViewportFn,
  setContent: mockSetContentFn,
  evaluate: mockEvaluateFn,
  pdf: mockPdfFn,
  close: mockPageCloseFn,
};

const mockBrowserCloseFn = jest.fn().mockResolvedValue(undefined);
const mockNewPageFn = jest.fn().mockResolvedValue(mockPage);

const mockBrowser = {
  newPage: mockNewPageFn,
  close: mockBrowserCloseFn,
};

const mockPuppeteerLaunch = jest.fn().mockResolvedValue(mockBrowser);

jest.mock("puppeteer", () => ({
  __esModule: true,
  default: {
    launch: (...args: any[]) => mockPuppeteerLaunch(...args),
  },
}));

// ---------------------------------------------------------------------------
// Mock fs.readFileSync so the service doesn't need real asset files on disk.
// ---------------------------------------------------------------------------
jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  readFileSync: jest.fn().mockReturnValue(Buffer.from("fake-asset-data")),
}));

describe("ToolkitReportService", () => {
  let service: ToolkitReportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ToolkitReportService],
    }).compile();

    service = module.get<ToolkitReportService>(ToolkitReportService);

    jest.clearAllMocks();

    // Re-attach default resolved values after clearAllMocks
    mockPuppeteerLaunch.mockResolvedValue(mockBrowser);
    mockNewPageFn.mockResolvedValue(mockPage);
    mockSetViewportFn.mockResolvedValue(undefined);
    mockSetContentFn.mockResolvedValue(undefined);
    mockEvaluateFn.mockResolvedValue(1200);
    mockPdfFn.mockResolvedValue(Buffer.from("pdf-bytes"));
    mockBrowserCloseFn.mockResolvedValue(undefined);
  });

  describe("generatePdf()", () => {
    it("should return a Buffer", async () => {
      const result = await service.generatePdf();
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it("should launch puppeteer with headless: true and sandbox disabled", async () => {
      await service.generatePdf();

      expect(mockPuppeteerLaunch).toHaveBeenCalledTimes(1);
      const launchArgs = mockPuppeteerLaunch.mock.calls[0][0];
      expect(launchArgs.headless).toBe(true);
      expect(launchArgs.args).toContain("--no-sandbox");
      expect(launchArgs.args).toContain("--disable-setuid-sandbox");
    });

    it("should open a new page on the browser", async () => {
      await service.generatePdf();
      expect(mockNewPageFn).toHaveBeenCalledTimes(1);
    });

    it("should set the viewport to 794x1123", async () => {
      await service.generatePdf();
      expect(mockSetViewportFn).toHaveBeenCalledWith({
        width: 794,
        height: 1123,
      });
    });

    it("should set page content and wait for load", async () => {
      await service.generatePdf();
      expect(mockSetContentFn).toHaveBeenCalledWith(expect.any(String), {
        waitUntil: "load",
      });
    });

    it("should evaluate scrollHeight for content height", async () => {
      await service.generatePdf();
      expect(mockEvaluateFn).toHaveBeenCalledTimes(1);
    });

    it("should generate a pdf with width 794px and print background", async () => {
      await service.generatePdf();

      const pdfArgs = mockPdfFn.mock.calls[0][0];
      expect(pdfArgs.width).toBe("794px");
      expect(pdfArgs.printBackground).toBe(true);
    });

    it("should generate a pdf with zero margins", async () => {
      await service.generatePdf();

      const pdfArgs = mockPdfFn.mock.calls[0][0];
      expect(pdfArgs.margin).toEqual({
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      });
    });

    it("should use the dynamic content height for the pdf height", async () => {
      const contentHeight = 2048;
      mockEvaluateFn.mockResolvedValue(contentHeight);

      await service.generatePdf();

      const pdfArgs = mockPdfFn.mock.calls[0][0];
      expect(pdfArgs.height).toBe(`${contentHeight}px`);
    });

    it("should close the browser after generating the pdf", async () => {
      await service.generatePdf();
      expect(mockBrowserCloseFn).toHaveBeenCalledTimes(1);
    });

    it("should close the browser even if pdf generation throws", async () => {
      mockPdfFn.mockRejectedValue(new Error("pdf error"));

      await expect(service.generatePdf()).rejects.toThrow("pdf error");
      expect(mockBrowserCloseFn).toHaveBeenCalledTimes(1);
    });

    it("should use PUPPETEER_EXECUTABLE_PATH when set", async () => {
      process.env.PUPPETEER_EXECUTABLE_PATH = "/usr/bin/chromium";

      await service.generatePdf();

      const launchArgs = mockPuppeteerLaunch.mock.calls[0][0];
      expect(launchArgs.executablePath).toBe("/usr/bin/chromium");

      delete process.env.PUPPETEER_EXECUTABLE_PATH;
    });

    it("should fall back to CHROME_BIN when PUPPETEER_EXECUTABLE_PATH is not set", async () => {
      delete process.env.PUPPETEER_EXECUTABLE_PATH;
      process.env.CHROME_BIN = "/opt/google/chrome";

      await service.generatePdf();

      const launchArgs = mockPuppeteerLaunch.mock.calls[0][0];
      expect(launchArgs.executablePath).toBe("/opt/google/chrome");

      delete process.env.CHROME_BIN;
    });

    it("should set executablePath to undefined when neither env var is set", async () => {
      delete process.env.PUPPETEER_EXECUTABLE_PATH;
      delete process.env.CHROME_BIN;

      await service.generatePdf();

      const launchArgs = mockPuppeteerLaunch.mock.calls[0][0];
      expect(launchArgs.executablePath).toBeUndefined();
    });

    it("should include the child name in the generated HTML", async () => {
      await service.generatePdf();

      const htmlContent: string = mockSetContentFn.mock.calls[0][0];
      // The service hard-codes "Tuhin" as the child name
      expect(htmlContent).toContain("Tuhin");
    });

    it("should produce HTML with a DOCTYPE declaration", async () => {
      await service.generatePdf();

      const htmlContent: string = mockSetContentFn.mock.calls[0][0];
      expect(htmlContent).toMatch(/<!DOCTYPE html>/i);
    });
  });
});
