import type { Tables } from "@/integrations/supabase/types";
import type {
  ProfileImportRecord,
  ProfileImportSection,
  ProfileImportSuggestion,
  ProfileMergeDecisionAction,
} from "@/lib/candidateProfile";
import { getDefaultMergeAction } from "@/lib/candidateProfile";

export type ResumeVersion = Tables<"resumes">;

export type MainProfileSectionId =
  | "about"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "languages";

export const PROFILE_CV_UPLOAD_ID = "profile-cv-upload";

export const PROFILE_MAIN_SECTION_ORDER: MainProfileSectionId[] = [
  "about",
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
  "languages",
];

export const splitCsv = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const formatDate = (value?: string | null) => {
  if (!value) return "Unknown";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
};

export const formatResumeLabel = (resume: ResumeVersion | null | undefined) => {
  if (!resume) return "No active resume";
  if (resume.file_name) return resume.file_name;
  return resume.source === "upload" ? "Uploaded resume text" : "Pasted resume text";
};

export const buildMergeDecisionState = (profileImport: ProfileImportRecord | null) => {
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

export const groupSuggestions = (suggestions: ProfileImportSuggestion[]) => ({
  new: suggestions.filter((suggestion) => suggestion.kind === "new"),
  conflicts: suggestions.filter((suggestion) => suggestion.kind === "conflicts_existing"),
  duplicates: suggestions.filter((suggestion) => suggestion.kind === "possible_duplicate"),
  missing: suggestions.filter((suggestion) => suggestion.kind === "missing_from_import"),
});

export const getMergeActionOptions = (
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

export const profileImportSectionLabel: Record<ProfileImportSection, string> = {
  headline: "Headline",
  summary: "About",
  location: "Location",
  links: "Links",
  experiences: "Experience",
  projects: "Projects",
  skills: "Skills",
  education: "Education",
  certifications: "Licenses & certifications",
  languages: "Languages",
};

export const updateArrayItem = <T,>(items: T[], index: number, nextItem: T) =>
  items.map((item, itemIndex) => (itemIndex === index ? nextItem : item));

export const removeArrayItem = <T,>(items: T[], index: number) =>
  items.filter((_, itemIndex) => itemIndex !== index);
