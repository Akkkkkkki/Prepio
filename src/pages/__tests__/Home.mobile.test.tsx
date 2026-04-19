import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import Home from "../Home";
import { RESEARCH_DRAFT_STORAGE_KEY } from "@/lib/researchDraft";

const mockCreateSearchRecord = vi.fn();
const mockDeleteResumeFiles = vi.fn();
const mockGetCandidateProfile = vi.fn();
const mockGetResume = vi.fn();
const mockGetSearchStatus = vi.fn();
const mockStartProcessing = vi.fn();
const mockUploadResumeFile = vi.fn();
const mockAnalyzeCV = vi.fn();
const mockCreateProfileImport = vi.fn();
const mockExtractResumeText = vi.fn();
const mockSaveResume = vi.fn();
const mockToast = vi.fn();
const mockUseIsMobile = vi.fn();
const mockUseAuth = vi.fn();
const mockNetworkStatus = {
  isOnline: true,
  isOffline: false,
};

vi.mock("@/components/Navigation", () => ({
  default: () => <div>Navigation</div>,
}));

vi.mock("@/components/ProgressDialog", () => ({
  default: ({ isOpen, company }: { isOpen: boolean; company: string }) =>
    isOpen ? <div>Progress dialog for {company}</div> : null,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/hooks/useNetworkStatus", () => ({
  useNetworkStatus: () => mockNetworkStatus,
}));

vi.mock("@/services/searchService", () => ({
  searchService: {
    analyzeCV: (...args: unknown[]) => mockAnalyzeCV(...args),
    createSearchRecord: (...args: unknown[]) => mockCreateSearchRecord(...args),
    createProfileImport: (...args: unknown[]) => mockCreateProfileImport(...args),
    deleteResumeFiles: (...args: unknown[]) => mockDeleteResumeFiles(...args),
    getCandidateProfile: (...args: unknown[]) => mockGetCandidateProfile(...args),
    getResume: (...args: unknown[]) => mockGetResume(...args),
    getSearchStatus: (...args: unknown[]) => mockGetSearchStatus(...args),
    saveResume: (...args: unknown[]) => mockSaveResume(...args),
    startProcessing: (...args: unknown[]) => mockStartProcessing(...args),
    uploadResumeFile: (...args: unknown[]) => mockUploadResumeFile(...args),
  },
}));

vi.mock("@/lib/resumeUpload", () => ({
  ACCEPTED_RESUME_TYPES:
    "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx",
  ResumeUploadError: class ResumeUploadError extends Error {},
  buildResumeStoragePath: vi.fn(() => "user-1/resume.pdf"),
  extractResumeText: (...args: unknown[]) => mockExtractResumeText(...args),
}));

const AuthStateScreen = () => {
  const location = useLocation();

  return <pre data-testid="auth-state">{JSON.stringify(location.state)}</pre>;
};

