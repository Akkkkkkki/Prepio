import { beforeEach, describe, expect, it, vi } from "vitest";

const createPdfJsMocks = (options?: { getTextContentError?: Error }) => {
  const destroy = vi.fn().mockResolvedValue(undefined);
  const cleanup = vi.fn().mockResolvedValue(undefined);
  const getTextContent = options?.getTextContentError
    ? vi.fn().mockRejectedValue(options.getTextContentError)
    : vi.fn().mockResolvedValue({
        items: [
          {
            str: "Jane Doe Senior Product Manager Led cross-functional launches, scaled analytics, and shipped hiring workflows across multiple markets.",
          },
        ],
      });
  const getPage = vi.fn().mockResolvedValue({ getTextContent });
  const loadingTask = {
    destroy,
    promise: Promise.resolve({
      cleanup,
      getPage,
      numPages: 1,
    }),
  };
  const getDocument = vi.fn(() => loadingTask);
  const GlobalWorkerOptions = { workerSrc: "" };

  vi.doMock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
    GlobalWorkerOptions,
    getDocument,
  }));
  vi.doMock("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url", () => ({
    default: "/mock-pdf-worker.js",
  }));
  vi.doMock("pdfjs-dist/legacy/build/pdf.worker.min.mjs", () => ({
    WorkerMessageHandler: { setup: vi.fn() },
  }));

  return {
    GlobalWorkerOptions,
    cleanup,
    destroy,
    getDocument,
    getPage,
    getTextContent,
  };
};

describe("extractResumeText", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete (globalThis as typeof globalThis & { pdfjsWorker?: unknown }).pdfjsWorker;
  });

  it("loads the legacy pdf.js build and extracts text", async () => {
    const mocks = createPdfJsMocks();
    const { extractResumeText } = await import("../resumeUpload");
    const file = new File(["pdf"], "resume.pdf", { type: "application/pdf" });

    Object.defineProperty(file, "arrayBuffer", {
      value: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });

    const result = await extractResumeText(file);

    expect(result).toEqual({
      pageCount: 1,
      text: "Jane Doe Senior Product Manager Led cross-functional launches, scaled analytics, and shipped hiring workflows across multiple markets.",
    });
    expect(mocks.getDocument).toHaveBeenCalledWith({
      data: expect.any(ArrayBuffer),
      useWorkerFetch: false,
    });
    expect(mocks.GlobalWorkerOptions.workerSrc).toBe("/mock-pdf-worker.js");
    expect(
      (globalThis as typeof globalThis & {
        pdfjsWorker?: { WorkerMessageHandler?: unknown };
      }).pdfjsWorker?.WorkerMessageHandler,
    ).toBeTruthy();
    expect(mocks.cleanup).toHaveBeenCalledTimes(1);
    expect(mocks.destroy).not.toHaveBeenCalled();
  });

  it("rejects unsupported file types", async () => {
    createPdfJsMocks();
    const { ResumeUploadError, extractResumeText } = await import("../resumeUpload");

    await expect(
      extractResumeText(new File(["text"], "resume.txt", { type: "text/plain" })),
    ).rejects.toEqual(new ResumeUploadError("Only PDF and DOCX resumes are supported."));
  });

  it("destroys the loading task when text extraction fails", async () => {
    const mocks = createPdfJsMocks({
      getTextContentError: new Error("Worker task was terminated"),
    });
    const { ResumeUploadError, extractResumeText } = await import("../resumeUpload");
    const file = new File(["pdf"], "resume.pdf", { type: "application/pdf" });

    Object.defineProperty(file, "arrayBuffer", {
      value: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });

    await expect(extractResumeText(file)).rejects.toEqual(
      new ResumeUploadError("Failed to read that PDF. Please try another file or paste the CV text."),
    );
    expect(mocks.destroy).toHaveBeenCalledTimes(1);
    expect(mocks.cleanup).toHaveBeenCalledTimes(1);
  });

  it("extracts text from a docx file", async () => {
    createPdfJsMocks();

    vi.doMock("mammoth", () => ({
      default: {
        extractRawText: vi.fn().mockResolvedValue({
          value:
            "Jane Doe Senior Product Manager Led cross-functional launches, scaled analytics, and shipped hiring workflows across multiple markets.",
        }),
      },
    }));

    const { extractResumeText } = await import("../resumeUpload");
    const file = new File(["docx"], "resume.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    Object.defineProperty(file, "arrayBuffer", {
      value: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    });

    const result = await extractResumeText(file);

    expect(result).toEqual({
      pageCount: 1,
      text: "Jane Doe Senior Product Manager Led cross-functional launches, scaled analytics, and shipped hiring workflows across multiple markets.",
    });
  });
});
