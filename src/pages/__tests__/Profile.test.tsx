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
const mockFinalizeProfileImportAutoApply = vi.fn();
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
    finalizeProfileImportAutoApply: (...args: unknown[]) => mockFinalizeProfileImportAutoApply(...args),
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

const renderProfile = (initialEntry = "/profile") =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/profile/*" element={<Profile />} />
      </Routes>
    </MemoryRouter>,
  );

describe("Profile page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: "user-1", email: "test@example.com" } });
    mockGetProfile.mockResolvedValue({ success: true, profile: { level: null } });
    mockGetResume.mockResolvedValue({ success: true, resume: null });
    mockListResumeVersions.mockResolvedValue({ success: true, resumes: [] });
    mockGetCandidateProfile.mockResolvedValue({ success: true, profile: null });
    mockGetLatestProfileImport.mockResolvedValue({ success: true, profileImport: null });
    mockSaveCandidateProfile.mockResolvedValue({
      success: true,
      profile: createEmptyCandidateProfile("user-1"),
    });
    mockFinalizeProfileImportAutoApply.mockResolvedValue({ success: true });
    mockDeleteResume.mockResolvedValue({ success: true });
    mockUpdateProfile.mockResolvedValue({ success: true, profile: { level: "mid" } });
  });

  it("shows loading state then renders the main profile view without import controls", async () => {
    renderProfile();

    expect(screen.getByText("Loading Profile")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
    });

    expect(screen.getByRole("heading", { name: "About" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update profile from pasted CV" })).not.toBeInTheDocument();
  });

  it("renders the preferences surface separately from import and profile editing", async () => {
    renderProfile("/profile/preferences");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Preferences" })).toBeInTheDocument();
    });

    expect(screen.getByText("Research defaults")).toBeInTheDocument();
    expect(screen.queryByText("Import review")).not.toBeInTheDocument();
    expect(screen.queryByText("About")).not.toBeInTheDocument();
  });

  it("renders the import surface separately from profile editing", async () => {
    renderProfile("/profile/import");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Import CV" })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Update profile from pasted CV" })).toBeInTheDocument();
    expect(screen.queryByText("Research defaults")).not.toBeInTheDocument();
    expect(screen.queryByText("About")).not.toBeInTheDocument();
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
        "We prefilled this profile from the last parsed resume. Save once to make it your editable canonical version.",
      ),
    ).toBeInTheDocument();
  });

  it("saves the structured candidate profile from the main view", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mockSaveCandidateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ headline: "Principal Engineer" }),
      );
    });
  });

  it("updates the visible profile immediately from pasted CV text", async () => {
    const importedProfile = normalizeCandidateProfile({
      userId: "user-1",
      headline: "Staff Engineer",
      experiences: [
        createEmptyExperience({
          id: "exp-1",
          company: "Acme",
          title: "Staff Engineer",
        }),
      ],
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
    mockCreateProfileImport.mockResolvedValue({
      success: true,
      profileImport,
      draftProfile: importedProfile,
      mergeSuggestions: profileImport.mergeSuggestions,
      importSummary: profileImport.importSummary,
    });
    mockSaveCandidateProfile.mockResolvedValue({
      success: true,
      profile: normalizeCandidateProfile({
        userId: "user-1",
        headline: "Staff Engineer",
        experiences: [
          createEmptyExperience({
            id: "exp-1",
            company: "Acme",
            title: "Staff Engineer",
          }),
        ],
      }),
    });

    renderProfile("/profile/import");

    const resumeTextarea = await screen.findByLabelText("Paste resume text");
    fireEvent.change(resumeTextarea, { target: { value: "Imported resume text" } });
    fireEvent.click(screen.getByRole("button", { name: "Update profile from pasted CV" }));

    await waitFor(() => {
      expect(mockSaveCandidateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ headline: "Staff Engineer" }),
      );
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
    });

    expect(await screen.findByDisplayValue("Staff Engineer")).toBeInTheDocument();
    expect(screen.getByText("Profile updated from CV. 1 item added.")).toBeInTheDocument();
    expect(mockFinalizeProfileImportAutoApply).toHaveBeenCalledWith("import-1", {
      importSummary: {
        newCount: 0,
        duplicateCount: 0,
        conflictingCount: 0,
        missingCount: 0,
      },
      unresolvedSuggestions: [],
    });
  });

  it("keeps conflicting CV details pending for review after auto-fill", async () => {
    const existingProfile = normalizeCandidateProfile({
      userId: "user-1",
      summary: "Existing profile summary.",
    });
    const importedProfile = normalizeCandidateProfile({
      userId: "user-1",
      summary: "Imported CV summary.",
      experiences: [
        createEmptyExperience({
          id: "exp-1",
          company: "Acme",
          title: "Staff Engineer",
        }),
      ],
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
          id: "suggestion-summary",
          kind: "conflicts_existing",
          section: "summary",
          title: "Career Summary",
          message: "Career Summary differs from the current profile.",
          field: "summary",
        },
        {
          id: "suggestion-exp",
          kind: "new",
          section: "experiences",
          title: "Staff Engineer at Acme",
          message: "New role from the latest resume import.",
          incomingId: "exp-1",
        },
      ],
      importSummary: {
        newCount: 1,
        duplicateCount: 0,
        conflictingCount: 1,
        missingCount: 0,
      },
      status: "pending",
      createdAt: "2026-04-04T10:10:00.000Z",
      appliedAt: null,
    };

    mockGetCandidateProfile.mockResolvedValue({ success: true, profile: existingProfile });
    mockSaveResume.mockResolvedValue({ success: true, resume: { id: "resume-1" } });
    mockCreateProfileImport.mockResolvedValue({ success: true, profileImport });
    mockSaveCandidateProfile.mockResolvedValue({
      success: true,
      profile: normalizeCandidateProfile({
        userId: "user-1",
        summary: "Existing profile summary.",
        experiences: [
          createEmptyExperience({
            id: "exp-1",
            company: "Acme",
            title: "Staff Engineer",
          }),
        ],
      }),
    });

    renderProfile("/profile/import");

    fireEvent.change(await screen.findByLabelText("Paste resume text"), {
      target: { value: "Imported resume text" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update profile from pasted CV" }));

    await waitFor(() => {
      expect(screen.getByText("Profile updated from CV. 1 item added. 1 detail needs review.")).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: /Review 1 detail/ })).toBeInTheDocument();
    expect(mockFinalizeProfileImportAutoApply).toHaveBeenCalledWith("import-1", {
      importSummary: {
        newCount: 0,
        duplicateCount: 0,
        conflictingCount: 1,
        missingCount: 0,
      },
      unresolvedSuggestions: [
        expect.objectContaining({ id: "suggestion-summary", kind: "conflicts_existing" }),
      ],
    });
  });

  it("shows current CV source without exposing archive versions", async () => {
    mockListResumeVersions.mockResolvedValue({
      success: true,
      resumes: [
        {
          id: "resume-2",
          content: "Latest resume text",
          created_at: "2026-04-05T10:00:00.000Z",
          file_name: "latest.pdf",
          file_path: "user-1/latest.pdf",
          file_size_bytes: 1234,
          is_active: true,
          mime_type: "application/pdf",
          parsed_data: null,
          search_id: null,
          source: "upload",
          superseded_at: null,
          user_id: "user-1",
        },
        {
          id: "resume-1",
          content: "Old resume text",
          created_at: "2026-04-04T10:00:00.000Z",
          file_name: "old.pdf",
          file_path: "user-1/old.pdf",
          file_size_bytes: 1234,
          is_active: false,
          mime_type: "application/pdf",
          parsed_data: null,
          search_id: null,
          source: "upload",
          superseded_at: "2026-04-05T10:00:00.000Z",
          user_id: "user-1",
        },
      ],
    });

    renderProfile("/profile/import");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Current CV source" })).toBeInTheDocument();
    });

    expect(screen.getAllByText("latest.pdf").length).toBeGreaterThan(0);
    expect(screen.queryByText("Resume versions")).not.toBeInTheDocument();
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
    expect(screen.queryByText("old.pdf")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete CV data" })).toBeInTheDocument();
  });

  it("keeps legacy pending imports with unapplied new suggestions reviewable", async () => {
    const importedProfile = normalizeCandidateProfile({
      userId: "user-1",
      headline: "Staff Engineer",
      lastResumeId: "resume-1",
    });
    const profileImport = {
      id: "import-legacy",
      userId: "user-1",
      resumeId: "resume-1",
      source: "manual",
      draftProfile: importedProfile,
      mergeSuggestions: [
        {
          id: "suggestion-headline",
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

    mockGetLatestProfileImport.mockResolvedValue({ success: true, profileImport });
    mockApplyProfileImport.mockResolvedValue({
      success: true,
      profile: normalizeCandidateProfile({ userId: "user-1", headline: "Staff Engineer" }),
    });

    renderProfile("/profile/import");

    await waitFor(() => {
      expect(screen.getByText("Headline")).toBeInTheDocument();
    });

    expect(screen.queryByText("No CV details need review.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply selected changes" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Apply selected changes" }));

    await waitFor(() => {
      expect(mockApplyProfileImport).toHaveBeenCalledWith("import-legacy", [
        { suggestionId: "suggestion-headline", action: "add_incoming" },
      ]);
    });
  });

  it("shows an error when CV import analysis fails after saving the CV", async () => {
    mockSaveResume.mockResolvedValue({ success: true, resume: { id: "resume-1" } });
    mockCreateProfileImport.mockResolvedValue({
      success: false,
      error: new Error("profile import unavailable"),
    });

    renderProfile("/profile/import");

    fireEvent.change(await screen.findByLabelText("Paste resume text"), {
      target: { value: "Imported resume text" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update profile from pasted CV" }));

    await waitFor(() => {
      expect(screen.getByText("CV saved, but the profile update failed. Please try again.")).toBeInTheDocument();
    });

    expect(mockSaveCandidateProfile).not.toHaveBeenCalled();
  });

  it("shows a recovery error when import finalization fails after profile save", async () => {
    const importedProfile = normalizeCandidateProfile({
      userId: "user-1",
      headline: "Staff Engineer",
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

    mockSaveResume.mockResolvedValue({ success: true, resume: { id: "resume-1" } });
    mockCreateProfileImport.mockResolvedValue({ success: true, profileImport });
    mockSaveCandidateProfile.mockResolvedValue({
      success: true,
      profile: normalizeCandidateProfile({ userId: "user-1", headline: "Staff Engineer" }),
    });
    mockFinalizeProfileImportAutoApply.mockResolvedValue({
      success: false,
      error: new Error("update failed"),
    });

    renderProfile("/profile/import");

    fireEvent.change(await screen.findByLabelText("Paste resume text"), {
      target: { value: "Imported resume text" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update profile from pasted CV" }));

    await waitFor(() => {
      expect(
        screen.getByText("Profile updated, but import cleanup failed. Refresh before importing another CV."),
      ).toBeInTheDocument();
    });
  });
});
