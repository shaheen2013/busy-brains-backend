import { Test, TestingModule } from "@nestjs/testing";
import { ToolkitReportController } from "./toolkit-report.controller";
import { ToolkitReportService } from "./toolkit-report.service";

import { User as UserEntity } from "../users/entities/user.entity";

const mockToolkitReportService = {
  generatePdf: jest.fn(),
};

const mockUser = { id: "user-1" } as UserEntity;

describe("ToolkitReportController", () => {
  let controller: ToolkitReportController;
  let service: typeof mockToolkitReportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ToolkitReportController],
      providers: [
        {
          provide: ToolkitReportService,
          useValue: mockToolkitReportService,
        },
      ],
    }).compile();

    controller = module.get<ToolkitReportController>(ToolkitReportController);
    service = module.get(ToolkitReportService);

    jest.clearAllMocks();
  });

  describe("downloadReport()", () => {
    const createMockResponse = () => {
      const res: any = {
        setHeader: jest.fn(),
        end: jest.fn(),
      };
      return res;
    };

    it("should call toolkitReportService.generatePdf once", async () => {
      const pdfBuffer = Buffer.from("fake-pdf-content");
      service.generatePdf.mockResolvedValue(pdfBuffer);
      const res = createMockResponse();

      await controller.downloadReport(mockUser, "child-1", res);

      expect(service.generatePdf).toHaveBeenCalledTimes(1);
    });

    it("should set Content-Type header to application/pdf", async () => {
      const pdfBuffer = Buffer.from("fake-pdf-content");
      service.generatePdf.mockResolvedValue(pdfBuffer);
      const res = createMockResponse();

      await controller.downloadReport(mockUser, "child-1", res);

      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "application/pdf",
      );
    });

    it("should set Content-Disposition header with the correct filename", async () => {
      const pdfBuffer = Buffer.from("fake-pdf-content");
      service.generatePdf.mockResolvedValue(pdfBuffer);
      const res = createMockResponse();

      await controller.downloadReport(mockUser, "child-1", res);

      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        'attachment; filename="child-toolkit-report.pdf"',
      );
    });

    it("should set Content-Length header to the buffer length", async () => {
      const pdfBuffer = Buffer.from("fake-pdf-content");
      service.generatePdf.mockResolvedValue(pdfBuffer);
      const res = createMockResponse();

      await controller.downloadReport(mockUser, "child-1", res);

      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Length",
        pdfBuffer.length,
      );
    });

    it("should call res.end with the pdf buffer", async () => {
      const pdfBuffer = Buffer.from("fake-pdf-content");
      service.generatePdf.mockResolvedValue(pdfBuffer);
      const res = createMockResponse();

      await controller.downloadReport(mockUser, "child-1", res);

      expect(res.end).toHaveBeenCalledWith(pdfBuffer);
    });

    it("should propagate errors thrown by the service", async () => {
      service.generatePdf.mockRejectedValue(new Error("puppeteer error"));
      const res = createMockResponse();

      await expect(
        controller.downloadReport(mockUser, "child-1", res),
      ).rejects.toThrow("puppeteer error");
    });

    it("should set all three required headers before calling res.end", async () => {
      const pdfBuffer = Buffer.from("some-pdf");
      service.generatePdf.mockResolvedValue(pdfBuffer);
      const res = createMockResponse();

      await controller.downloadReport(mockUser, "child-1", res);

      const headerCalls = res.setHeader.mock.calls.map(
        ([name]: [string]) => name,
      );
      expect(headerCalls).toContain("Content-Type");
      expect(headerCalls).toContain("Content-Disposition");
      expect(headerCalls).toContain("Content-Length");
      expect(res.end).toHaveBeenCalled();
    });
  });
});
