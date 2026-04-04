import { useEffect, useState, useTransition } from "react";

import Navigation from "@/components/Navigation";
import { useAuthContext } from "@/components/AuthProvider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  Award,
  BookOpen,
  Briefcase,
  CheckCircle,
  FileText,
  FolderKanban,
  Globe,
  GraduationCap,
  Languages,
  Loader2,
  MapPin,
  Plus,
  RefreshCcw,
  Sparkles,
  Star,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";

import type { Tables } from "@/integrations/supabase/types";
import {
  type CandidateProfile,
  type ProfileBullet,
  type ProfileCertification,
  type ProfileEducation,
  type ProfileExperience,
  type ProfileImportRecord,
  type ProfileImportSection,
  type ProfileImportSuggestion,
  type ProfileLanguage,
  type ProfileLink,
  type ProfileMergeDecisionAction,
  type ProfileProject,
  type ProfileSkillGroup,
  PROFILE_USAGE_SURFACES,
  candidateProfileFromLegacyParsedData,
  createEmptyCandidateProfile,
  createEmptyCertification,
  createEmptyEducation,
  createEmptyExperience,
  createEmptyLanguage,
  createEmptyProfileBullet,
  createEmptyProfileLink,
  createEmptyProject,
  createEmptySkillGroup,
  getDefaultMergeAction,
  normalizeCandidateProfile,
} from "@/lib/candidateProfile";
import {
  ACCEPTED_RESUME_TYPES,
  ResumeUploadError,
  buildResumeStoragePath,
  extractResumeText,
} from "@/lib/resumeUpload";
import { searchService } from "@/services/searchService";

type ResumeVersion = Tables<"resumes">;
type SeniorityLevel = "junior" | "mid" | "senior";

const PROFILE_CV_UPLOAD_ID = "profile-cv-upload";

const emptyPromptBySection: Record<string, string> = {
  experiences: "Add the roles and bullets you would actually use in an interview, including stories you trimmed for space on the resume.",
  projects: "Add side projects, internal initiatives, and practice-only examples you still want to talk through confidently.",
};

const splitCsv = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const formatDate = (value?: string | null) => {
  if (!value) return "Unknown";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
};

const formatResumeLabel = (resume: ResumeVersion | null | undefined) => {
  if (!resume) return "No active resume";
  if (resume.file_name) return resume.file_name;
  return resume.source === "upload" ? "Uploaded resume text" : "Pasted resume text";
};

const buildMergeDecisionState = (profileImport: ProfileImportRecord | null) => {
  if (!profileImport) {
    return {};
  }

  return Object.fromEntries(
    profileImport.mergeSuggestions.map((suggestion) => [
      suggestion.id,
      getDefaultMergeAction(suggestion),
    ]),
  ) as Record<string, ProfileMergeDecisionAction>;
};

const groupSuggestions = (suggestions: ProfileImportSuggestion[]) => ({
  new: suggestions.filter((suggestion) => suggestion.kind === "new"),
  conflicts: suggestions.filter((suggestion) => suggestion.kind === "conflicts_existing"),
  duplicates: suggestions.filter((suggestion) => suggestion.kind === "possible_duplicate"),
  missing: suggestions.filter((suggestion) => suggestion.kind === "missing_from_import"),
});

const getMergeActionOptions = (
  suggestion: ProfileImportSuggestion,
): Array<{ label: string; value: ProfileMergeDecisionAction }> => {
  if (suggestion.kind === "new") {
    return [
      { label: "Add incoming", value: "add_incoming" },
      { label: "Keep existing", value: "keep_existing" },
    ];
  }

  if (suggestion.kind === "missing_from_import") {
    return [{ label: "Keep existing", value: "keep_existing" }];
  }

  if (suggestion.kind === "possible_duplicate") {
    const options: Array<{ label: string; value: ProfileMergeDecisionAction }> = [
      { label: "Keep existing", value: "keep_existing" },
    ];

    if (!["headline", "summary", "location"].includes(suggestion.section)) {
      options.push({ label: "Append incoming", value: "append_incoming" });
    }

    options.push({ label: "Replace existing", value: "replace_existing" });
    return options;
  }

  if (["headline", "summary", "location"].includes(suggestion.section)) {
    return [
      { label: "Keep existing", value: "keep_existing" },
      { label: "Replace existing", value: "replace_existing" },
    ];
  }

  return [
    { label: "Keep existing", value: "keep_existing" },
    { label: "Append incoming", value: "append_incoming" },
    { label: "Replace existing", value: "replace_existing" },
  ];
};

