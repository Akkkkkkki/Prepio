import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchService } from "./searchService";

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    auth: {
      getUser: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
    storage: {
      from: vi.fn(),
    },
  },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: mockSupabase }));

describe("frozen provider paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks the old guest research method before any Edge Function call", async () => {
    expect(await searchService.createResearchPreview({ company: "Synthetic company" })).toMatchObject({ success: false });
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
  });

  it("blocks paid feedback even for a direct caller", async () => {
    expect(await searchService.generateAnswerFeedback("synthetic-answer", true)).toMatchObject({ success: false });
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
  });

  it("blocks CV analysis before any Edge Function call", async () => {
    expect(await searchService.analyzeCV("Synthetic CV text")).toMatchObject({ success: false });
    expect(mockSupabase.auth.getUser).not.toHaveBeenCalled();
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
  });

  it("blocks resume file upload before any storage write", async () => {
    const file = new File(["Synthetic CV text"], "resume.pdf", { type: "application/pdf" });

    expect(await searchService.uploadResumeFile(file, "user-1/resume.pdf")).toMatchObject({ success: false });
    expect(mockSupabase.storage.from).not.toHaveBeenCalled();
  });

  it("blocks voice audio upload before any storage write", async () => {
    const file = new File(["audio"], "practice-answer.webm", { type: "audio/webm" });

    expect(await searchService.uploadPracticeAudio(file, "user-1/session-1/question-1.webm")).toMatchObject({
      success: false,
    });
    expect(mockSupabase.storage.from).not.toHaveBeenCalled();
  });

  it("blocks voice transcription before any Edge Function call", async () => {
    expect(await searchService.transcribePracticeAudio({ path: "user-1/session-1/question-1.webm" })).toMatchObject({
      success: false,
    });
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
  });

  it("blocks profile import before any Edge Function call", async () => {
    expect(await searchService.createProfileImport({ resumeText: "Synthetic CV text" })).toMatchObject({
      success: false,
    });
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
  });
});
