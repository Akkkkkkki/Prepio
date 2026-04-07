import { useEffect, useState, useTransition, type ChangeEvent } from "react";

import { useAuthContext } from "@/components/AuthProvider";
import type {
  CandidateProfile,
  ProfileImportRecord,
  ProfileMergeDecisionAction,
} from "@/lib/candidateProfile";
import {
  candidateProfileFromLegacyParsedData,
  createEmptyCandidateProfile,
  normalizeCandidateProfile,
} from "@/lib/candidateProfile";
import {
  buildResumeStoragePath,
  extractResumeText,
  ResumeUploadError,
} from "@/lib/resumeUpload";
import { searchService } from "@/services/searchService";

import {
  buildMergeDecisionState,
  groupSuggestions,
  type ResumeVersion,
} from "./profileUtils";

export type SeniorityLevel = "junior" | "mid" | "senior";

export interface ProfileWorkspaceState {
  activeImport: ProfileImportRecord | null;
  activeResume: ResumeVersion | null;
  bootstrappedFromLegacy: boolean;
  error: string | null;
  groupedSuggestions: ReturnType<typeof groupSuggestions>;
  isApplyingImport: boolean;
  isDeletingResume: boolean;
  isImportingText: boolean;
  isLoading: boolean;
  isPendingTransition: boolean;
  isSaving: boolean;
  isSavingSeniority: boolean;
  isUploadingResume: boolean;
  mergeDecisions: Record<string, ProfileMergeDecisionAction>;
  profile: CandidateProfile;
  resumeText: string;
  resumeVersions: ResumeVersion[];
  seniority: SeniorityLevel | undefined;
  showDeleteConfirm: boolean;
  success: string | null;
  confirmDeleteResume: () => void;
  handleApplyImport: () => Promise<void>;
  handleDeleteResume: () => Promise<void>;
  handleFileUpload: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleImportPastedText: () => Promise<void>;
  handleSaveSeniority: (value: SeniorityLevel) => Promise<void>;
  saveProfile: () => Promise<void>;
  setMergeDecision: (suggestionId: string, action: ProfileMergeDecisionAction) => void;
  setResumeText: (value: string) => void;
  setShowDeleteConfirm: (value: boolean) => void;
  updateProfile: (nextProfile: CandidateProfile) => void;
}