const profileImportSectionLabel: Record<ProfileImportSection, string> = {
  headline: "Headline",
  summary: "Summary",
  location: "Location",
  links: "Links",
  experiences: "Experience",
  projects: "Projects",
  skills: "Skills",
  education: "Education",
  certifications: "Certifications",
  languages: "Languages",
};

const updateArrayItem = <T,>(items: T[], index: number, nextItem: T) =>
  items.map((item, itemIndex) => (itemIndex === index ? nextItem : item));

const removeArrayItem = <T,>(items: T[], index: number) =>
  items.filter((_, itemIndex) => itemIndex !== index);

const CsvInput = ({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (nextValue: string[]) => void;
  placeholder: string;
}) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <Input
      value={value.join(", ")}
      onChange={(event) => onChange(splitCsv(event.target.value))}
      placeholder={placeholder}
    />
  </div>
);

const BulletEditor = ({
  bullet,
  onChange,
  onRemove,
}: {
  bullet: ProfileBullet;
  onChange: (nextBullet: ProfileBullet) => void;
  onRemove: () => void;
}) => (
  <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 space-y-3">
    <div className="flex items-start justify-between gap-3">
      <Label className="pt-1">Story bullet</Label>
      <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
    <Textarea
      value={bullet.text}
      onChange={(event) => onChange(createEmptyProfileBullet({ ...bullet, text: event.target.value }))}
      rows={3}
      placeholder="Describe the outcome, scope, and why this story matters in an interview."
    />
    <div className="grid gap-3 md:grid-cols-2">
      <CsvInput
        label="Competencies"
        value={bullet.competencyTags}
        onChange={(competencyTags) => onChange(createEmptyProfileBullet({ ...bullet, competencyTags }))}
        placeholder="Leadership, execution, strategy"
      />
      <CsvInput
        label="Interview themes"
        value={bullet.interviewThemes}
        onChange={(interviewThemes) => onChange(createEmptyProfileBullet({ ...bullet, interviewThemes }))}
        placeholder="STAR, influence, ambiguity"
      />
      <CsvInput
        label="Industries"
        value={bullet.industries}
        onChange={(industries) => onChange(createEmptyProfileBullet({ ...bullet, industries }))}
        placeholder="SaaS, fintech, consulting"
      />
      <CsvInput
        label="Focus areas"
        value={bullet.focusAreas}
        onChange={(focusAreas) => onChange(createEmptyProfileBullet({ ...bullet, focusAreas }))}
        placeholder="Technical, client-facing, leadership"
      />
    </div>
    <div className="flex items-center gap-3 rounded-xl border border-dashed p-3">
      <Checkbox
        checked={bullet.starStory}
        onCheckedChange={(checked) => onChange(createEmptyProfileBullet({ ...bullet, starStory: checked === true }))}
      />
      <div>
        <p className="text-sm font-medium">Mark as a star story</p>
        <p className="text-xs text-muted-foreground">
          Surface this bullet more often during practice and evidence matching.
        </p>
      </div>
    </div>
  </div>
);

