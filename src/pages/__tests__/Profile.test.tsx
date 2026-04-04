import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import Profile from "../Profile";
import {
  createEmptyCandidateProfile,
  createEmptyExperience,
  normalizeCandidateProfile,
} from "@/lib/candidateProfile";

const mockGetProfile = vi.fn();
const mockGetResume = vi.fn();
const mockListResumeVersions = vi.fn();
const mockGetCandidateProfile = vi.fn();
const mockGetLatestProfileImport = vi.fn();
const mockSaveCandidateProfile = vi.fn();
const mockSaveResume = vi.fn();
const mockCreateProfileImport = vi.fn();
const mockApplyProfileImport = vi.fn();
const mockDeleteResume = vi.fn();
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
    listResumeVersions: (...args: unknown[]) => mockListResumeVersions(...args),
    getCandidateProfile: (...args: unknown[]) => mockGetCandidateProfile(...args),
    getLatestProfileImport: (...args: unknown[]) => mockGetLatestProfileImport(...args),
    saveCandidateProfile: (...args: unknown[]) => mockSaveCandidateProfile(...args),
    saveResume: (...args: unknown[]) => mockSaveResume(...args),
    createProfileImport: (...args: unknown[]) => mockCreateProfileImport(...args),
    applyProfileImport: (...args: unknown[]) => mockApplyProfileImport(...args),
    deleteResume: (...args: unknown[]) => mockDeleteResume(...args),
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
    mockListResumeVersions.mockResolvedValue({ success: true, resumes: [] });
    mockGetCandidateProfile.mockResolvedValue({ success: true, profile: null });
    mockGetLatestProfileImport.mockResolvedValue({ success: true, profileImport: null });
    mockSaveCandidateProfile.mockResolvedValue({
      success: true,
      profile: createEmptyCandidateProfile("user-1"),
    });
    mockDeleteResume.mockResolvedValue({ success: true });
    mockUpdateProfile.mockResolvedValue({ success: true, profile: { seniority: "mid" } });
  });

  it("shows loading state then renders the structured profile editor", async () => {
    renderProfile();

    expect(screen.getByText("Loading Interview Profile")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Your Interview Profile")).toBeInTheDocument();
    });

    expect(screen.getByText("Keep the richer version of your story.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create import draft from text" })).toBeInTheDocument();
  });

  it("bootstraps from legacy parsed resume data when no canonical profile exists", async () => {
    mockGetResume.mockResolvedValue({
      success: true,
      resume: {
        id: "resume-1",
        content: "Legacy resume text",
        parsed_data: {
          personalInfo: { location: "London" },
          professional: {
            currentRole: "Staff Engineer",
            summary: "Built platform systems.",
            workHistory: [
              {
                title: "Engineering Manager",
                company: "Acme",
                duration: "2022-2025",
                description: "Led a team. Improved onboarding.",
              },
            ],
          },
        },
      },
    });
    mockListResumeVersions.mockResolvedValue({
      success: true,
      resumes: [
        {
          id: "resume-1",
          content: "Legacy resume text",
          created_at: "2026-04-04T10:00:00.000Z",
          file_name: null,
          file_path: null,
          file_size_bytes: null,
          is_active: true,
          mime_type: null,
          parsed_data: null,
          search_id: null,
          source: "manual",
          superseded_at: null,
          user_id: "user-1",
        },
      ],
    });

    renderProfile();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Staff Engineer")).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("London")).toBeInTheDocument();
    expect(
      screen.getByText(
        "We prefilled this interview profile from the last parsed resume. Save once to make it your editable canonical profile.",
      ),
    ).toBeInTheDocument();
  });

  it("saves the structured candidate profile", async () => {
    mockGetCandidateProfile.mockResolvedValue({
      success: true,
      profile: normalizeCandidateProfile({
        userId: "user-1",
        headline: "Staff Engineer",
        summary: "Built platform systems.",
        experiences: [createEmptyExperience({ title: "Staff Engineer", company: "Acme" })],
      }),
    });
    mockSaveCandidateProfile.mockResolvedValue({
      success: true,
      profile: normalizeCandidateProfile({
        userId: "user-1",
        headline: "Principal Engineer",
        summary: "Built platform systems.",
        experiences: [createEmptyExperience({ title: "Staff Engineer", company: "Acme" })],
      }),
    });

    renderProfile();

    const headlineInput = await screen.findByDisplayValue("Staff Engineer");
    fireEvent.change(headlineInput, { target: { value: "Principal Engineer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => {
      expect(mockSaveCandidateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ headline: "Principal Engineer" }),
      );
    });
  });

  it("creates and applies an import review from pasted text", async () => {
    const importedProfile = normalizeCandidateProfile({
      userId: "user-1",
      headline: "Staff Engineer",
      experiences: [createEmptyExperience({ id: "exp-1", company: "Acme", title: "Staff Engineer" })],
      lastResumeId: "resume-1",
    });
    const profileImport = {
      id: "import-1",
      userId: "user-1",
      resumeId: "resume-1",
      source: "manual",
      draftProfile: importedProfile,
      mergeSuggestions: [
        {
          id: "suggestion-1",
          kind: "new",
          section: "headline",
          title: "Headline",
          message: "Import headline from the latest resume draft.",
          field: "headline",
        },
      ],
      importSummary: {
        newCount: 1,
        duplicateCount: 0,
        conflictingCount: 0,
        missingCount: 0,
      },
      status: "pending",
      createdAt: "2026-04-04T10:10:00.000Z",
      appliedAt: null,
    };

    mockSaveResume.mockResolvedValue({
      success: true,
      resume: {
        id: "resume-1",
        created_at: "2026-04-04T10:10:00.000Z",
      },
    });
    mockListResumeVersions
      .mockResolvedValueOnce({ success: true, resumes: [] })
      .mockResolvedValueOnce({
        success: true,
        resumes: [
          {
            id: "resume-1",
            content: "Imported resume text",
            created_at: "2026-04-04T10:10:00.000Z",
            file_name: null,
            file_path: null,
            file_size_bytes: null,
            is_active: true,
            mime_type: null,
            parsed_data: null,
            search_id: null,
            source: "manual",
            superseded_at: null,
            user_id: "user-1",
          },
        ],
      });
    mockCreateProfileImport.mockResolvedValue({
      success: true,
      profileImport,
      draftProfile: importedProfile,
      mergeSuggestions: profileImport.mergeSuggestions,
      importSummary: profileImport.importSummary,
    });
    mockApplyProfileImport.mockResolvedValue({
      success: true,
      profile: importedProfile,
      profileImport: { ...profileImport, status: "applied", appliedAt: "2026-04-04T10:12:00.000Z" },
    });

    renderProfile();

    await waitFor(() => {
      expect(screen.getByText("Your Interview Profile")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("Paste the latest resume text here..."), {
      target: { value: "Imported resume text" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create import draft from text" }));

    await waitFor(() => {
      expect(mockCreateProfileImport).toHaveBeenCalledWith(
        expect.objectContaining({
          resumeText: "Imported resume text",
          resumeId: "resume-1",
        }),
      );
    });

    expect(await screen.findByRole("button", { name: "Apply import decisions" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Apply import decisions" }));

    await waitFor(() => {
      expect(mockApplyProfileImport).toHaveBeenCalledWith(
        "import-1",
        expect.arrayContaining([
          expect.objectContaining({ suggestionId: "suggestion-1", action: "add_incoming" }),
        ]),
      );
    });
  });

  it("deletes saved resume versions from the profile", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockListResumeVersions.mockResolvedValue({
      success: true,
      resumes: [
        {
          id: "resume-1",
          content: "Imported resume text",
          created_at: "2026-04-04T10:10:00.000Z",
          file_name: "resume.pdf",
          file_path: "user-1/resume.pdf",
          file_size_bytes: 10,
          is_active: true,
          mime_type: "application/pdf",
          parsed_data: null,
          search_id: null,
          source: "upload",
          superseded_at: null,
          user_id: "user-1",
        },
      ],
    });

    renderProfile();

    expect(await screen.findByText("Resume versions")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete all resumes" }));

    await waitFor(() => {
      expect(mockDeleteResume).toHaveBeenCalled();
    });

    expect(await screen.findByText("Resume versions deleted.")).toBeInTheDocument();
    expect(screen.getByText("No resume versions yet. Import one to seed the profile.")).toBeInTheDocument();
  });
});
