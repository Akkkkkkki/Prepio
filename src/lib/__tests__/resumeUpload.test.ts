import { beforeEach, describe, expect, it, vi } from "vitest";

const createPdfJsMocks = () => {
  const destroy = vi.fn().mockResolvedValue(undefined);
  const getTextContent = vi.fn().mockResolvedValue({
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

  return {
    GlobalWorkerOptions,
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
    expect(mocks.destroy).toHaveBeenCalledTimes(1);
  });

  it("rejects non-pdf files before loading pdf.js", async () => {
    createPdfJsMocks();
    const { ResumeUploadError, extractResumeText } = await import("../resumeUpload");

    await expect(
      extractResumeText(new File(["text"], "resume.txt", { type: "text/plain" })),
    ).rejects.toEqual(new ResumeUploadError("Only PDF resumes are supported right now."));
  });
});
