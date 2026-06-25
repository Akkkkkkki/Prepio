import { FileText, Loader2, RefreshCcw, Sparkles, Trash2, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  CandidateProfile,
  ProfileImportSection,
  ProfileImportSuggestion,
} from "@/lib/candidateProfile";

import ProfileHeader from "./ProfileHeader";
import ProfileSectionCard from "./ProfileSectionCard";
import {
  formatDate,
  formatResumeLabel,
  getMergeActionOptions,
  PROFILE_CV_UPLOAD_ID,
  profileImportSectionLabel,
} from "./profileUtils";
import type { ProfileWorkspaceState } from "./useProfileWorkspace";

interface ProfileImportViewProps {
  workspace: ProfileWorkspaceState;
}

const scalarSectionLabels: Partial<Record<ProfileImportSection, keyof CandidateProfile>> = {
  headline: "headline",
  summary: "summary",
  location: "location",
};

const stringifyValue = (value: unknown): string => {
  if (!value) return "No matching value";
  if (typeof value === "string") return value || "No matching value";

  if (Array.isArray(value)) {
    return value.map(stringifyValue).filter(Boolean).join("\n");
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const primary = [
      record.title,
      record.company ? `at ${record.company}` : null,
      record.name,
      record.degree,
      record.institution,
      record.language,
      record.proficiency,
      record.label,
      record.url,
    ]
      .filter(Boolean)
      .join(" ");
    const secondary = [
      record.summary,
      record.context,
      Array.isArray(record.skills) ? record.skills.join(", ") : null,
      Array.isArray(record.bullets)
        ? record.bullets
            .map((bullet) =>
              typeof bullet === "object" && bullet ? (bullet as { text?: string }).text : "",
            )
            .filter(Boolean)
            .join("\n")
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    return [primary, secondary].filter(Boolean).join("\n") || "No matching value";
  }

  return String(value);
};

const getProfileValueForSuggestion = (
  profile: CandidateProfile,
  suggestion: ProfileImportSuggestion,
  side: "current" | "incoming",
) => {
  const scalarKey = scalarSectionLabels[suggestion.section];
  if (scalarKey) {
    return stringifyValue(profile[scalarKey]);
  }

  const collection = profile[suggestion.section];
  if (!Array.isArray(collection)) {
    return "No matching value";
  }

  const targetId = side === "current" ? suggestion.existingId : suggestion.incomingId;
  const item = collection.find((entry) => entry.id === targetId);
  return stringifyValue(item);
};

const ProfileImportView = ({ workspace }: ProfileImportViewProps) => {
  const {
    activeImport,
    activeResume,
    confirmDeleteResume,
    handleApplyImport,
    handleImportPastedText,
    isApplyingImport,
    isDeletingResume,
    isImportingText,
    isUploadingResume,
    mergeDecisions,
    profile,
    resumeText,
    setMergeDecision,
    setResumeText,
  } = workspace;
  const conflictSuggestions = activeImport?.mergeSuggestions.filter(
    (suggestion) => suggestion.kind === "conflicts_existing",
  ) ?? [];
  const hasLegacyUnappliedSuggestions =
    activeImport?.mergeSuggestions.some((suggestion) => suggestion.kind !== "conflicts_existing") ?? false;
  const reviewSuggestions = hasLegacyUnappliedSuggestions
    ? activeImport?.mergeSuggestions ?? []
    : conflictSuggestions;
  const reviewKeepsCurrent = reviewSuggestions.every(
    (suggestion) => (mergeDecisions[suggestion.id] ?? "keep_existing") === "keep_existing",
  );
  const reviewDescription = hasLegacyUnappliedSuggestions
    ? "This pending CV review was created before automatic profile updates. Finish it here before importing another CV."
    : "Only conflicts need decisions. New details are already on the Profile page.";

  return (
    <div className="space-y-6">
      <ProfileHeader
        title="Import CV"
        status={activeImport ? "CV details need review." : `Current source: ${formatResumeLabel(activeResume)}`}
        description="Upload or paste a CV to update the structured profile. New details fill automatically; conflicts stay here for review."
      />

      <ProfileSectionCard
        title="Update from CV"
        description="New CV details will appear on the Profile page immediately."
        icon={<Upload className="h-5 w-5 text-primary" />}
      >
        <div className="space-y-4">
          <div className="rounded-[20px] border-2 border-dashed p-6 text-center">
            <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Upload a PDF or DOCX, or paste CV text below.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Files are read in your browser. Your CV is saved privately to your account, and you can
              delete it anytime from Current CV source below.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              onClick={() => document.getElementById(PROFILE_CV_UPLOAD_ID)?.click()}
              disabled={isUploadingResume}
            >
              {isUploadingResume ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {isUploadingResume ? "Updating profile..." : "Upload PDF / DOCX"}
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-import-text">Paste resume text</Label>
            <Textarea
              id="profile-import-text"
              value={resumeText}
              onChange={(event) => setResumeText(event.target.value)}
              rows={10}
              placeholder="Paste the latest CV text here..."
            />
          </div>

          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => void handleImportPastedText()}
            disabled={isImportingText || !resumeText.trim()}
          >
            {isImportingText ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            {isImportingText ? "Updating profile..." : "Update profile from pasted CV"}
          </Button>
        </div>
      </ProfileSectionCard>

      <ProfileSectionCard
        title="Review CV details"
        description={reviewDescription}
        icon={<Sparkles className="h-5 w-5 text-primary" />}
      >
        {activeImport && reviewSuggestions.length > 0 ? (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{reviewSuggestions.length} need review</Badge>
            </div>

            <div className="space-y-3">
              {reviewSuggestions.map((suggestion) => {
                const currentAction = mergeDecisions[suggestion.id] ?? "keep_existing";

                return (
                  <div key={suggestion.id} className="space-y-4 rounded-2xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{suggestion.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {profileImportSectionLabel[suggestion.section]} · {suggestion.message}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {suggestion.kind === "conflicts_existing" ? "Conflict" : suggestion.kind.replace(/_/g, " ")}
                      </Badge>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2 rounded-2xl bg-muted/40 p-4">
                        <p className="text-xs font-medium uppercase text-muted-foreground">Current profile</p>
                        <p className="whitespace-pre-line text-sm">
                          {getProfileValueForSuggestion(profile, suggestion, "current")}
                        </p>
                      </div>
                      <div className="space-y-2 rounded-2xl bg-muted/40 p-4">
                        <p className="text-xs font-medium uppercase text-muted-foreground">From CV</p>
                        <p className="whitespace-pre-line text-sm">
                          {getProfileValueForSuggestion(activeImport.draftProfile, suggestion, "incoming")}
                        </p>
                      </div>
                    </div>

                    <Select
                      value={currentAction}
                      onValueChange={(value) => setMergeDecision(suggestion.id, value as typeof currentAction)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getMergeActionOptions(suggestion).map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>

            <Button className="w-full" onClick={() => void handleApplyImport()} disabled={isApplyingImport}>
              {isApplyingImport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isApplyingImport
                ? "Finishing review..."
                : reviewKeepsCurrent
                  ? "Finish review"
                  : "Apply selected changes"}
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            No CV details need review.
          </div>
        )}
      </ProfileSectionCard>

      <ProfileSectionCard
        title="Current CV source"
        description="CV files and pasted text are source material. The Profile page is the editable version."
        icon={<FileText className="h-5 w-5 text-primary" />}
        action={
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={confirmDeleteResume}
            disabled={isDeletingResume || !activeResume}
          >
            {isDeletingResume ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete CV data
          </Button>
        }
      >
        {!activeResume ? (
          <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            No CV source saved yet. Import one to update the profile.
          </div>
        ) : (
          <div className="space-y-2 rounded-2xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{formatResumeLabel(activeResume)}</p>
                <p className="text-xs text-muted-foreground">
                  {activeResume.source === "upload" ? "Uploaded file" : "Pasted CV text"} · Saved{" "}
                  {formatDate(activeResume.created_at)}
                </p>
              </div>
              <Badge>Current</Badge>
            </div>
            {activeResume.file_name ? <p className="text-xs text-muted-foreground">{activeResume.file_name}</p> : null}
          </div>
        )}
      </ProfileSectionCard>
    </div>
  );
};

export default ProfileImportView;