export const useProfileWorkspace = (): ProfileWorkspaceState => {
  const { user } = useAuthContext();
  const [profile, setProfile] = useState<CandidateProfile>(() => createEmptyCandidateProfile(""));
  const [resumeText, setResumeTextState] = useState("");
  const [resumeVersions, setResumeVersions] = useState<ResumeVersion[]>([]);
  const [activeImport, setActiveImport] = useState<ProfileImportRecord | null>(null);
  const [mergeDecisions, setMergeDecisions] = useState<Record<string, ProfileMergeDecisionAction>>(
    {},
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isImportingText, setIsImportingText] = useState(false);
  const [isApplyingImport, setIsApplyingImport] = useState(false);
  const [isDeletingResume, setIsDeletingResume] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSavingSeniority, setIsSavingSeniority] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [seniority, setSeniority] = useState<SeniorityLevel | undefined>(undefined);
  const [bootstrappedFromLegacy, setBootstrappedFromLegacy] = useState(false);
  const [isPendingTransition, startTransition] = useTransition();

  const activeResume = resumeVersions.find((resume) => resume.is_active) ?? resumeVersions[0] ?? null;
  const groupedSuggestions = groupSuggestions(activeImport?.mergeSuggestions ?? []);

  const pushSuccess = (message: string) => {
    setSuccess(message);
    window.setTimeout(() => setSuccess(null), 4000);
  };

  const hydrateProfileState = (nextProfile: CandidateProfile) => {
    startTransition(() => {
      setProfile(normalizeCandidateProfile(nextProfile, nextProfile.userId || user?.id || ""));
    });
  };

  const refreshResumeVersions = async () => {
    const result = await searchService.listResumeVersions();
    if (result.success && result.resumes) {
      setResumeVersions(result.resumes);
      if (result.resumes[0]?.content) {
        setResumeTextState(result.resumes[0].content);
      }
    }
  };

  useEffect(() => {
    const loadProfileWorkspace = async () => {
      if (!user) {
        setError("Please sign in to view your profile");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [profileResult, candidateProfileResult, activeResumeResult, versionsResult, importResult] =
          await Promise.all([
            searchService.getProfile(user.id),
            searchService.getCandidateProfile(),
            searchService.getResume(user.id),
            searchService.listResumeVersions(),
            searchService.getLatestProfileImport(),
          ]);

        if (profileResult.success && profileResult.profile) {
          setSeniority(profileResult.profile.seniority as SeniorityLevel | undefined);
        }

        const versions = versionsResult.success && versionsResult.resumes ? versionsResult.resumes : [];
        setResumeVersions(versions);

        const activeResumeRecord = activeResumeResult.success ? activeResumeResult.resume : null;
        setResumeTextState(activeResumeRecord?.content || "");
        const nextImport = importResult.success ? importResult.profileImport : null;

        let nextProfile =
          candidateProfileResult.success && candidateProfileResult.profile
            ? candidateProfileResult.profile
            : createEmptyCandidateProfile(user.id);
        let usedLegacyBootstrap = false;

        if (!candidateProfileResult.profile && nextImport?.draftProfile) {
          nextProfile = normalizeCandidateProfile(
            {
              ...nextImport.draftProfile,
              lastResumeId: nextImport.resumeId ?? nextImport.draftProfile.lastResumeId,
            },
            user.id,
          );
        } else if (!candidateProfileResult.profile && activeResumeRecord?.parsed_data) {
          nextProfile = normalizeCandidateProfile(
            {
              ...candidateProfileFromLegacyParsedData(
                activeResumeRecord.parsed_data as never,
                user.id,
              ),
              lastResumeId: activeResumeRecord.id,
            },
            user.id,
          );
          usedLegacyBootstrap = true;
        }

        if (!nextProfile.lastResumeId && activeResumeRecord?.id) {
          nextProfile = normalizeCandidateProfile(
            {
              ...nextProfile,
              lastResumeId: activeResumeRecord.id,
            },
            user.id,
          );
        }

        startTransition(() => {
          setProfile(normalizeCandidateProfile(nextProfile, user.id));
        });
        setBootstrappedFromLegacy(usedLegacyBootstrap);
        setActiveImport(nextImport);
        setMergeDecisions(buildMergeDecisionState(nextImport));
      } catch (loadError) {
        console.error("Error loading profile:", loadError);
        setError("Failed to load your profile.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadProfileWorkspace();
  }, [user]);

  const updateProfile = (nextProfile: CandidateProfile) => {
    setProfile(normalizeCandidateProfile(nextProfile, user?.id || nextProfile.userId));
  };

  const saveProfile = async () => {
    if (!user) return;

    setIsSaving(true);
    setError(null);

    const result = await searchService.saveCandidateProfile(profile);
    if (result.success && result.profile) {
      hydrateProfileState(result.profile);
      setBootstrappedFromLegacy(false);
      pushSuccess("Profile saved.");
    } else {
      setError(result.error instanceof Error ? result.error.message : "Failed to save the profile.");
    }

    setIsSaving(false);
  };

  const syncImportedResume = async ({
    content,
    file,
  }: {
    content: string;
    file?: File;
  }) => {
    let uploadedPath: string | null = null;
    let resumeSaved = false;

    try {
      if (!user) {
        throw new Error("Please sign in to import a resume.");
      }

      const nextFile = file
        ? {
            name: file.name,
            size: file.size,
            mimeType: file.type,
            path: "",
          }
        : undefined;

      if (file) {
        const storagePath = buildResumeStoragePath(user.id, file.name);
        const uploadResult = await searchService.uploadResumeFile(file, storagePath);
        if (!uploadResult.success || !uploadResult.path) {
          throw new Error(
            uploadResult.error instanceof Error
              ? uploadResult.error.message
              : "Failed to upload resume file",
          );
        }

        uploadedPath = uploadResult.path;
        nextFile.path = uploadResult.path;
      }

      const saveResult = await searchService.saveResume({
        content,
        file: nextFile,
        source: file ? "upload" : "manual",
      });

      if (!saveResult.success || !saveResult.resume) {
        throw new Error(
          saveResult.error instanceof Error
            ? saveResult.error.message
            : "Failed to save resume version",
        );
      }
      resumeSaved = true;

      await refreshResumeVersions();
      setResumeTextState(content);

      const importResult = await searchService.createProfileImport({
        resumeText: content,
        resumeId: saveResult.resume.id,
        source: file ? "upload" : "manual",
        existingProfile: profile,
      });

      if (importResult.success && importResult.profileImport) {
        setActiveImport(importResult.profileImport);
        setMergeDecisions(buildMergeDecisionState(importResult.profileImport));
        pushSuccess(file ? "Resume uploaded. Review the import before applying it." : "Import draft ready for review.");
      } else {
        pushSuccess(
          file
            ? "Resume uploaded and versioned. Import suggestions are temporarily unavailable."
            : "Resume text saved as a version. Import suggestions are temporarily unavailable.",
        );
      }
    } catch (importError) {
      if (uploadedPath && !resumeSaved) {
        await searchService.deleteResumeFiles([uploadedPath]);
      }

      const message =
        importError instanceof ResumeUploadError
          ? importError.message
          : importError instanceof Error
            ? importError.message
            : "Failed to import that resume.";
      setError(message);
    }
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setIsUploadingResume(true);
    setError(null);
    setSuccess(null);

    try {
      const { text } = await extractResumeText(file);
      await syncImportedResume({ content: text, file });
    } finally {
      setIsUploadingResume(false);
    }
  };

  const handleImportPastedText = async () => {
    if (!resumeText.trim()) {
      setError("Paste resume text before creating an import draft.");
      return;
    }

    setIsImportingText(true);
    setError(null);
    setSuccess(null);

    try {
      await syncImportedResume({ content: resumeText.trim() });
    } finally {
      setIsImportingText(false);
    }
  };

  const handleApplyImport = async () => {
    if (!activeImport) return;

    setIsApplyingImport(true);
    setError(null);

    const result = await searchService.applyProfileImport(
      activeImport.id,
      Object.entries(mergeDecisions).map(([suggestionId, action]) => ({
        suggestionId,
        action,
      })),
    );

    if (result.success && result.profile) {
      hydrateProfileState(result.profile);
      setActiveImport(null);
      setMergeDecisions({});
      setBootstrappedFromLegacy(false);
      pushSuccess("Imported changes applied.");
    } else {
      setError(result.error instanceof Error ? result.error.message : "Failed to apply the import review.");
    }

    setIsApplyingImport(false);
  };

  const confirmDeleteResume = () => {
    if (!resumeVersions.length) return;
    setShowDeleteConfirm(true);
  };

  const handleDeleteResume = async () => {
    setShowDeleteConfirm(false);
    setIsDeletingResume(true);
    setError(null);
    setSuccess(null);

    const result = await searchService.deleteResume();

    if (result.success) {
      setResumeVersions([]);
      setResumeTextState("");
      hydrateProfileState({ ...profile, lastResumeId: null });
      setActiveImport(null);
      setMergeDecisions({});
      setBootstrappedFromLegacy(false);
      pushSuccess("Resume versions and import drafts deleted. Your profile is unchanged.");
    } else {
      setError(result.error instanceof Error ? result.error.message : "Failed to delete resume versions.");
    }

    setIsDeletingResume(false);
  };

  const handleSaveSeniority = async (value: SeniorityLevel) => {
    setIsSavingSeniority(true);
    setError(null);

    const result = await searchService.updateProfile({ seniority: value });
    if (result.success) {
      setSeniority(value);
      pushSuccess("Experience level updated.");
    } else {
      setError(result.error instanceof Error ? result.error.message : "Failed to update experience level.");
    }

    setIsSavingSeniority(false);
  };

  return {
    activeImport,
    activeResume,
    bootstrappedFromLegacy,
    confirmDeleteResume,
    error,
    groupedSuggestions,
    handleApplyImport,
    handleDeleteResume,
    handleFileUpload,
    handleImportPastedText,
    handleSaveSeniority,
    isApplyingImport,
    isDeletingResume,
    isImportingText,
    isLoading,
    isPendingTransition,
    isSaving,
    isSavingSeniority,
    isUploadingResume,
    mergeDecisions,
    profile,
    resumeText,
    resumeVersions,
    saveProfile,
    seniority,
    setMergeDecision: (suggestionId, action) =>
      setMergeDecisions((current) => ({ ...current, [suggestionId]: action })),
    setResumeText: setResumeTextState,
    setShowDeleteConfirm,
    showDeleteConfirm,
    success,
    updateProfile,
  };
};
