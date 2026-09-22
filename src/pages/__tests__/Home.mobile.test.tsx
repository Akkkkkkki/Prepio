import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import Home from "../Home";
import { RESEARCH_DRAFT_STORAGE_KEY } from "@/lib/researchDraft";

const mockCreateSearchRecord = vi.fn();
const mockCreateResearchPreview = vi.fn();
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

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];

  callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  observe = vi.fn(() => {
    this.callback([], this as unknown as ResizeObserver);
  });

  unobserve = vi.fn();

  disconnect = vi.fn();

  static triggerAll() {
    for (const instance of MockResizeObserver.instances) {
      instance.callback([], instance as unknown as ResizeObserver);
    }
  }

  static reset() {
    MockResizeObserver.instances = [];
  }
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
});

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
    createResearchPreview: (...args: unknown[]) => mockCreateResearchPreview(...args),
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
    MockResizeObserver.reset();
    mockNetworkStatus.isOnline = true;
    mockNetworkStatus.isOffline = false;

    mockUseIsMobile.mockReturnValue(true);
    mockUseAuth.mockReturnValue({ user: null });
    mockGetResume.mockResolvedValue({ success: true, resume: null });
    mockCreateSearchRecord.mockResolvedValue({
      success: true,
      searchId: "search-1",
    });
    mockCreateResearchPreview.mockResolvedValue({
      success: true,
      preview: {
        previewId: "preview-1",
        status: "completed",
        company: "Stripe",
        role: "Platform Engineer",
        confidence: "medium",
        sourceSummary: "4 public signals from interview reviews and company material.",
        expiresAt: "2026-05-18T00:00:00.000Z",
        stages: [
          {
            name: "Recruiter screen",
            whyLikely: "Most Stripe candidates report an initial recruiter screen.",
            confidence: "high",
          },
        ],
        assessmentSignals: [
          {
            name: "Systems judgment",
            importance: "high",
            rationale: "Platform roles are screened for tradeoff quality.",
          },
        ],
        questions: [
          {
            stage: "Technical panel",
            difficulty: "Hard",
            question: "How would you design a resilient payment event pipeline?",
            rationale: "This tests platform reliability judgment.",
          },
        ],
      },
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

  it("keeps mobile stepper labels on a single line so 'Role Details' doesn't wrap", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });

    renderHome();

    const roleDetailsLabel = await screen.findByText("Role Details");
    expect(roleDetailsLabel.tagName).toBe("P");
    expect(roleDetailsLabel.className).toMatch(/whitespace-nowrap/);

    for (const label of ["Company", "Role Details", "Personalize"]) {
      const node = screen.getByText(label);
      expect(node.className).toMatch(/whitespace-nowrap/);
      // Cell wrapper must contain any horizontal overflow so the label
      // cannot bleed into the neighboring stepper cell on narrow viewports.
      const cell = node.parentElement;
      expect(cell?.className).toMatch(/overflow-hidden/);
    }
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

  it("never overwrites a saved draft with profile preferences", async () => {
    mockUseIsMobile.mockReturnValue(false);
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
    mockGetCandidateProfile.mockResolvedValue({
      success: true,
      profile: {
        preferences: {
          targetRoles: ["Staff Engineer"],
          targetIndustries: [],
          locations: ["Germany"],
          workModes: [],
          notes: "",
        },
      },
    });
    window.sessionStorage.setItem(
      RESEARCH_DRAFT_STORAGE_KEY,
      JSON.stringify({
        company: "Stripe",
        role: "",
        country: "",
        cv: "",
        roleLinks: "",
        step: "company",
        savedAt: "2026-04-03T18:00:00.000Z",
      }),
    );

    renderHome();

    await waitFor(() => {
      expect(screen.getByLabelText("Company *")).toHaveValue("Stripe");
    });
    expect(screen.getByLabelText("Role (optional)")).toHaveValue("");
    expect(mockGetCandidateProfile).not.toHaveBeenCalled();
  });

  it("keeps the full desktop research form for authenticated users", async () => {
    mockUseIsMobile.mockReturnValue(false);
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });

    renderHome();

    expect(mockGetResume).not.toHaveBeenCalled();

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
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Research Started!",
          description:
            "Your research is queued. You can leave this screen and keep an eye on progress from Your interviews.",
        }),
      );
    });
    expect(mockToast).not.toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Research Started!",
        description: expect.stringMatching(/dashboard/i),
      }),
    );
    expect(window.sessionStorage.getItem(RESEARCH_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("shows an error when the research pipeline fails to start after the search row is created", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
    mockStartProcessing.mockResolvedValue({
      success: false,
      error: new Error("Research worker unavailable"),
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
          description: "Research worker unavailable",
          variant: "destructive",
        }),
      );
    });
  });

  it("reserves bottom padding equal to the measured fixed footer height plus a small buffer so chips clear it", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });

    const { container } = renderHome();

    expect(await screen.findByLabelText("Company *")).toBeInTheDocument();

    const footer = container.querySelector("[data-mobile-home-footer]") as HTMLElement;
    expect(footer).not.toBeNull();

    Object.defineProperty(footer, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        top: 0,
        right: 390,
        bottom: 180,
        left: 0,
        width: 390,
        height: 180,
        toJSON: () => ({}),
      }),
    });

    await act(async () => {
      MockResizeObserver.triggerAll();
    });

    const wrapper = footer.parentElement as HTMLElement;
    await waitFor(() => {
      expect(wrapper.style.paddingBottom).toBe("196px");
    });
  });

  it("falls back to a non-zero padding before the footer is measured so the wizard isn't covered on first paint", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });

    const { container } = renderHome();

    expect(await screen.findByLabelText("Company *")).toBeInTheDocument();

    const footer = container.querySelector("[data-mobile-home-footer]") as HTMLElement;
    expect(footer).not.toBeNull();

    const wrapper = footer.parentElement as HTMLElement;
    expect(wrapper.style.paddingBottom).toBe("128px");
  });

  it("does not stack a static pb-32 below the dynamic clearance", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });

    const { container } = renderHome();

    expect(await screen.findByLabelText("Company *")).toBeInTheDocument();

    const outerContainer = container.querySelector(".container.mx-auto.px-4") as HTMLElement;
    expect(outerContainer).not.toBeNull();
    expect(outerContainer.className).not.toMatch(/\bpb-32\b/);
  });

  it("shows a task header and back-to-interviews affordance instead of the marketing hero for signed-in mobile users", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });

    renderHome();

    // Built-in matchers only: tsconfig.app.json does not type the jest-dom
    // matchers, so asserting via DOM reads keeps this file off the typecheck
    // baseline (docs/TESTING.md).
    const heading = await screen.findByRole("heading", { name: "Prep a new interview" });
    expect(heading.tagName).toBe("H1");

    const backLink = screen.getByRole("link", { name: "Your interviews" });
    expect(backLink.getAttribute("href")).toBe("/interviews");

    expect(screen.queryByText(/insider insights/i)).toBeNull();
    expect(screen.queryByText(/for you and your friends/i)).toBeNull();
    expect(screen.queryByText(/desktop-style sprawl/i)).toBeNull();
  });

  it("shows a breadcrumb back to interviews instead of the marketing hero for signed-in desktop users", async () => {
    mockUseIsMobile.mockReturnValue(false);
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });

    renderHome();

    // The page must keep a top-level h1 so the heading hierarchy doesn't start
    // at the form CardTitle (h3) for screen-reader users.
    const heading = await screen.findByRole("heading", { name: "Prep a new interview" });
    expect(heading.tagName).toBe("H1");

    const backLink = screen.getByRole("link", { name: "Your interviews" });
    expect(backLink.getAttribute("href")).toBe("/interviews");
    expect(screen.queryByText("New interview")).not.toBeNull();

    expect(screen.queryByText(/insider insights/i)).toBeNull();
    expect(screen.queryByText(/for you and your friends/i)).toBeNull();
  });
  it.each([true, false])("shows an offline local sample with no guest AI or paid controls (mobile=%s)", (mobile) => {
    mockUseIsMobile.mockReturnValue(mobile);
    mockNetworkStatus.isOffline = true;
    mockNetworkStatus.isOnline = false;
    renderHome();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "View sample plan" }));
    expect(screen.getByRole("heading", { name: "Payments company · Product Manager" })).toBeInTheDocument();
    expect(mockCreateResearchPreview).not.toHaveBeenCalled();
    expect(mockStartProcessing).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: /pricing|upgrade/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/create account/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Sign in to prepare your interview" }));
    expect(JSON.parse(screen.getByTestId("auth-state").textContent!).from.pathname).toBe("/new-interview");
  });

  it("keeps pasted CV text without loading or activating a profile", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1" } });
    mockUseIsMobile.mockReturnValue(false);
    renderHome();
    const cv = await screen.findByLabelText("CV text (optional)");
    fireEvent.change(cv, { target: { value: "Synthetic product management experience" } });
    expect(cv).toHaveValue("Synthetic product management experience");
    expect(screen.queryByRole("button", { name: /upload/i })).not.toBeInTheDocument();
    expect(mockGetCandidateProfile).not.toHaveBeenCalled();
    expect(mockGetResume).not.toHaveBeenCalled();
    expect(mockCreateProfileImport).not.toHaveBeenCalled();
  });

});