const renderHome = () =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<AuthStateScreen />} />
        <Route path="/search/:searchId" element={<div>Search screen</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe("Home flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    mockNetworkStatus.isOnline = true;
    mockNetworkStatus.isOffline = false;

    mockUseIsMobile.mockReturnValue(true);
    mockUseAuth.mockReturnValue({ user: null });
    mockGetResume.mockResolvedValue({ success: true, resume: null });
    mockCreateSearchRecord.mockResolvedValue({
      success: true,
      searchId: "search-1",
    });
    mockGetSearchStatus.mockResolvedValue({
      status: "completed",
    });
    mockStartProcessing.mockResolvedValue({ success: true });
    mockAnalyzeCV.mockResolvedValue({ success: false, error: new Error("no-op") });
    mockExtractResumeText.mockResolvedValue({
      pageCount: 1,
      text: "Parsed resume text with enough content to update the draft while offline.",
    });
    mockUploadResumeFile.mockResolvedValue({ success: true, path: "resume.pdf" });
    mockGetCandidateProfile.mockResolvedValue({ success: true, profile: null });
    mockCreateProfileImport.mockResolvedValue({ success: true, profileImport: { id: "import-1" } });
    mockSaveResume.mockResolvedValue({
      success: true,
      resume: { id: "resume-1", created_at: "2026-04-03T00:00:00.000Z" },
    });
    mockDeleteResumeFiles.mockResolvedValue(undefined);
  });

  it("restores a saved draft into the signed-in mobile flow", async () => {
    window.sessionStorage.setItem(
      RESEARCH_DRAFT_STORAGE_KEY,
      JSON.stringify({
        company: "Stripe",
        role: "Product Manager",
        country: "United States",
        cv: "Built growth systems",
        roleLinks: "https://example.com/job",
        step: "tailoring",
        savedAt: "2026-04-03T18:00:00.000Z",
      }),
    );

    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });

    renderHome();

    expect(await screen.findByText("Tailor the prep")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Built growth systems")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://example.com/job")).toBeInTheDocument();
  });

  it("saves the guest teaser draft and carries research auth state to /auth", async () => {
    renderHome();

    fireEvent.change(screen.getByLabelText("Company *"), {
      target: { value: "Stripe" },
    });
    fireEvent.change(screen.getByLabelText("Role (optional)"), {
      target: { value: "Platform Engineer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Research Stripe →" }));

    const savedDraft = JSON.parse(
      window.sessionStorage.getItem(RESEARCH_DRAFT_STORAGE_KEY) || "{}",
    );

    expect(savedDraft).toMatchObject({
      company: "Stripe",
      role: "Platform Engineer",
      step: "details",
    });

    const authState = JSON.parse(
      (await screen.findByTestId("auth-state")).textContent || "{}",
    );

    expect(authState).toMatchObject({
      intent: "research",
      resumeLabel: "Research",
      source: "research_home",
      draftStorageKey: RESEARCH_DRAFT_STORAGE_KEY,
      from: { pathname: "/" },
    });
  });

  it("shows the compact teaser for anonymous visitors instead of the full research form", () => {
    mockUseIsMobile.mockReturnValue(false);

    renderHome();

    expect(screen.getByText("Walk into your next interview knowing exactly what to expect.")).toBeInTheDocument();
    expect(screen.getByText("How it works")).toBeInTheDocument();
    expect(screen.queryByLabelText("Country")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Role Description Links (optional)")).not.toBeInTheDocument();
    expect(screen.queryByText("Step 1 of 3")).not.toBeInTheDocument();
  });

  it("keeps the full desktop research form for authenticated users", async () => {
    mockUseIsMobile.mockReturnValue(false);
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });

    renderHome();

    await waitFor(() => {
      expect(mockGetResume).toHaveBeenCalledWith("user-1");
    });

    expect(screen.getByLabelText("Company *")).toBeInTheDocument();
    expect(screen.getByLabelText("Role (optional)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add your CV/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Role details & job description/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Notes for the research/ })).toBeInTheDocument();
    expect(screen.queryByText("How it works")).not.toBeInTheDocument();
  });

  it("submits the mobile flow for signed-in users and clears any saved draft", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
    window.sessionStorage.setItem(
      RESEARCH_DRAFT_STORAGE_KEY,
      JSON.stringify({
        company: "Old draft",
        role: "",
        country: "",
        cv: "",
        roleLinks: "",
        step: "company",
        savedAt: "2026-04-03T18:00:00.000Z",
      }),
    );

    renderHome();

    fireEvent.change(await screen.findByLabelText("Company *"), {
      target: { value: "OpenAI" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Start research" }));

    await waitFor(() => {
      expect(mockCreateSearchRecord).toHaveBeenCalledWith({
        company: "OpenAI",
        role: undefined,
        country: undefined,
        roleLinks: [],
        cv: undefined,
        level: undefined,
        userNote: undefined,
        jobDescription: undefined,
      });
    });

    expect(await screen.findByText("Progress dialog for OpenAI")).toBeInTheDocument();
    expect(window.sessionStorage.getItem(RESEARCH_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("shows an error when the research pipeline fails to start after the search row is created", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
    mockStartProcessing.mockResolvedValue({
      success: false,
      error: new Error("Timed out while starting research"),
    });

    renderHome();

    fireEvent.change(await screen.findByLabelText("Company *"), {
      target: { value: "Anthropic" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Start research" }));

    expect(await screen.findByText("Progress dialog for Anthropic")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Error Starting Research",
          description: "Timed out while starting research",
          variant: "destructive",
        }),
      );
    });
  });

  it("keeps local resume parsing available while offline and skips profile sync", async () => {
    mockUseIsMobile.mockReturnValue(false);
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
    mockNetworkStatus.isOnline = false;
    mockNetworkStatus.isOffline = true;

    renderHome();

    await waitFor(() => {
      expect(mockGetResume).toHaveBeenCalledWith("user-1");
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    fireEvent.change(fileInput as HTMLInputElement, {
      target: {
        files: [new File(["resume"], "resume.pdf", { type: "application/pdf" })],
      },
    });

    expect(
      await screen.findByDisplayValue(
        "Parsed resume text with enough content to update the draft while offline.",
      ),
    ).toBeInTheDocument();

    expect(mockAnalyzeCV).not.toHaveBeenCalled();
    expect(mockUploadResumeFile).not.toHaveBeenCalled();
    expect(mockSaveResume).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Resume parsed locally",
      }),
    );
  });

  it("preserves legacy parsed data when import draft creation is unavailable", async () => {
    mockUseIsMobile.mockReturnValue(false);
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
    mockAnalyzeCV.mockResolvedValue({
      success: true,
      parsedData: {
        personalInfo: { location: "London" },
        professional: { currentRole: "Staff Engineer" },
      },
    });
    mockCreateProfileImport.mockResolvedValue({
      success: false,
      error: new Error("profile import unavailable"),
    });

    renderHome();

    await waitFor(() => {
      expect(mockGetResume).toHaveBeenCalledWith("user-1");
    });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(fileInput).not.toBeNull();

    fireEvent.change(fileInput as HTMLInputElement, {
      target: {
        files: [new File(["resume"], "resume.pdf", { type: "application/pdf" })],
      },
    });

    await waitFor(() => {
      expect(mockAnalyzeCV).toHaveBeenCalledWith(
        "Parsed resume text with enough content to update the draft while offline.",
      );
    });

    expect(mockSaveResume).toHaveBeenCalledWith(
      expect.objectContaining({
        parsedData: expect.objectContaining({
          personalInfo: { location: "London" },
          professional: { currentRole: "Staff Engineer" },
        }),
      }),
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Resume uploaded",
      }),
    );
  });
});
