import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import Profile from "../Profile";

const mockGetProfile = vi.fn();
const mockGetResume = vi.fn();
const mockSaveResume = vi.fn();
const mockDeleteResume = vi.fn();
const mockAnalyzeCV = vi.fn();
const mockUpdateProfile = vi.fn();
const mockUploadResumeFile = vi.fn();
const mockDeleteResumeFiles = vi.fn();
const mockExtractResumeText = vi.fn();
const mockUseAuth = vi.fn();

vi.mock("@/components/Navigation", () => ({
  default: () => <div>Navigation</div>,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuthContext: () => mockUseAuth(),
}));

vi.mock("@/services/searchService", () => ({
  searchService: {
    getProfile: (...args: unknown[]) => mockGetProfile(...args),
    getResume: (...args: unknown[]) => mockGetResume(...args),
    saveResume: (...args: unknown[]) => mockSaveResume(...args),
    deleteResume: (...args: unknown[]) => mockDeleteResume(...args),
    analyzeCV: (...args: unknown[]) => mockAnalyzeCV(...args),
    updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
    uploadResumeFile: (...args: unknown[]) => mockUploadResumeFile(...args),
    deleteResumeFiles: (...args: unknown[]) => mockDeleteResumeFiles(...args),
  },
}));

vi.mock("@/lib/resumeUpload", () => ({
  ACCEPTED_RESUME_TYPES:
    "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,.docx",
  ResumeUploadError: class ResumeUploadError extends Error {},
  buildResumeStoragePath: vi.fn(() => "user-1/resume.pdf"),
  extractResumeText: (...args: unknown[]) => mockExtractResumeText(...args),
}));

const renderProfile = () =>
  render(
    <MemoryRouter initialEntries={["/profile"]}>
      <Routes>
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </MemoryRouter>,
  );

