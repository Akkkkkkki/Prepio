import mammoth from "mammoth";

const MAX_RESUME_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const PDF_MIME_TYPE = "application/pdf";
const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PdfJsWorkerModule = typeof import("pdfjs-dist/legacy/build/pdf.worker.min.mjs");

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

interface PdfTextItem {
  str?: string;
}

interface PdfTextContent {
  items: PdfTextItem[];
  styles: Record<string, unknown>;
  lang: string | null;
}

interface PdfPage {
  getTextContent: () => Promise<PdfTextContent>;
  streamTextContent?: () => ReadableStream<PdfTextContent>;
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
    .replace(/^-|-$/g, "") || "resume";

export const buildResumeStoragePath = (userId: string, fileName: string) =>
  `${userId}/${Date.now()}-${sanitizeFileName(fileName)}`;

const registerPdfJsWorkerFallback = (workerModule: PdfJsWorkerModule) => {
  const globalScope = globalThis as typeof globalThis & {
    pdfjsWorker?: { WorkerMessageHandler?: unknown };
  };

  if (!globalScope.pdfjsWorker?.WorkerMessageHandler && workerModule.WorkerMessageHandler) {
    globalScope.pdfjsWorker = {
      WorkerMessageHandler: workerModule.WorkerMessageHandler,
    };
  }
};

const getPdfJs = async () => {
  if (!pdfJsPromise) {
    pdfJsPromise = Promise.all([
      // The legacy browser build carries the Promise polyfills the modern bundle omits.
      import("pdfjs-dist/legacy/build/pdf.mjs"),
      import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
      import("pdfjs-dist/legacy/build/pdf.worker.min.mjs"),
    ]).then(([pdfjs, workerUrl, workerModule]) => {
      registerPdfJsWorkerFallback(workerModule);

      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.default;
      return pdfjs;
    });
  }

  return pdfJsPromise;
};

const readPdfTextContent = async (page: PdfPage): Promise<PdfTextContent> => {
  const textStream = page.streamTextContent?.();

  if (!textStream?.getReader) {
    return page.getTextContent();
  }

  const reader = textStream.getReader();
  const textContent: PdfTextContent = {
    items: [],
    styles: Object.create(null) as Record<string, unknown>,
    lang: null,
  };

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        return textContent;
      }

      if (!textContent.lang && value.lang) {
        textContent.lang = value.lang;
      }

      Object.assign(textContent.styles, value.styles);
      textContent.items.push(...value.items);
    }
  } finally {
    reader.releaseLock?.();
  }
};

const extractPdfText = async (file: File): Promise<ExtractedResume> => {
  const pdfjs = await getPdfJs();
  const loadingTask = pdfjs.getDocument({
    data: await file.arrayBuffer(),
    useWorkerFetch: false,
  });
  let pdf: Awaited<typeof loadingTask.promise> | null = null;

  try {
    pdf = await loadingTask.promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await readPdfTextContent(page);
      const pageText = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .trim();

      if (pageText) {
        pages.push(pageText);
      }
    }

    return { pageCount: pdf.numPages, text: pages.join("\n\n") };
  } catch (error) {
    console.error("PDF extraction failed before resume save.", error);

    try {
      await loadingTask.destroy();
    } catch {
      // Ignore teardown errors so the user sees the original extraction failure.
    }

    if (error instanceof ResumeUploadError) {
      throw error;
    }

    throw new ResumeUploadError("Failed to read that PDF. Please try another file or paste the CV text.");
  } finally {
    try {
      if (pdf) await pdf.cleanup();
    } catch {
      // Ignore cleanup errors after successful extraction or when destroy already ran.
    }
  }
};

const extractDocxText = async (file: File): Promise<ExtractedResume> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer });
    return { pageCount: 1, text: value };
  } catch (error) {
    console.error("DOCX extraction failed before resume save.", error);

    if (error instanceof ResumeUploadError) throw error;
    throw new ResumeUploadError("Failed to read that DOCX. Please try another file or paste the CV text.");
  }
};

export const ACCEPTED_RESUME_TYPES = `${PDF_MIME_TYPE},${DOCX_MIME_TYPE},.pdf,.docx`;

export const extractResumeText = async (file: File): Promise<ExtractedResume> => {
  if (file.size > MAX_RESUME_FILE_SIZE_BYTES) {
    throw new ResumeUploadError("Resume must be smaller than 10 MB.");
  }

  let result: ExtractedResume;

  if (file.type === PDF_MIME_TYPE || file.name.endsWith(".pdf")) {
    result = await extractPdfText(file);
  } else if (file.type === DOCX_MIME_TYPE || file.name.endsWith(".docx")) {
    result = await extractDocxText(file);
  } else {
    throw new ResumeUploadError("Only PDF and DOCX resumes are supported.");
  }

  const text = normalizeResumeText(result.text);

  if (text.length < 50) {
    throw new ResumeUploadError("Could not extract enough text from that file. Please try another file or paste the CV text.");
  }

  return { pageCount: result.pageCount, text };
};
