import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import Home from "../Home";
import { RESEARCH_DRAFT_STORAGE_KEY } from "@/lib/researchDraft";

const mockCreateSearchRecord = vi.fn();
const mockDeleteResumeFiles = vi.fn();
const mockGetResume = vi.fn();
const mockGetSearchStatus = vi.fn();
const mockStartProcessing = vi.fn();
const mockUploadResumeFile = vi.fn();
const mockAnalyzeCV = vi.fn();
const mockSaveResume = vi.fn();
const mockToast = vi.fn();
const mockUseIsMobile = vi.fn();
const mockUseAuth = vi.fn();

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

vi.mock("@/services/searchService", () => ({
  searchService: {
    analyzeCV: (...args: unknown[]) => mockAnalyzeCV(...args),
    createSearchRecord: (...args: unknown[]) => mockCreateSearchRecord(...args),
    deleteResumeFiles: (...args: unknown[]) => mockDeleteResumeFiles(...args),
    getResume: (...args: unknown[]) => mockGetResume(...args),
    getSearchStatus: (...args: unknown[]) => mockGetSearchStatus(...args),
    saveResume: (...args: unknown[]) => mockSaveResume(...args),
    startProcessing: (...args: unknown[]) => mockStartProcessing(...args),
    uploadResumeFile: (...args: unknown[]) => mockUploadResumeFile(...args),
  },
}));

const renderHome = () =>
  render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<div>Auth screen</div>} />
        <Route path="/search/:searchId" element={<div>Search screen</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe("Home mobile flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();

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
    mockStartProcessing.mockResolvedValue(undefined);
    mockAnalyzeCV.mockResolvedValue({ success: false, error: new Error("no-op") });
    mockUploadResumeFile.mockResolvedValue({ success: true, path: "resume.pdf" });
    mockSaveResume.mockResolvedValue({ success: true, resume: { created_at: "2026-04-03T00:00:00.000Z" } });
    mockDeleteResumeFiles.mockResolvedValue(undefined);
  });

  it("restores a saved draft into the mobile flow", async () => {
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

  it("saves the mobile draft before sending an anonymous user to auth", async () => {
    renderHome();

    fireEvent.change(screen.getByLabelText("Company *"), {
      target: { value: "Stripe" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByLabelText("Role"), {
      target: { value: "Platform Engineer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Tailor the prep")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign in to start research" }));

    expect(await screen.findByText("Auth screen")).toBeInTheDocument();

    const savedDraft = JSON.parse(
      window.sessionStorage.getItem(RESEARCH_DRAFT_STORAGE_KEY) || "{}",
    );

    expect(savedDraft).toMatchObject({
      company: "Stripe",
      role: "Platform Engineer",
      step: "tailoring",
    });
  });

  it("keeps the desktop form as a single page", () => {
    mockUseIsMobile.mockReturnValue(false);

    renderHome();

    expect(screen.getByLabelText("Company *")).toBeInTheDocument();
    expect(screen.getByLabelText("Role (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Country (optional)")).toBeInTheDocument();
    expect(screen.getByLabelText("Role Description Links (optional)")).toBeInTheDocument();
    expect(screen.queryByText("Step 1 of 3")).not.toBeInTheDocument();
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
        roleLinks: undefined,
        cv: undefined,
        targetSeniority: undefined,
      });
    });

    expect(await screen.findByText("Progress dialog for OpenAI")).toBeInTheDocument();
    expect(window.sessionStorage.getItem(RESEARCH_DRAFT_STORAGE_KEY)).toBeNull();
  });
});