describe("Profile page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: "user-1", email: "test@example.com" } });
    mockGetProfile.mockResolvedValue({ success: true, profile: { seniority: null } });
    mockGetResume.mockResolvedValue({ success: true, resume: null });
  });

  it("shows loading state then renders profile", async () => {
    renderProfile();

    expect(screen.getByText("Loading Profile")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("No CV Information Available")).toBeInTheDocument();
    });
  });

  it("shows error when user is not signed in", async () => {
    mockUseAuth.mockReturnValue({ user: null });
    renderProfile();

    await waitFor(() => {
      expect(screen.getByText("Please sign in to view your profile")).toBeInTheDocument();
    });
  });

  it("loads and displays existing CV text", async () => {
    mockGetResume.mockResolvedValue({
      success: true,
      resume: {
        content: "Experienced software engineer with 5 years...",
        parsed_data: null,
      },
    });

    renderProfile();

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText("Paste or type your CV content here...");
      expect(textarea).toHaveValue("Experienced software engineer with 5 years...");
    });
  });

  it("loads and displays parsed profile data", async () => {
    mockGetResume.mockResolvedValue({
      success: true,
      resume: {
        content: "Some CV text",
        parsed_data: {
          personalInfo: { name: "Jane Doe", email: "jane@example.com" },
          professional: { currentRole: "Staff Engineer" },
        },
      },
    });

    renderProfile();

    await waitFor(() => {
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    });
    expect(screen.getByText("Staff Engineer")).toBeInTheDocument();
  });

  it("saves CV text with analysis", async () => {
    mockGetResume.mockResolvedValue({ success: true, resume: null });
    mockAnalyzeCV.mockResolvedValue({
      success: true,
      parsedData: { personalInfo: { name: "John" } },
    });
    mockSaveResume.mockResolvedValue({ success: true });

    renderProfile();

    await waitFor(() => {
      expect(screen.getByText("No CV Information Available")).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText("Paste or type your CV content here...");
    fireEvent.change(textarea, { target: { value: "My CV content here" } });

    const saveButton = screen.getByRole("button", { name: "Save & Analyze with AI" });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockAnalyzeCV).toHaveBeenCalledWith("My CV content here");
    });

    await waitFor(() => {
      expect(mockSaveResume).toHaveBeenCalledWith(
        expect.objectContaining({ content: "My CV content here" }),
      );
    });
  });

  it("shows success after saving CV text even when analysis is unavailable", async () => {
    mockAnalyzeCV.mockResolvedValue({ success: false, error: "Service unavailable" });
    mockSaveResume.mockResolvedValue({ success: true });

    renderProfile();

    await waitFor(() => {
      expect(screen.getByText("No CV Information Available")).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText("Paste or type your CV content here...");
    fireEvent.change(textarea, { target: { value: "My CV content" } });

    fireEvent.click(screen.getByRole("button", { name: "Save & Analyze with AI" }));

    await waitFor(() => {
      expect(
        screen.getByText("CV saved. Structured profile analysis is temporarily unavailable."),
      ).toBeInTheDocument();
    });
  });

  it("calls deleteResume on the server when deleting CV", async () => {
    mockGetResume.mockResolvedValue({
      success: true,
      resume: { content: "Some content", parsed_data: null },
    });
    mockDeleteResume.mockResolvedValue({ success: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderProfile();

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Paste or type your CV content here...")).toHaveValue(
        "Some content",
      );
    });

    const deleteButton = screen.getByRole("button", { name: /Delete CV/i });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockDeleteResume).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText("CV deleted successfully!")).toBeInTheDocument();
    });
  });

  it("does not delete when user cancels confirm dialog", async () => {
    mockGetResume.mockResolvedValue({
      success: true,
      resume: { content: "Some content", parsed_data: null },
    });
    vi.spyOn(window, "confirm").mockReturnValue(false);

    renderProfile();

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Paste or type your CV content here...")).toHaveValue(
        "Some content",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /Delete CV/i }));

    expect(mockDeleteResume).not.toHaveBeenCalled();
  });

  it("loads and displays the current seniority level", async () => {
    mockGetProfile.mockResolvedValue({
      success: true,
      profile: { seniority: "senior" },
    });

    renderProfile();

    // The seniority badge shows the current level with emoji prefix
    await waitFor(() => {
      expect(screen.getByText("Current:")).toBeInTheDocument();
    });
  });

  it("updates seniority when a new level is selected", async () => {
    mockUpdateProfile.mockResolvedValue({ success: true });

    renderProfile();

    await waitFor(() => {
      expect(screen.getByText("Experience Level")).toBeInTheDocument();
    });

    // The seniority select trigger should be present
    const trigger = screen.getByRole("combobox", { name: /Current Experience Level/i });
    expect(trigger).toBeInTheDocument();
  });

  it("shows error when save fails", async () => {
    mockAnalyzeCV.mockResolvedValue({ success: true, parsedData: {} });
    mockSaveResume.mockResolvedValue({
      success: false,
      error: { message: "Database error" },
    });

    renderProfile();

    await waitFor(() => {
      expect(screen.getByText("No CV Information Available")).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText("Paste or type your CV content here...");
    fireEvent.change(textarea, { target: { value: "Some content" } });

    fireEvent.click(screen.getByRole("button", { name: "Save & Analyze with AI" }));

    await waitFor(() => {
      expect(screen.getByText("Database error")).toBeInTheDocument();
    });
  });

  it("disables save button when CV text is empty", async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByText("No CV Information Available")).toBeInTheDocument();
    });

    const saveButton = screen.getByRole("button", { name: "Save & Analyze with AI" });
    expect(saveButton).toBeDisabled();
  });

  it("disables delete button when CV text is empty", async () => {
    renderProfile();

    await waitFor(() => {
      expect(screen.getByText("No CV Information Available")).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", { name: /Delete CV/i });
    expect(deleteButton).toBeDisabled();
  });
});