const ExperienceEditor = ({
  experience,
  onChange,
  onRemove,
}: {
  experience: ProfileExperience;
  onChange: (nextExperience: ProfileExperience) => void;
  onRemove: () => void;
}) => (
  <AccordionItem value={experience.id} className="rounded-3xl border px-5">
    <AccordionTrigger className="py-5 hover:no-underline">
      <div className="text-left">
        <p className="font-medium">{experience.title || "Untitled role"}</p>
        <p className="text-sm text-muted-foreground">
          {experience.company || "Company"}{experience.startDate ? ` · ${experience.startDate}` : ""}
          {experience.endDate ? ` to ${experience.endDate}` : experience.current ? " to Present" : ""}
        </p>
      </div>
    </AccordionTrigger>
    <AccordionContent className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="mr-2 h-4 w-4" />
          Remove role
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Company</Label>
          <Input
            value={experience.company}
            onChange={(event) =>
              onChange(createEmptyExperience({ ...experience, company: event.target.value }))
            }
            placeholder="Company"
          />
        </div>
        <div className="space-y-2">
          <Label>Title</Label>
          <Input
            value={experience.title}
            onChange={(event) =>
              onChange(createEmptyExperience({ ...experience, title: event.target.value }))
            }
            placeholder="Title"
          />
        </div>
        <div className="space-y-2">
          <Label>Location</Label>
          <Input
            value={experience.location}
            onChange={(event) =>
              onChange(createEmptyExperience({ ...experience, location: event.target.value }))
            }
            placeholder="Location"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Start date</Label>
            <Input
              value={experience.startDate}
              onChange={(event) =>
                onChange(createEmptyExperience({ ...experience, startDate: event.target.value }))
              }
              placeholder="Jan 2022"
            />
          </div>
          <div className="space-y-2">
            <Label>End date</Label>
            <Input
              value={experience.endDate}
              onChange={(event) =>
                onChange(createEmptyExperience({ ...experience, endDate: event.target.value }))
              }
              placeholder={experience.current ? "Present" : "Dec 2024"}
              disabled={experience.current}
            />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-dashed p-3">
        <Checkbox
          checked={experience.current}
          onCheckedChange={(checked) =>
            onChange(
              createEmptyExperience({
                ...experience,
                current: checked === true,
                endDate: checked === true ? "" : experience.endDate,
              }),
            )
          }
        />
        <div>
          <p className="text-sm font-medium">Current role</p>
          <p className="text-xs text-muted-foreground">Keeps the end date open and marks the role as active.</p>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Role summary</Label>
        <Textarea
          value={experience.summary}
          onChange={(event) =>
            onChange(createEmptyExperience({ ...experience, summary: event.target.value }))
          }
          rows={3}
          placeholder="What was the scope of this role and why does it matter?"
        />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label>Bullet library</Label>
            <p className="text-xs text-muted-foreground">
              Keep fuller evidence here than you would on a one-page resume.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange(
                createEmptyExperience({
                  ...experience,
                  bullets: [...experience.bullets, createEmptyProfileBullet()],
                }),
              )
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add bullet
          </Button>
        </div>
        {experience.bullets.length === 0 && (
          <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            Add the bullet stories you still want to practice, even if they were cut from the resume.
          </p>
        )}
        <div className="space-y-3">
          {experience.bullets.map((bullet, bulletIndex) => (
            <BulletEditor
              key={bullet.id}
              bullet={bullet}
              onChange={(nextBullet) =>
                onChange(
                  createEmptyExperience({
                    ...experience,
                    bullets: updateArrayItem(experience.bullets, bulletIndex, nextBullet),
                  }),
                )
              }
              onRemove={() =>
                onChange(
                  createEmptyExperience({
                    ...experience,
                    bullets: removeArrayItem(experience.bullets, bulletIndex),
                  }),
                )
              }
            />
          ))}
        </div>
      </div>
    </AccordionContent>
  </AccordionItem>
);

const ProjectEditor = ({
  project,
  onChange,
  onRemove,
}: {
  project: ProfileProject;
  onChange: (nextProject: ProfileProject) => void;
  onRemove: () => void;
}) => (
  <AccordionItem value={project.id} className="rounded-3xl border px-5">
    <AccordionTrigger className="py-5 hover:no-underline">
      <div className="text-left">
        <p className="font-medium">{project.title || "Untitled project"}</p>
        <p className="text-sm text-muted-foreground">
          {project.technologies.length > 0 ? project.technologies.join(" · ") : "Project context and technologies"}
        </p>
      </div>
    </AccordionTrigger>
    <AccordionContent className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="mr-2 h-4 w-4" />
          Remove project
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Project title</Label>
          <Input
            value={project.title}
            onChange={(event) => onChange(createEmptyProject({ ...project, title: event.target.value }))}
            placeholder="Project title"
          />
        </div>
        <CsvInput
          label="Technologies"
          value={project.technologies}
          onChange={(technologies) => onChange(createEmptyProject({ ...project, technologies }))}
          placeholder="React, Python, SQL"
        />
      </div>
      <div className="space-y-2">
        <Label>Context</Label>
        <Textarea
          value={project.context}
          onChange={(event) => onChange(createEmptyProject({ ...project, context: event.target.value }))}
          rows={3}
          placeholder="What problem did this project solve and where did it happen?"
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <CsvInput
          label="Relevance tags"
          value={project.tags}
          onChange={(tags) => onChange(createEmptyProject({ ...project, tags }))}
          placeholder="Go-to-market, data, operations"
        />
        <div className="space-y-2">
          <Label>Links</Label>
          <Input
            value={project.links.map((link) => link.url).join(", ")}
            onChange={(event) =>
              onChange(
                createEmptyProject({
                  ...project,
                  links: splitCsv(event.target.value).map((url) => createEmptyProfileLink({ label: "Project link", url })),
                }),
              )
            }
            placeholder="https://example.com/demo, https://github.com/example"
          />
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label>Project bullets</Label>
            <p className="text-xs text-muted-foreground">Store the best evidence and follow-up detail here.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange(
                createEmptyProject({
                  ...project,
                  bullets: [...project.bullets, createEmptyProfileBullet()],
                }),
              )
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add bullet
          </Button>
        </div>
        {project.bullets.length === 0 && (
          <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            Add extra detail you would use in practice, even if it never appears on the resume itself.
          </p>
        )}
        <div className="space-y-3">
          {project.bullets.map((bullet, bulletIndex) => (
            <BulletEditor
              key={bullet.id}
              bullet={bullet}
              onChange={(nextBullet) =>
                onChange(
                  createEmptyProject({
                    ...project,
                    bullets: updateArrayItem(project.bullets, bulletIndex, nextBullet),
                  }),
                )
              }
              onRemove={() =>
                onChange(
                  createEmptyProject({
                    ...project,
                    bullets: removeArrayItem(project.bullets, bulletIndex),
                  }),
                )
              }
            />
          ))}
        </div>
      </div>
    </AccordionContent>
  </AccordionItem>
);

