const MAX_RESUME_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const PDF_MIME_TYPE = "application/pdf";
type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfJsPromise: Promise<PdfJsModule> | null = null;

export class ResumeUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResumeUploadError";
  }
}

export interface ExtractedResume {
  pageCount: number;
  text: string;
}

const normalizeResumeText = (value: string) =>
  value
    .split("\0")
    .join(" ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

const sanitizeFileName = (fileName: string) =>
  fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "resume.pdf";

export const buildResumeStoragePath = (userId: string, fileName: string) =>
  `${userId}/${Date.now()}-${sanitizeFileName(fileName)}`;

const getPdfJs = async () => {
  if (!pdfJsPromise) {
    pdfJsPromise = Promise.all([
      // The legacy browser build carries the Promise polyfills the modern bundle omits.
      import("pdfjs-dist/legacy/build/pdf.mjs"),
      import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
  }

  return pdfJsPromise;
};

export const extractResumeText = async (file: File): Promise<ExtractedResume> => {
  if (file.type !== PDF_MIME_TYPE) {
    throw new ResumeUploadError("Only PDF resumes are supported right now.");
  }

  if (file.size > MAX_RESUME_FILE_SIZE_BYTES) {
    throw new ResumeUploadError("Resume PDF must be smaller than 10 MB.");
  }

  const pdfjs = await getPdfJs();
  const loadingTask = pdfjs.getDocument({
    data: await file.arrayBuffer(),
    useWorkerFetch: false,
  });

  try {
    const pdf = await loadingTask.promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .trim();

      if (pageText) {
        pages.push(pageText);
      }
    }

    const text = normalizeResumeText(pages.join("\n\n"));

    if (text.length < 50) {
      throw new ResumeUploadError("Could not extract enough text from that PDF. Please try another file or paste the CV text.");
    }

    return {
      pageCount: pdf.numPages,
      text,
    };
  } catch (error) {
    if (error instanceof ResumeUploadError) {
      throw error;
    }

    throw new ResumeUploadError("Failed to read that PDF. Please try another file or paste the CV text.");
  } finally {
    await loadingTask.destroy();
  }
};
