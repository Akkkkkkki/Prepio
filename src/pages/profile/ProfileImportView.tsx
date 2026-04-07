import { Globe, Loader2, RefreshCcw, Sparkles, Trash2, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getDefaultMergeAction } from "@/lib/candidateProfile";

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

const ProfileImportView = ({ workspace }: ProfileImportViewProps) => {
  const {
    activeImport,
    activeResume,
    confirmDeleteResume,
    groupedSuggestions,
    handleApplyImport,
    handleImportPastedText,
    isApplyingImport,
    isDeletingResume,
    isImportingText,
    isUploadingResume,
    mergeDecisions,
    resumeText,
    resumeVersions,
    setMergeDecision,
    setResumeText,
  } = workspace;

  return (
    <div className="space-y-6">
      <ProfileHeader
        title="Import"
        status={activeImport ? "Pending import review is ready." : `Current source: ${formatResumeLabel(activeResume)}`}
        description="Upload, paste, review, and manage resume imports here. Existing richer profile content stays preserved by default."
      />

      <ProfileSectionCard
        title="Bring in new material"
        description="This is the only place for uploads, pasted text, and future LinkedIn import."
        icon={<Upload className="h-5 w-5 text-primary" />}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_280px]">
          <div className="space-y-4">
            <div className="rounded-3xl border-2 border-dashed p-6 text-center">
              <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Upload a PDF or DOCX, or paste resume text below to create a structured import draft.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4"
                onClick={() => document.getElementById(PROFILE_CV_UPLOAD_ID)?.click()}
                disabled={isUploadingResume}
              >
                {isUploadingResume ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {isUploadingResume ? "Processing..." : "Upload PDF / DOCX"}
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-import-text">Paste resume text</Label>
              <Textarea
                id="profile-import-text"
                value={resumeText}
                onChange={(event) => setResumeText(event.target.value)}
                rows={10}
                placeholder="Paste the latest resume text here..."
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
              {isImportingText ? "Creating import..." : "Create import draft from text"}
            </Button>
          </div>

          <div className="space-y-4 rounded-3xl border border-border/70 bg-muted/20 p-5">
            <div className="space-y-2">
              <p className="text-sm font-medium">LinkedIn import</p>
              <p className="text-sm text-muted-foreground">
                This will arrive later. Phase 1 keeps the entry point visible without adding OAuth or scraping flows.
              </p>
            </div>
            <Button type="button" variant="outline" className="w-full" disabled>
              <Globe className="h-4 w-4" />
              Import from LinkedIn
            </Button>
            <Badge variant="secondary">Coming soon</Badge>
          </div>
        </div>
      </ProfileSectionCard>

      <ProfileSectionCard
        title="Import review"
        description="We preserve richer existing profile data by default. Override only when the incoming version is actually better."
        icon={<Sparkles className="h-5 w-5 text-primary" />}
      >
        {activeImport ? (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{activeImport.importSummary.newCount} new</Badge>
              <Badge variant="secondary">{activeImport.importSummary.conflictingCount} conflicts</Badge>
              <Badge variant="secondary">{activeImport.importSummary.duplicateCount} duplicates</Badge>
              <Badge variant="secondary">{activeImport.importSummary.missingCount} missing</Badge>
            </div>

            {[
              ["New from import", groupedSuggestions.new],
              ["Conflicts with existing profile", groupedSuggestions.conflicts],
              ["Possible duplicates", groupedSuggestions.duplicates],
              ["Missing from the new resume", groupedSuggestions.missing],
            ].map(([label, suggestions]) =>
              suggestions.length > 0 ? (
                <div key={label} className="space-y-3">
                  <p className="text-sm font-medium">{label}</p>
                  {suggestions.map((suggestion) => {
                    const currentAction =
                      mergeDecisions[suggestion.id] ?? getDefaultMergeAction(suggestion);

                    return (
                      <div key={suggestion.id} className="space-y-3 rounded-2xl border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{suggestion.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {profileImportSectionLabel[suggestion.section]} · {suggestion.message}
                            </p>
                          </div>
                          <Badge variant="outline">{suggestion.kind.replace(/_/g, " ")}</Badge>
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
              ) : null,
            )}

            <Button className="w-full" onClick={() => void handleApplyImport()} disabled={isApplyingImport}>
              {isApplyingImport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isApplyingImport ? "Applying merge..." : "Apply import decisions"}
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            Upload or paste a resume to generate a review draft.
          </div>
        )}
      </ProfileSectionCard>

      <ProfileSectionCard
        title="Resume versions"
        description="Version history and destructive delete stay scoped to this import area."
        icon={<Globe className="h-5 w-5 text-primary" />}
        action={
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={confirmDeleteResume}
            disabled={isDeletingResume || resumeVersions.length === 0}
          >
            {isDeletingResume ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete resume versions
          </Button>
        }
      >
        {resumeVersions.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            No resume versions yet. Import one to seed the profile.
          </div>
        ) : (
          <div className="space-y-3">
            {resumeVersions.map((resume) => (
              <div key={resume.id} className="space-y-2 rounded-2xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{formatResumeLabel(resume)}</p>
                    <p className="text-xs text-muted-foreground">
                      {resume.source === "upload" ? "Uploaded file" : "Pasted text"} · Saved {formatDate(resume.created_at)}
                    </p>
                  </div>
                  {resume.is_active ? <Badge>Active</Badge> : <Badge variant="outline">Archived</Badge>}
                </div>
                {resume.file_name ? <p className="text-xs text-muted-foreground">{resume.file_name}</p> : null}
              </div>
            ))}
          </div>
        )}
      </ProfileSectionCard>
    </div>
  );
};

export default ProfileImportView;