const Profile = () => {
  const { user } = useAuthContext();
  const [profile, setProfile] = useState<CandidateProfile>(() => createEmptyCandidateProfile(""));
  const [resumeText, setResumeText] = useState("");
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
  const [isSavingSeniority, setIsSavingSeniority] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [seniority, setSeniority] = useState<SeniorityLevel | undefined>(undefined);
  const [bootstrappedFromLegacy, setBootstrappedFromLegacy] = useState(false);
  const [isPendingTransition, startTransition] = useTransition();

  const activeResume = resumeVersions.find((resume) => resume.is_active) ?? resumeVersions[0] ?? null;
  const groupedSuggestions = groupSuggestions(activeImport?.mergeSuggestions || []);

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
        setResumeText(result.resumes[0].content);
      }
    }
  };

  useEffect(() => {
    const loadProfile = async () => {
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
        setResumeText(activeResumeRecord?.content || "");

        let nextProfile =
          candidateProfileResult.success && candidateProfileResult.profile
            ? candidateProfileResult.profile
            : createEmptyCandidateProfile(user.id);
        let usedLegacyBootstrap = false;

        if (!candidateProfileResult.profile && activeResumeRecord?.parsed_data) {
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

        const nextImport = importResult.success ? importResult.profileImport : null;
        setActiveImport(nextImport);
        setMergeDecisions(buildMergeDecisionState(nextImport));
      } catch (loadError) {
        console.error("Error loading profile:", loadError);
        setError("Failed to load your interview profile.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadProfile();
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
      pushSuccess("Interview profile saved.");
    } else {
      setError(result.error instanceof Error ? result.error.message : "Failed to save the interview profile.");
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
          throw new Error(uploadResult.error instanceof Error ? uploadResult.error.message : "Failed to upload resume file");
        }

        uploadedPath = uploadResult.path;
        nextFile!.path = uploadResult.path;
      }

      const saveResult = await searchService.saveResume({
        content,
        file: nextFile,
        source: file ? "upload" : "manual",
      });

      if (!saveResult.success || !saveResult.resume) {
        throw new Error(saveResult.error instanceof Error ? saveResult.error.message : "Failed to save resume version");
      }

      await refreshResumeVersions();
      setResumeText(content);

      const importResult = await searchService.createProfileImport({
        resumeText: content,
        resumeId: saveResult.resume.id,
        source: file ? "upload" : "manual",
        existingProfile: profile,
      });

      if (importResult.success && importResult.profileImport) {
        setActiveImport(importResult.profileImport);
        setMergeDecisions(buildMergeDecisionState(importResult.profileImport));
        pushSuccess(
          file
            ? "Resume uploaded. Review the merge before updating your interview profile."
            : "Resume text imported. Review the merge before applying changes.",
        );
      } else {
        pushSuccess(
          file
            ? "Resume uploaded and versioned. Structured import suggestions are temporarily unavailable."
            : "Resume text saved as a version. Structured import suggestions are temporarily unavailable.",
        );
      }
    } catch (importError) {
      if (uploadedPath) {
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
      pushSuccess("Imported changes applied to your interview profile.");
    } else {
      setError(result.error instanceof Error ? result.error.message : "Failed to apply the import review.");
    }

    setIsApplyingImport(false);
  };

  const handleDeleteResume = async () => {
    if (!resumeVersions.length) {
      return;
    }

    if (!window.confirm("Delete all saved resume versions? This cannot be undone.")) {
      return;
    }

    setIsDeletingResume(true);
    setError(null);
    setSuccess(null);

    const result = await searchService.deleteResume();

    if (result.success) {
      setResumeVersions([]);
      setResumeText("");
      hydrateProfileState({ ...profile, lastResumeId: null });
      setBootstrappedFromLegacy(false);
      pushSuccess("Resume versions deleted.");
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-10">
          <div className="mx-auto flex min-h-[420px] max-w-4xl items-center justify-center">
            <Card className="w-full max-w-md text-center">
              <CardHeader>
                <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin" />
                <CardTitle>Loading Interview Profile</CardTitle>
                <CardDescription>Pulling your structured profile, imports, and resume history.</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="main-content" className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-emerald-200 bg-emerald-50">
              <CheckCircle className="h-4 w-4 text-emerald-700" />
              <AlertDescription className="text-emerald-900">{success}</AlertDescription>
            </Alert>
          )}

          {bootstrappedFromLegacy && (
            <Alert className="border-amber-200 bg-amber-50">
              <Sparkles className="h-4 w-4 text-amber-700" />
              <AlertDescription className="text-amber-900">
                We prefilled this interview profile from the last parsed resume. Save once to make it your editable canonical profile.
              </AlertDescription>
            </Alert>
          )}

          {activeImport && (
            <Alert className="border-sky-200 bg-sky-50">
              <Sparkles className="h-4 w-4 text-sky-700" />
              <AlertDescription className="text-sky-950">
                We imported your resume as a starting point. Add extra bullets, projects, and examples you still want to practice before applying the merge.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <Badge variant="outline">Your Interview Profile</Badge>
              <h1 className="text-3xl font-semibold tracking-tight">Keep the richer version of your story.</h1>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Import a resume once, then keep a fuller profile with more bullets, projects, and examples than you would ever fit on a one-page CV.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={() => document.getElementById(PROFILE_CV_UPLOAD_ID)?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Upload resume
              </Button>
              <Button type="button" onClick={saveProfile} disabled={isSaving || isPendingTransition}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save profile
              </Button>
            </div>
          </div>

          <input
            id={PROFILE_CV_UPLOAD_ID}
            type="file"
            accept={ACCEPTED_RESUME_TYPES}
            className="hidden"
            onChange={handleFileUpload}
          />

          <div className="grid gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Profile completeness</CardTitle>
                <CardDescription>{profile.completionScore}% ready for downstream prep.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Progress value={profile.completionScore} />
                <p className="text-sm text-muted-foreground">
                  Add fuller role bullets, projects, and preferences to improve evidence coverage.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Resume source</CardTitle>
                <CardDescription>Active version: {formatResumeLabel(activeResume)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Latest import {activeImport ? formatDate(activeImport.createdAt) : formatDate(activeResume?.created_at)}</p>
                <p>{resumeVersions.length} saved resume version{resumeVersions.length === 1 ? "" : "s"}.</p>
                {activeImport ? (
                  <Badge variant="secondary">Pending merge review</Badge>
                ) : (
                  <Badge variant="outline">No pending import</Badge>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Used downstream</CardTitle>
                <CardDescription>This profile becomes the shared prep artifact.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {PROFILE_USAGE_SURFACES.map((surface) => (
                  <Badge key={surface} variant="secondary">
                    {surface}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,1fr)]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserRound className="h-5 w-5 text-primary" />
                    Core profile
                  </CardTitle>
                  <CardDescription>
                    This is the canonical profile that research, dashboard, and practice should use.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Headline</Label>
                      <Input
                        value={profile.headline}
                        onChange={(event) => updateProfile({ ...profile, headline: event.target.value })}
                        placeholder="Staff Product Manager · B2B growth and platform strategy"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Location</Label>
                      <Input
                        value={profile.location}
                        onChange={(event) => updateProfile({ ...profile, location: event.target.value })}
                        placeholder="London, UK"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Career summary</Label>
                    <Textarea
                      value={profile.summary}
                      onChange={(event) => updateProfile({ ...profile, summary: event.target.value })}
                      rows={5}
                      placeholder="Summarize the pattern of work you want to lead with in interviews."
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label>Links</Label>
                        <p className="text-xs text-muted-foreground">LinkedIn, portfolio, GitHub, talks, or case studies.</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => updateProfile({ ...profile, links: [...profile.links, createEmptyProfileLink()] })}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add link
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {profile.links.map((link, index) => (
                        <div key={link.id} className="grid gap-3 rounded-2xl border p-4 md:grid-cols-[1fr_1.6fr_auto]">
                          <Input
                            value={link.label}
                            onChange={(event) =>
                              updateProfile({
                                ...profile,
                                links: updateArrayItem(profile.links, index, createEmptyProfileLink({ ...link, label: event.target.value })),
                              })
                            }
                            placeholder="Label"
                          />
                          <Input
                            value={link.url}
                            onChange={(event) =>
                              updateProfile({
                                ...profile,
                                links: updateArrayItem(profile.links, index, createEmptyProfileLink({ ...link, url: event.target.value })),
                              })
                            }
                            placeholder="https://example.com"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => updateProfile({ ...profile, links: removeArrayItem(profile.links, index) })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {profile.links.length === 0 && (
                        <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                          Add profile links that help you tell a better story than a PDF alone.
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-primary" />
                    Experience
                  </CardTitle>
                  <CardDescription>
                    Keep role-level context and a fuller bullet library than the one-page resume allows.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => updateProfile({ ...profile, experiences: [...profile.experiences, createEmptyExperience()] })}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add role
                    </Button>
                  </div>
                  {profile.experiences.length === 0 ? (
                    <p className="rounded-3xl border border-dashed p-5 text-sm text-muted-foreground">
                      {emptyPromptBySection.experiences}
                    </p>
                  ) : (
                    <Accordion type="multiple" className="space-y-3">
                      {profile.experiences.map((experience, index) => (
                        <ExperienceEditor
                          key={experience.id}
                          experience={experience}
                          onChange={(nextExperience) =>
                            updateProfile({
                              ...profile,
                              experiences: updateArrayItem(profile.experiences, index, nextExperience),
                            })
                          }
                          onRemove={() =>
                            updateProfile({
                              ...profile,
                              experiences: removeArrayItem(profile.experiences, index),
                            })
                          }
                        />
                      ))}
                    </Accordion>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderKanban className="h-5 w-5 text-primary" />
                    Projects
                  </CardTitle>
                  <CardDescription>
                    Separate projects from roles so practice can surface the best supporting evidence.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => updateProfile({ ...profile, projects: [...profile.projects, createEmptyProject()] })}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add project
                    </Button>
                  </div>
                  {profile.projects.length === 0 ? (
                    <p className="rounded-3xl border border-dashed p-5 text-sm text-muted-foreground">
                      {emptyPromptBySection.projects}
                    </p>
                  ) : (
                    <Accordion type="multiple" className="space-y-3">
                      {profile.projects.map((project, index) => (
                        <ProjectEditor
                          key={project.id}
                          project={project}
                          onChange={(nextProject) =>
                            updateProfile({
                              ...profile,
                              projects: updateArrayItem(profile.projects, index, nextProject),
                            })
                          }
                          onRemove={() =>
                            updateProfile({
                              ...profile,
                              projects: removeArrayItem(profile.projects, index),
                            })
                          }
                        />
                      ))}
                    </Accordion>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Skills
                  </CardTitle>
                  <CardDescription>Organize skills into flexible groups instead of one flat list.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => updateProfile({ ...profile, skills: [...profile.skills, createEmptySkillGroup()] })}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add skill group
                    </Button>
                  </div>
                  {profile.skills.length === 0 && (
                    <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                      Group skills by function or domain so research and practice can match them cleanly.
                    </p>
                  )}
                  {profile.skills.map((group, index) => (
                    <div key={group.id} className="grid gap-3 rounded-2xl border p-4 md:grid-cols-[1fr_2fr_auto]">
                      <Input
                        value={group.name}
                        onChange={(event) =>
                          updateProfile({
                            ...profile,
                            skills: updateArrayItem(profile.skills, index, createEmptySkillGroup({ ...group, name: event.target.value })),
                          })
                        }
                        placeholder="Group name"
                      />
                      <Input
                        value={group.skills.join(", ")}
                        onChange={(event) =>
                          updateProfile({
                            ...profile,
                            skills: updateArrayItem(profile.skills, index, createEmptySkillGroup({ ...group, skills: splitCsv(event.target.value) })),
                          })
                        }
                        placeholder="React, SQL, market sizing"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => updateProfile({ ...profile, skills: removeArrayItem(profile.skills, index) })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <GraduationCap className="h-5 w-5 text-primary" />
                      Education
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => updateProfile({ ...profile, education: [...profile.education, createEmptyEducation()] })}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add education
                    </Button>
                    {profile.education.map((item, index) => (
                      <div key={item.id} className="space-y-3 rounded-2xl border p-4">
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => updateProfile({ ...profile, education: removeArrayItem(profile.education, index) })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input
                          value={item.degree}
                          onChange={(event) =>
                            updateProfile({
                              ...profile,
                              education: updateArrayItem(profile.education, index, createEmptyEducation({ ...item, degree: event.target.value })),
                            })
                          }
                          placeholder="Degree"
                        />
                        <Input
                          value={item.institution}
                          onChange={(event) =>
                            updateProfile({
                              ...profile,
                              education: updateArrayItem(profile.education, index, createEmptyEducation({ ...item, institution: event.target.value })),
                            })
                          }
                          placeholder="Institution"
                        />
                        <Input
                          value={item.year}
                          onChange={(event) =>
                            updateProfile({
                              ...profile,
                              education: updateArrayItem(profile.education, index, createEmptyEducation({ ...item, year: event.target.value })),
                            })
                          }
                          placeholder="Year"
                        />
                        <Textarea
                          value={item.description}
                          onChange={(event) =>
                            updateProfile({
                              ...profile,
                              education: updateArrayItem(profile.education, index, createEmptyEducation({ ...item, description: event.target.value })),
                            })
                          }
                          rows={3}
                          placeholder="Optional context"
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5 text-primary" />
                      Credentials and languages
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Certifications</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateProfile({
                              ...profile,
                              certifications: [...profile.certifications, createEmptyCertification()],
                            })
                          }
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add certification
                        </Button>
                      </div>
                      {profile.certifications.map((item, index) => (
                        <div key={item.id} className="grid gap-3 rounded-2xl border p-4 md:grid-cols-[1.3fr_1fr_0.7fr_auto]">
                          <Input
                            value={item.name}
                            onChange={(event) =>
                              updateProfile({
                                ...profile,
                                certifications: updateArrayItem(
                                  profile.certifications,
                                  index,
                                  createEmptyCertification({ ...item, name: event.target.value }),
                                ),
                              })
                            }
                            placeholder="Certification"
                          />
                          <Input
                            value={item.issuer}
                            onChange={(event) =>
                              updateProfile({
                                ...profile,
                                certifications: updateArrayItem(
                                  profile.certifications,
                                  index,
                                  createEmptyCertification({ ...item, issuer: event.target.value }),
                                ),
                              })
                            }
                            placeholder="Issuer"
                          />
                          <Input
                            value={item.year}
                            onChange={(event) =>
                              updateProfile({
                                ...profile,
                                certifications: updateArrayItem(
                                  profile.certifications,
                                  index,
                                  createEmptyCertification({ ...item, year: event.target.value }),
                                ),
                              })
                            }
                            placeholder="Year"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              updateProfile({
                                ...profile,
                                certifications: removeArrayItem(profile.certifications, index),
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Languages</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateProfile({
                              ...profile,
                              languages: [...profile.languages, createEmptyLanguage()],
                            })
                          }
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add language
                        </Button>
                      </div>
                      {profile.languages.map((item, index) => (
                        <div key={item.id} className="grid gap-3 rounded-2xl border p-4 md:grid-cols-[1fr_1fr_auto]">
                          <Input
                            value={item.language}
                            onChange={(event) =>
                              updateProfile({
                                ...profile,
                                languages: updateArrayItem(
                                  profile.languages,
                                  index,
                                  createEmptyLanguage({ ...item, language: event.target.value }),
                                ),
                              })
                            }
                            placeholder="Language"
                          />
                          <Input
                            value={item.proficiency}
                            onChange={(event) =>
                              updateProfile({
                                ...profile,
                                languages: updateArrayItem(
                                  profile.languages,
                                  index,
                                  createEmptyLanguage({ ...item, proficiency: event.target.value }),
                                ),
                              })
                            }
                            placeholder="Fluent, conversational"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              updateProfile({
                                ...profile,
                                languages: removeArrayItem(profile.languages, index),
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Preferences
                  </CardTitle>
                  <CardDescription>Give research and practice more context about the roles you care about.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-2">
                  <CsvInput
                    label="Target roles"
                    value={profile.preferences.targetRoles}
                    onChange={(targetRoles) =>
                      updateProfile({
                        ...profile,
                        preferences: { ...profile.preferences, targetRoles },
                      })
                    }
                    placeholder="Staff PM, growth lead, strategy manager"
                  />
                  <CsvInput
                    label="Target industries"
                    value={profile.preferences.targetIndustries}
                    onChange={(targetIndustries) =>
                      updateProfile({
                        ...profile,
                        preferences: { ...profile.preferences, targetIndustries },
                      })
                    }
                    placeholder="SaaS, healthcare, climate"
                  />
                  <CsvInput
                    label="Preferred locations"
                    value={profile.preferences.locations}
                    onChange={(locations) =>
                      updateProfile({
                        ...profile,
                        preferences: { ...profile.preferences, locations },
                      })
                    }
                    placeholder="London, remote, New York"
                  />
                  <CsvInput
                    label="Work modes"
                    value={profile.preferences.workModes}
                    onChange={(workModes) =>
                      updateProfile({
                        ...profile,
                        preferences: { ...profile.preferences, workModes },
                      })
                    }
                    placeholder="Remote, hybrid, onsite"
                  />
                  <div className="space-y-2 lg:col-span-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={profile.preferences.notes}
                      onChange={(event) =>
                        updateProfile({
                          ...profile,
                          preferences: { ...profile.preferences, notes: event.target.value },
                        })
                      }
                      rows={4}
                      placeholder="Any preference or constraint that should influence how we frame your prep."
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Resume import
                  </CardTitle>
                  <CardDescription>
                    Resumes are source artifacts. Import them here, then review the merge into your canonical profile.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-3xl border-2 border-dashed p-6 text-center">
                    <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Upload a PDF or DOCX, or paste resume text below to create a new import draft.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4"
                      onClick={() => document.getElementById(PROFILE_CV_UPLOAD_ID)?.click()}
                      disabled={isUploadingResume}
                    >
                      {isUploadingResume ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      {isUploadingResume ? "Processing..." : "Upload PDF / DOCX"}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>Paste resume text</Label>
                    <Textarea
                      value={resumeText}
                      onChange={(event) => setResumeText(event.target.value)}
                      rows={9}
                      placeholder="Paste the latest resume text here..."
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={handleImportPastedText}
                    disabled={isImportingText || !resumeText.trim()}
                  >
                    {isImportingText ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                    {isImportingText ? "Creating import..." : "Create import draft from text"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Import review
                  </CardTitle>
                  <CardDescription>
                    Default behavior preserves richer existing profile content unless you explicitly replace it.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activeImport ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{activeImport.importSummary.newCount} new</Badge>
                        <Badge variant="secondary">{activeImport.importSummary.conflictingCount} conflicts</Badge>
                        <Badge variant="secondary">{activeImport.importSummary.duplicateCount} duplicates</Badge>
                        <Badge variant="secondary">{activeImport.importSummary.missingCount} missing from import</Badge>
                      </div>

                      {[
                        ["New from import", groupedSuggestions.new],
                        ["Conflicts existing", groupedSuggestions.conflicts],
                        ["Possible duplicates", groupedSuggestions.duplicates],
                        ["Missing from new resume", groupedSuggestions.missing],
                      ].map(([label, suggestions]) =>
                        (suggestions as ProfileImportSuggestion[]).length > 0 ? (
                          <div key={label as string} className="space-y-3">
                            <p className="text-sm font-medium">{label as string}</p>
                            {(suggestions as ProfileImportSuggestion[]).map((suggestion) => {
                              const options = getMergeActionOptions(suggestion);
                              const currentAction =
                                mergeDecisions[suggestion.id] || getDefaultMergeAction(suggestion);

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
                                    onValueChange={(value) =>
                                      setMergeDecisions((current) => ({
                                        ...current,
                                        [suggestion.id]: value as ProfileMergeDecisionAction,
                                      }))
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {options.map((option) => (
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

                      <Button className="w-full" onClick={handleApplyImport} disabled={isApplyingImport}>
                        {isApplyingImport ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        {isApplyingImport ? "Applying merge..." : "Apply import decisions"}
                      </Button>
                    </>
                  ) : (
                    <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                      Upload or paste a resume to generate a review-merge draft.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-primary" />
                        Resume versions
                      </CardTitle>
                      <CardDescription>Keep version history instead of destructively replacing the old resume.</CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteResume}
                      disabled={isDeletingResume || resumeVersions.length === 0}
                    >
                      {isDeletingResume ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      Delete all resumes
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {resumeVersions.length === 0 ? (
                    <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                      No resume versions yet. Import one to seed the profile.
                    </p>
                  ) : (
                    resumeVersions.map((resume) => (
                      <div key={resume.id} className="rounded-2xl border p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{formatResumeLabel(resume)}</p>
                            <p className="text-xs text-muted-foreground">
                              {resume.source === "upload" ? "Uploaded file" : "Pasted text"} · Saved {formatDate(resume.created_at)}
                            </p>
                          </div>
                          {resume.is_active ? <Badge>Active</Badge> : <Badge variant="outline">Archived</Badge>}
                        </div>
                        {resume.file_name && (
                          <p className="text-xs text-muted-foreground">{resume.file_name}</p>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Languages className="h-5 w-5 text-primary" />
                    Downstream notes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>Research should use this structured profile as the main candidate context, with raw resume text only as fallback.</p>
                  <p>Dashboard can map job requirements against the bullets and projects stored here.</p>
                  <p>Practice can surface the strongest stories and eventually save stronger bullets back into the profile draft.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Account setting</CardTitle>
                  <CardDescription>Keep your baseline seniority in sync with profile research defaults.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Label htmlFor="profile-seniority">Experience level</Label>
                  <Select value={seniority} onValueChange={(value) => handleSaveSeniority(value as SeniorityLevel)}>
                    <SelectTrigger id="profile-seniority">
                      <SelectValue placeholder="Select experience level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="junior">Junior</SelectItem>
                      <SelectItem value="mid">Mid-level</SelectItem>
                      <SelectItem value="senior">Senior</SelectItem>
                    </SelectContent>
                  </Select>
                  {isSavingSeniority && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Saving…
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
