export type ProfileUsageSurface = "Research" | "Dashboard" | "Practice";

export const PROFILE_USAGE_SURFACES: ProfileUsageSurface[] = [
  "Research",
  "Dashboard",
  "Practice",
];

export interface ProfileLink {
  id: string;
  label: string;
  url: string;
}

export interface ProfileBullet {
  id: string;
  text: string;
  competencyTags: string[];
  interviewThemes: string[];
  industries: string[];
  focusAreas: string[];
  starStory: boolean;
}

export interface ProfileExperience {
  id: string;
  company: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  summary: string;
  bullets: ProfileBullet[];
}

export interface ProfileProject {
  id: string;
  title: string;
  context: string;
  technologies: string[];
  links: ProfileLink[];
  tags: string[];
  bullets: ProfileBullet[];
}

export interface ProfileSkillGroup {
  id: string;
  name: string;
  skills: string[];
}

export interface ProfileEducation {
  id: string;
  degree: string;
  institution: string;
  year: string;
  description: string;
}

export interface ProfileCertification {
  id: string;
  name: string;
  issuer: string;
  year: string;
}

export interface ProfileLanguage {
  id: string;
  language: string;
  proficiency: string;
}

export interface ProfilePreferences {
  targetRoles: string[];
  targetIndustries: string[];
  locations: string[];
  workModes: string[];
  notes: string;
}

export interface CandidateProfile {
  userId: string;
  headline: string;
  summary: string;
  location: string;
  links: ProfileLink[];
  experiences: ProfileExperience[];
  projects: ProfileProject[];
  skills: ProfileSkillGroup[];
  education: ProfileEducation[];
  certifications: ProfileCertification[];
  languages: ProfileLanguage[];
  preferences: ProfilePreferences;
  completionScore: number;
  lastResumeId: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type ProfileImportSuggestionKind =
  | "new"
  | "possible_duplicate"
  | "conflicts_existing"
  | "missing_from_import";

export type ProfileImportSection =
  | "headline"
  | "summary"
  | "location"
  | "links"
  | "experiences"
  | "projects"
  | "skills"
  | "education"
  | "certifications"
  | "languages";

export interface ProfileImportSuggestion {
  id: string;
  kind: ProfileImportSuggestionKind;
  section: ProfileImportSection;
  title: string;
  message: string;
  incomingId?: string;
  existingId?: string;
  field?: "headline" | "summary" | "location";
}

export interface ProfileImportSummary {
  newCount: number;
  duplicateCount: number;
  conflictingCount: number;
  missingCount: number;
}

export type ProfileMergeDecisionAction =
  | "add_incoming"
  | "append_incoming"
  | "replace_existing"
  | "keep_existing";

export interface ProfileMergeDecision {
  suggestionId: string;
  action: ProfileMergeDecisionAction;
}

export interface ProfileImportRecord {
  id: string;
  userId: string;
  resumeId: string | null;
  source: string;
  draftProfile: CandidateProfile;
  mergeSuggestions: ProfileImportSuggestion[];
  importSummary: ProfileImportSummary;
  status: string;
  createdAt: string;
  appliedAt: string | null;
}

export interface LegacyParsedData {
  personalInfo?: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
    website?: string;
  };
  professional?: {
    currentRole?: string;
    experience?: string;
    summary?: string;
    workHistory?: Array<{
      title?: string;
      company?: string;
      duration?: string;
      description?: string;
    }>;
  };
  education?: Array<{
    degree?: string;
    institution?: string;
    year?: string;
    description?: string;
  }>;
  skills?: {
    categories?: Array<{ name?: string; skills?: string[] }>;
    technical?: string[];
    programming?: string[];
    frameworks?: string[];
    tools?: string[];
    soft?: string[];
  };
  projects?: Array<{
    name?: string;
    description?: string;
    technologies?: string[];
  }>;
  certifications?: Array<{
    name?: string;
    issuer?: string;
    year?: string;
  }>;
  languages?: Array<{
    language?: string;
    proficiency?: string;
  }>;
}

const EMPTY_PREFERENCES: ProfilePreferences = {
  targetRoles: [],
  targetIndustries: [],
  locations: [],
  workModes: [],
  notes: "",
};

const createId = (prefix: string) => {
  const value =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${prefix}-${value}`;
};

const normalizeText = (value: string | null | undefined) =>
  (value || "").trim().replace(/\s+/g, " ");

const normalizeList = (value: string[] | null | undefined) =>
  Array.from(
    new Set(
      (value || [])
        .map((item) => normalizeText(item))
        .filter(Boolean),
    ),
  );

const splitCsv = (value: string | null | undefined) =>
  normalizeList(
    (value || "")
      .split(",")
      .map((item) => item.trim()),
  );

const sentenceSplitPattern = /[\n•]+|(?<=[.!?])\s+(?=[A-Z0-9])/g;

const splitIntoBullets = (value: string | null | undefined) =>
  normalizeList(
    (value || "")
      .split(sentenceSplitPattern)
      .map((item) => item.replace(/^[-*•\s]+/, "").trim())
      .filter((item) => item.length > 3),
  );

const isProfileLink = (value: unknown): value is Partial<ProfileLink> =>
  Boolean(value && typeof value === "object");

const isProfileBullet = (value: unknown): value is Partial<ProfileBullet> =>
  Boolean(value && typeof value === "object");

const isProfileExperience = (value: unknown): value is Partial<ProfileExperience> =>
  Boolean(value && typeof value === "object");

const isProfileProject = (value: unknown): value is Partial<ProfileProject> =>
  Boolean(value && typeof value === "object");

const isProfileSkillGroup = (value: unknown): value is Partial<ProfileSkillGroup> =>
  Boolean(value && typeof value === "object");

const isProfileEducation = (value: unknown): value is Partial<ProfileEducation> =>
  Boolean(value && typeof value === "object");

const isProfileCertification = (value: unknown): value is Partial<ProfileCertification> =>
  Boolean(value && typeof value === "object");

const isProfileLanguage = (value: unknown): value is Partial<ProfileLanguage> =>
  Boolean(value && typeof value === "object");

export const createEmptyProfileBullet = (overrides?: Partial<ProfileBullet>): ProfileBullet => ({
  id: overrides?.id || createId("bullet"),
  text: normalizeText(overrides?.text),
  competencyTags: normalizeList(overrides?.competencyTags),
  interviewThemes: normalizeList(overrides?.interviewThemes),
  industries: normalizeList(overrides?.industries),
  focusAreas: normalizeList(overrides?.focusAreas),
  starStory: Boolean(overrides?.starStory),
});

export const createEmptyProfileLink = (overrides?: Partial<ProfileLink>): ProfileLink => ({
  id: overrides?.id || createId("link"),
  label: normalizeText(overrides?.label),
  url: normalizeText(overrides?.url),
});

export const createEmptyExperience = (overrides?: Partial<ProfileExperience>): ProfileExperience => ({
  id: overrides?.id || createId("experience"),
  company: normalizeText(overrides?.company),
  title: normalizeText(overrides?.title),
  location: normalizeText(overrides?.location),
  startDate: normalizeText(overrides?.startDate),
  endDate: normalizeText(overrides?.endDate),
  current: Boolean(overrides?.current),
  summary: normalizeText(overrides?.summary),
  bullets: (overrides?.bullets || []).map((bullet) => createEmptyProfileBullet(bullet)),
});

export const createEmptyProject = (overrides?: Partial<ProfileProject>): ProfileProject => ({
  id: overrides?.id || createId("project"),
  title: normalizeText(overrides?.title),
  context: normalizeText(overrides?.context),
  technologies: normalizeList(overrides?.technologies),
  links: (overrides?.links || []).map((link) => createEmptyProfileLink(link)),
  tags: normalizeList(overrides?.tags),
  bullets: (overrides?.bullets || []).map((bullet) => createEmptyProfileBullet(bullet)),
});

export const createEmptySkillGroup = (
  overrides?: Partial<ProfileSkillGroup>,
): ProfileSkillGroup => ({
  id: overrides?.id || createId("skill-group"),
  name: normalizeText(overrides?.name),
  skills: normalizeList(overrides?.skills),
});

export const createEmptyEducation = (
  overrides?: Partial<ProfileEducation>,
): ProfileEducation => ({
  id: overrides?.id || createId("education"),
  degree: normalizeText(overrides?.degree),
  institution: normalizeText(overrides?.institution),
  year: normalizeText(overrides?.year),
  description: normalizeText(overrides?.description),
});

export const createEmptyCertification = (
  overrides?: Partial<ProfileCertification>,
): ProfileCertification => ({
  id: overrides?.id || createId("certification"),
  name: normalizeText(overrides?.name),
  issuer: normalizeText(overrides?.issuer),
  year: normalizeText(overrides?.year),
});

export const createEmptyLanguage = (
  overrides?: Partial<ProfileLanguage>,
): ProfileLanguage => ({
  id: overrides?.id || createId("language"),
  language: normalizeText(overrides?.language),
  proficiency: normalizeText(overrides?.proficiency),
});

export const createEmptyCandidateProfile = (userId = ""): CandidateProfile => ({
  userId,
  headline: "",
  summary: "",
  location: "",
  links: [],
  experiences: [],
  projects: [],
  skills: [],
  education: [],
  certifications: [],
  languages: [],
  preferences: { ...EMPTY_PREFERENCES },
  completionScore: 0,
  lastResumeId: null,
});

export const normalizeCandidateProfile = (
  value: Partial<CandidateProfile> | null | undefined,
  userId = "",
): CandidateProfile => {
  const profile = createEmptyCandidateProfile(userId);
  const nextUserId = normalizeText(value?.userId) || userId;
  const nextProfile: CandidateProfile = {
    ...profile,
    ...value,
    userId: nextUserId,
    headline: normalizeText(value?.headline),
    summary: normalizeText(value?.summary),
    location: normalizeText(value?.location),
    links: Array.isArray(value?.links)
      ? value!.links.filter(isProfileLink).map((link) => createEmptyProfileLink(link))
      : [],
    experiences: Array.isArray(value?.experiences)
      ? value!.experiences
          .filter(isProfileExperience)
          .map((experience) => createEmptyExperience(experience))
      : [],
    projects: Array.isArray(value?.projects)
      ? value!.projects.filter(isProfileProject).map((project) => createEmptyProject(project))
      : [],
    skills: Array.isArray(value?.skills)
      ? value!.skills.filter(isProfileSkillGroup).map((group) => createEmptySkillGroup(group))
      : [],
    education: Array.isArray(value?.education)
      ? value!.education.filter(isProfileEducation).map((item) => createEmptyEducation(item))
      : [],
    certifications: Array.isArray(value?.certifications)
      ? value!.certifications
          .filter(isProfileCertification)
          .map((item) => createEmptyCertification(item))
      : [],
    languages: Array.isArray(value?.languages)
      ? value!.languages.filter(isProfileLanguage).map((item) => createEmptyLanguage(item))
      : [],
    preferences: {
      ...EMPTY_PREFERENCES,
      ...value?.preferences,
      targetRoles: normalizeList(value?.preferences?.targetRoles),
      targetIndustries: normalizeList(value?.preferences?.targetIndustries),
      locations: normalizeList(value?.preferences?.locations),
      workModes: normalizeList(value?.preferences?.workModes),
      notes: normalizeText(value?.preferences?.notes),
    },
    completionScore:
      typeof value?.completionScore === "number" ? Math.max(0, value.completionScore) : 0,
    lastResumeId: value?.lastResumeId ?? null,
    createdAt: value?.createdAt,
    updatedAt: value?.updatedAt,
  };

  nextProfile.completionScore = computeCandidateProfileCompletion(nextProfile);
  return nextProfile;
};

export const isCandidateProfileEmpty = (profile: CandidateProfile) =>
  [
    profile.headline,
    profile.summary,
    profile.location,
    profile.experiences.length,
    profile.projects.length,
    profile.skills.length,
    profile.education.length,
    profile.links.length,
  ].every((value) => !value);

export const computeCandidateProfileCompletion = (profile: CandidateProfile) => {
  const experienceBulletCount = profile.experiences.reduce(
    (count, experience) => count + experience.bullets.filter((bullet) => bullet.text).length,
    0,
  );
  const projectBulletCount = profile.projects.reduce(
    (count, project) => count + project.bullets.filter((bullet) => bullet.text).length,
    0,
  );
  const totalSkillCount = profile.skills.reduce((count, group) => count + group.skills.length, 0);
  const score =
    (profile.headline ? 10 : 0) +
    (profile.summary ? 10 : 0) +
    (profile.location ? 5 : 0) +
    (profile.experiences.length > 0 ? 20 : 0) +
    (experienceBulletCount + projectBulletCount >= 3 ? 15 : 0) +
    (profile.projects.length > 0 ? 10 : 0) +
    (totalSkillCount >= 5 ? 10 : 0) +
    (profile.education.length > 0 ? 10 : 0) +
    (profile.links.length > 0 ? 5 : 0) +
    (profile.certifications.length > 0 ||
    profile.languages.length > 0 ||
    profile.preferences.notes ||
    profile.preferences.targetRoles.length > 0
      ? 5
      : 0);

  return Math.min(100, score);
};

export const candidateProfileFromLegacyParsedData = (
  parsedData: LegacyParsedData | null | undefined,
  userId = "",
): CandidateProfile => {
  if (!parsedData) {
    return createEmptyCandidateProfile(userId);
  }

  const links = [
    parsedData.personalInfo?.linkedin
      ? createEmptyProfileLink({ label: "LinkedIn", url: parsedData.personalInfo.linkedin })
      : null,
    parsedData.personalInfo?.github
      ? createEmptyProfileLink({ label: "GitHub", url: parsedData.personalInfo.github })
      : null,
    parsedData.personalInfo?.website
      ? createEmptyProfileLink({ label: "Website", url: parsedData.personalInfo.website })
      : null,
  ].filter(Boolean) as ProfileLink[];

  const legacyCategories = parsedData.skills?.categories || [];
  const fallbackSkillGroups: ProfileSkillGroup[] = [];

  if (legacyCategories.length > 0) {
    fallbackSkillGroups.push(
      ...legacyCategories.map((category) =>
        createEmptySkillGroup({
          name: category.name || "Skills",
          skills: category.skills || [],
        }),
      ),
    );
  } else {
    [
      ["Programming Languages", parsedData.skills?.programming],
      ["Frameworks", parsedData.skills?.frameworks],
      ["Tools", parsedData.skills?.tools],
      ["Technical", parsedData.skills?.technical],
      ["Soft Skills", parsedData.skills?.soft],
    ].forEach(([name, skills]) => {
      if (Array.isArray(skills) && skills.length > 0) {
        fallbackSkillGroups.push(
          createEmptySkillGroup({
            name,
            skills,
          }),
        );
      }
    });
  }

  const experiences = (parsedData.professional?.workHistory || []).map((job) =>
    createEmptyExperience({
      title: job.title,
      company: job.company,
      summary: job.description,
      bullets: splitIntoBullets(job.description).map((text) => ({ text })),
      startDate: job.duration,
    }),
  );

  const projects = (parsedData.projects || []).map((project) =>
    createEmptyProject({
      title: project.name,
      context: project.description,
      technologies: project.technologies || [],
      bullets: splitIntoBullets(project.description).map((text) => ({ text })),
    }),
  );

  return normalizeCandidateProfile(
    {
      userId,
      headline:
        normalizeText(parsedData.professional?.currentRole) ||
        normalizeText(parsedData.personalInfo?.name),
      summary: normalizeText(parsedData.professional?.summary),
      location: normalizeText(parsedData.personalInfo?.location),
      links,
      experiences,
      projects,
      skills: fallbackSkillGroups,
      education: (parsedData.education || []).map((item) =>
        createEmptyEducation({
          degree: item.degree,
          institution: item.institution,
          year: item.year,
          description: item.description,
        }),
      ),
      certifications: (parsedData.certifications || []).map((item) =>
        createEmptyCertification({
          name: item.name,
          issuer: item.issuer,
          year: item.year,
        }),
      ),
      languages: (parsedData.languages || []).map((item) =>
        createEmptyLanguage({
          language: item.language,
          proficiency: item.proficiency,
        }),
      ),
      preferences: {
        ...EMPTY_PREFERENCES,
      },
    },
    userId,
  );
};

const normalizeComparable = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeComparable(item))
      .filter((item) => item !== undefined)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== "id")
      .reduce<Record<string, unknown>>((accumulator, [key, nestedValue]) => {
        const normalized = normalizeComparable(nestedValue);
        if (
          normalized === undefined ||
          normalized === null ||
          normalized === "" ||
          (Array.isArray(normalized) && normalized.length === 0)
        ) {
          return accumulator;
        }

        accumulator[key] = normalized;
        return accumulator;
      }, {});
  }

  if (typeof value === "string") {
    const normalized = normalizeText(value);
    return normalized || undefined;
  }

  return value;
};

const isSameRecord = (left: unknown, right: unknown) =>
  JSON.stringify(normalizeComparable(left)) === JSON.stringify(normalizeComparable(right));

const experienceMatchKey = (item: ProfileExperience) =>
  `${normalizeText(item.company).toLowerCase()}|${normalizeText(item.title).toLowerCase()}|${normalizeText(
    `${item.startDate}-${item.endDate || (item.current ? "present" : "")}`,
  ).toLowerCase()}`;

const projectMatchKey = (item: ProfileProject) => normalizeText(item.title).toLowerCase();

const skillGroupMatchKey = (item: ProfileSkillGroup) => normalizeText(item.name).toLowerCase();

const educationMatchKey = (item: ProfileEducation) =>
  `${normalizeText(item.institution).toLowerCase()}|${normalizeText(item.degree).toLowerCase()}|${normalizeText(
    item.year,
  ).toLowerCase()}`;

const certificationMatchKey = (item: ProfileCertification) =>
  `${normalizeText(item.name).toLowerCase()}|${normalizeText(item.issuer).toLowerCase()}`;

const languageMatchKey = (item: ProfileLanguage) => normalizeText(item.language).toLowerCase();

const linkMatchKey = (item: ProfileLink) => normalizeText(item.url).toLowerCase();

const pushSuggestion = (
  suggestions: ProfileImportSuggestion[],
  suggestion: Omit<ProfileImportSuggestion, "id">,
) => {
  suggestions.push({
    id: createId("suggestion"),
    ...suggestion,
  });
};

const buildCollectionSuggestions = <T extends { id: string }>(
  suggestions: ProfileImportSuggestion[],
  args: {
    section: Exclude<ProfileImportSection, "headline" | "summary" | "location">;
    incomingItems: T[];
    existingItems: T[];
    matchKey: (item: T) => string;
    titleFor: (item: T) => string;
    messageFor: (item: T, kind: ProfileImportSuggestionKind, existing?: T) => string;
  },
) => {
  const seenExisting = new Set<string>();
  const existingByKey = new Map(args.existingItems.map((item) => [args.matchKey(item), item]));

  args.incomingItems.forEach((item) => {
    const key = args.matchKey(item);
    const existingItem = existingByKey.get(key);

    if (!existingItem) {
      pushSuggestion(suggestions, {
        kind: "new",
        section: args.section,
        title: args.titleFor(item),
        message: args.messageFor(item, "new"),
        incomingId: item.id,
      });
      return;
    }

    seenExisting.add(existingItem.id);

    if (isSameRecord(item, existingItem)) {
      pushSuggestion(suggestions, {
        kind: "possible_duplicate",
        section: args.section,
        title: args.titleFor(item),
        message: args.messageFor(item, "possible_duplicate", existingItem),
        incomingId: item.id,
        existingId: existingItem.id,
      });
      return;
    }

    pushSuggestion(suggestions, {
      kind: "conflicts_existing",
      section: args.section,
      title: args.titleFor(item),
      message: args.messageFor(item, "conflicts_existing", existingItem),
      incomingId: item.id,
      existingId: existingItem.id,
    });
  });

  args.existingItems
    .filter((item) => !seenExisting.has(item.id))
    .forEach((item) => {
      pushSuggestion(suggestions, {
        kind: "missing_from_import",
        section: args.section,
        title: args.titleFor(item),
        message: args.messageFor(item, "missing_from_import"),
        existingId: item.id,
      });
    });
};

export const buildProfileImportReview = (
  currentProfile: CandidateProfile,
  draftProfile: CandidateProfile,
): { mergeSuggestions: ProfileImportSuggestion[]; importSummary: ProfileImportSummary } => {
  const suggestions: ProfileImportSuggestion[] = [];

  [
    ["headline", draftProfile.headline, currentProfile.headline, "Headline"],
    ["summary", draftProfile.summary, currentProfile.summary, "Career Summary"],
    ["location", draftProfile.location, currentProfile.location, "Location"],
  ].forEach(([field, incomingValue, existingValue, label]) => {
    const incoming = normalizeText(incomingValue as string);
    const existing = normalizeText(existingValue as string);

    if (!incoming) return;

    if (!existing) {
      pushSuggestion(suggestions, {
        kind: "new",
        section: field as ProfileImportSection,
        field: field as "headline" | "summary" | "location",
        title: label as string,
        message: `Import ${label.toLowerCase()} from the latest resume draft.`,
      });
      return;
    }

    if (incoming === existing) {
      pushSuggestion(suggestions, {
        kind: "possible_duplicate",
        section: field as ProfileImportSection,
        field: field as "headline" | "summary" | "location",
        title: label as string,
        message: `${label} already matches the current profile.`,
      });
      return;
    }

    pushSuggestion(suggestions, {
      kind: "conflicts_existing",
      section: field as ProfileImportSection,
      field: field as "headline" | "summary" | "location",
      title: label as string,
      message: `${label} differs from the current profile. Keep the richer version unless you want to replace it.`,
    });
  });

  buildCollectionSuggestions(suggestions, {
    section: "experiences",
    incomingItems: draftProfile.experiences,
    existingItems: currentProfile.experiences,
    matchKey: experienceMatchKey,
    titleFor: (item) => `${item.title || "Role"} at ${item.company || "Company"}`,
    messageFor: (item, kind) => {
      if (kind === "new") {
        return "New role from the latest resume import.";
      }
      if (kind === "possible_duplicate") {
        return "This role already appears on the current interview profile.";
      }
      if (kind === "conflicts_existing") {
        return `This role matches an existing entry but has different bullets or summary content.`;
      }
      return "This role exists in your profile but is missing from the latest resume.";
    },
  });

  buildCollectionSuggestions(suggestions, {
    section: "projects",
    incomingItems: draftProfile.projects,
    existingItems: currentProfile.projects,
    matchKey: projectMatchKey,
    titleFor: (item) => item.title || "Project",
    messageFor: (_item, kind) => {
      if (kind === "new") return "New project from the latest resume import.";
      if (kind === "possible_duplicate") return "This project already exists on the profile.";
      if (kind === "conflicts_existing") {
        return "This project matches an existing one but carries different details.";
      }
      return "This project exists in your profile but is missing from the latest resume.";
    },
  });

  buildCollectionSuggestions(suggestions, {
    section: "skills",
    incomingItems: draftProfile.skills,
    existingItems: currentProfile.skills,
    matchKey: skillGroupMatchKey,
    titleFor: (item) => item.name || "Skill group",
    messageFor: (_item, kind) => {
      if (kind === "new") return "New skill group from the latest resume import.";
      if (kind === "possible_duplicate") return "This skill group already exists.";
      if (kind === "conflicts_existing") {
        return "This skill group overlaps with existing skills but includes different items.";
      }
      return "This skill group exists in your profile but is missing from the latest resume.";
    },
  });

  buildCollectionSuggestions(suggestions, {
    section: "education",
    incomingItems: draftProfile.education,
    existingItems: currentProfile.education,
    matchKey: educationMatchKey,
    titleFor: (item) => `${item.degree || "Degree"} · ${item.institution || "Institution"}`,
    messageFor: (_item, kind) => {
      if (kind === "new") return "New education entry from the latest resume import.";
      if (kind === "possible_duplicate") return "This education entry already exists.";
      if (kind === "conflicts_existing") {
        return "This education entry overlaps with an existing entry but differs in details.";
      }
      return "This education entry exists in your profile but is missing from the latest resume.";
    },
  });

  buildCollectionSuggestions(suggestions, {
    section: "certifications",
    incomingItems: draftProfile.certifications,
    existingItems: currentProfile.certifications,
    matchKey: certificationMatchKey,
    titleFor: (item) => item.name || "Certification",
    messageFor: (_item, kind) => {
      if (kind === "new") return "New certification from the latest resume import.";
      if (kind === "possible_duplicate") return "This certification already exists.";
      if (kind === "conflicts_existing") {
        return "This certification matches an existing record but differs in details.";
      }
      return "This certification exists in your profile but is missing from the latest resume.";
    },
  });

  buildCollectionSuggestions(suggestions, {
    section: "languages",
    incomingItems: draftProfile.languages,
    existingItems: currentProfile.languages,
    matchKey: languageMatchKey,
    titleFor: (item) => item.language || "Language",
    messageFor: (_item, kind) => {
      if (kind === "new") return "New language from the latest resume import.";
      if (kind === "possible_duplicate") return "This language already exists.";
      if (kind === "conflicts_existing") {
        return "This language overlaps with an existing entry but differs in proficiency.";
      }
      return "This language exists in your profile but is missing from the latest resume.";
    },
  });

  buildCollectionSuggestions(suggestions, {
    section: "links",
    incomingItems: draftProfile.links,
    existingItems: currentProfile.links,
    matchKey: linkMatchKey,
    titleFor: (item) => item.label || item.url || "Link",
    messageFor: (_item, kind) => {
      if (kind === "new") return "New link from the latest resume import.";
      if (kind === "possible_duplicate") return "This link already exists.";
      if (kind === "conflicts_existing") return "This link overlaps with an existing entry.";
      return "This link exists in your profile but is missing from the latest resume.";
    },
  });

  return {
    mergeSuggestions: suggestions,
    importSummary: {
      newCount: suggestions.filter((suggestion) => suggestion.kind === "new").length,
      duplicateCount: suggestions.filter((suggestion) => suggestion.kind === "possible_duplicate")
        .length,
      conflictingCount: suggestions.filter(
        (suggestion) => suggestion.kind === "conflicts_existing",
      ).length,
      missingCount: suggestions.filter((suggestion) => suggestion.kind === "missing_from_import")
        .length,
    },
  };
};

export const getDefaultMergeAction = (
  suggestion: ProfileImportSuggestion,
): ProfileMergeDecisionAction => {
  if (suggestion.kind === "new") {
    return "add_incoming";
  }

  if (suggestion.kind === "missing_from_import") {
    return "keep_existing";
  }

  if (
    suggestion.kind === "conflicts_existing" &&
    ["experiences", "projects", "skills"].includes(suggestion.section)
  ) {
    return "append_incoming";
  }

  return "keep_existing";
};

const mergeTextByRichness = (existingValue: string, incomingValue: string) => {
  const existing = normalizeText(existingValue);
  const incoming = normalizeText(incomingValue);

  if (!existing) return incoming;
  if (!incoming) return existing;
  return existing.length >= incoming.length ? existing : incoming;
};

const mergeBullets = (existing: ProfileBullet[], incoming: ProfileBullet[]) => {
  const byText = new Map<string, ProfileBullet>();

  [...existing, ...incoming].forEach((bullet) => {
    const key = normalizeText(bullet.text).toLowerCase();
    if (!key) return;

    const current = byText.get(key);
    if (!current) {
      byText.set(key, createEmptyProfileBullet(bullet));
      return;
    }

    byText.set(
      key,
      createEmptyProfileBullet({
        ...current,
        text: mergeTextByRichness(current.text, bullet.text),
        competencyTags: normalizeList([...current.competencyTags, ...bullet.competencyTags]),
        interviewThemes: normalizeList([...current.interviewThemes, ...bullet.interviewThemes]),
        industries: normalizeList([...current.industries, ...bullet.industries]),
        focusAreas: normalizeList([...current.focusAreas, ...bullet.focusAreas]),
        starStory: current.starStory || bullet.starStory,
      }),
    );
  });

  return Array.from(byText.values());
};

const mergeLinks = (existing: ProfileLink[], incoming: ProfileLink[]) => {
  const byKey = new Map<string, ProfileLink>();
  [...existing, ...incoming].forEach((link) => {
    const key = linkMatchKey(link);
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, createEmptyProfileLink(link));
      return;
    }
    byKey.set(
      key,
      createEmptyProfileLink({
        ...current,
        label: mergeTextByRichness(current.label, link.label),
      }),
    );
  });

  return Array.from(byKey.values());
};

const mergeExperience = (existing: ProfileExperience, incoming: ProfileExperience) =>
  createEmptyExperience({
    ...existing,
    company: mergeTextByRichness(existing.company, incoming.company),
    title: mergeTextByRichness(existing.title, incoming.title),
    location: mergeTextByRichness(existing.location, incoming.location),
    startDate: mergeTextByRichness(existing.startDate, incoming.startDate),
    endDate: mergeTextByRichness(existing.endDate, incoming.endDate),
    current: existing.current || incoming.current,
    summary: mergeTextByRichness(existing.summary, incoming.summary),
    bullets: mergeBullets(existing.bullets, incoming.bullets),
  });

const mergeProject = (existing: ProfileProject, incoming: ProfileProject) =>
  createEmptyProject({
    ...existing,
    title: mergeTextByRichness(existing.title, incoming.title),
    context: mergeTextByRichness(existing.context, incoming.context),
    technologies: normalizeList([...existing.technologies, ...incoming.technologies]),
    links: mergeLinks(existing.links, incoming.links),
    tags: normalizeList([...existing.tags, ...incoming.tags]),
    bullets: mergeBullets(existing.bullets, incoming.bullets),
  });

const mergeSkillGroup = (existing: ProfileSkillGroup, incoming: ProfileSkillGroup) =>
  createEmptySkillGroup({
    ...existing,
    name: mergeTextByRichness(existing.name, incoming.name),
    skills: normalizeList([...existing.skills, ...incoming.skills]),
  });

const mergeEducation = (existing: ProfileEducation, incoming: ProfileEducation) =>
  createEmptyEducation({
    ...existing,
    degree: mergeTextByRichness(existing.degree, incoming.degree),
    institution: mergeTextByRichness(existing.institution, incoming.institution),
    year: mergeTextByRichness(existing.year, incoming.year),
    description: mergeTextByRichness(existing.description, incoming.description),
  });

const mergeCertification = (existing: ProfileCertification, incoming: ProfileCertification) =>
  createEmptyCertification({
    ...existing,
    name: mergeTextByRichness(existing.name, incoming.name),
    issuer: mergeTextByRichness(existing.issuer, incoming.issuer),
    year: mergeTextByRichness(existing.year, incoming.year),
  });

const mergeLanguage = (existing: ProfileLanguage, incoming: ProfileLanguage) =>
  createEmptyLanguage({
    ...existing,
    language: mergeTextByRichness(existing.language, incoming.language),
    proficiency: mergeTextByRichness(existing.proficiency, incoming.proficiency),
  });

const replaceOrInsert = <T extends { id: string }>(
  items: T[],
  item: T,
  existingId?: string,
) => {
  if (!existingId) {
    return [...items, item];
  }

  const index = items.findIndex((entry) => entry.id === existingId);
  if (index === -1) {
    return [...items, item];
  }

  const nextItems = [...items];
  nextItems[index] = item;
  return nextItems;
};

const applyCollectionSuggestion = <T extends { id: string }>(
  currentItems: T[],
  suggestion: ProfileImportSuggestion,
  draftItems: T[],
  merge: (existing: T, incoming: T) => T,
) => {
  const incomingItem = draftItems.find((item) => item.id === suggestion.incomingId);
  const existingItem = currentItems.find((item) => item.id === suggestion.existingId);

  return {
    incomingItem,
    existingItem,
    add: () => (incomingItem ? [...currentItems, incomingItem] : currentItems),
    replace: () =>
      incomingItem ? replaceOrInsert(currentItems, incomingItem, suggestion.existingId) : currentItems,
    append: () => {
      if (incomingItem && existingItem) {
        return replaceOrInsert(currentItems, merge(existingItem, incomingItem), existingItem.id);
      }
      if (incomingItem) {
        return [...currentItems, incomingItem];
      }
      return currentItems;
    },
  };
};

export const mergeImportedProfile = (
  currentProfile: CandidateProfile,
  draftProfile: CandidateProfile,
  mergeSuggestions: ProfileImportSuggestion[],
  decisions: ProfileMergeDecision[],
): CandidateProfile => {
  const current = normalizeCandidateProfile(currentProfile, currentProfile.userId);
  const draft = normalizeCandidateProfile(draftProfile, current.userId || draftProfile.userId);
  const actionBySuggestionId = new Map<string, ProfileMergeDecisionAction>();

  mergeSuggestions.forEach((suggestion) => {
    actionBySuggestionId.set(suggestion.id, getDefaultMergeAction(suggestion));
  });

  decisions.forEach((decision) => {
    actionBySuggestionId.set(decision.suggestionId, decision.action);
  });

  let nextProfile = normalizeCandidateProfile(
    {
      ...current,
      lastResumeId: draft.lastResumeId ?? current.lastResumeId,
    },
    current.userId,
  );

  mergeSuggestions.forEach((suggestion) => {
    const action = actionBySuggestionId.get(suggestion.id) || getDefaultMergeAction(suggestion);

    if (action === "keep_existing") {
      return;
    }

    if (suggestion.field) {
      const incomingValue = draft[suggestion.field];
      if (!incomingValue) return;

      if (action === "replace_existing" || action === "add_incoming" || action === "append_incoming") {
        nextProfile = normalizeCandidateProfile(
          {
            ...nextProfile,
            [suggestion.field]: incomingValue,
          },
          nextProfile.userId,
        );
      }
      return;
    }

    if (suggestion.section === "experiences") {
      const result = applyCollectionSuggestion(
        nextProfile.experiences,
        suggestion,
        draft.experiences,
        mergeExperience,
      );
      nextProfile = normalizeCandidateProfile(
        {
          ...nextProfile,
          experiences:
            action === "add_incoming"
              ? result.add()
              : action === "replace_existing"
                ? result.replace()
                : result.append(),
        },
        nextProfile.userId,
      );
      return;
    }

    if (suggestion.section === "projects") {
      const result = applyCollectionSuggestion(
        nextProfile.projects,
        suggestion,
        draft.projects,
        mergeProject,
      );
      nextProfile = normalizeCandidateProfile(
        {
          ...nextProfile,
          projects:
            action === "add_incoming"
              ? result.add()
              : action === "replace_existing"
                ? result.replace()
                : result.append(),
        },
        nextProfile.userId,
      );
      return;
    }

    if (suggestion.section === "skills") {
      const result = applyCollectionSuggestion(
        nextProfile.skills,
        suggestion,
        draft.skills,
        mergeSkillGroup,
      );
      nextProfile = normalizeCandidateProfile(
        {
          ...nextProfile,
          skills:
            action === "add_incoming"
              ? result.add()
              : action === "replace_existing"
                ? result.replace()
                : result.append(),
        },
        nextProfile.userId,
      );
      return;
    }

    if (suggestion.section === "education") {
      const result = applyCollectionSuggestion(
        nextProfile.education,
        suggestion,
        draft.education,
        mergeEducation,
      );
      nextProfile = normalizeCandidateProfile(
        {
          ...nextProfile,
          education:
            action === "add_incoming"
              ? result.add()
              : action === "replace_existing"
                ? result.replace()
                : result.append(),
        },
        nextProfile.userId,
      );
      return;
    }

    if (suggestion.section === "certifications") {
      const result = applyCollectionSuggestion(
        nextProfile.certifications,
        suggestion,
        draft.certifications,
        mergeCertification,
      );
      nextProfile = normalizeCandidateProfile(
        {
          ...nextProfile,
          certifications:
            action === "add_incoming"
              ? result.add()
              : action === "replace_existing"
                ? result.replace()
                : result.append(),
        },
        nextProfile.userId,
      );
      return;
    }

    if (suggestion.section === "languages") {
      const result = applyCollectionSuggestion(
        nextProfile.languages,
        suggestion,
        draft.languages,
        mergeLanguage,
      );
      nextProfile = normalizeCandidateProfile(
        {
          ...nextProfile,
          languages:
            action === "add_incoming"
              ? result.add()
              : action === "replace_existing"
                ? result.replace()
                : result.append(),
        },
        nextProfile.userId,
      );
      return;
    }

    if (suggestion.section === "links") {
      const result = applyCollectionSuggestion(nextProfile.links, suggestion, draft.links, (existing, incoming) =>
        createEmptyProfileLink({
          ...existing,
          label: mergeTextByRichness(existing.label, incoming.label),
          url: mergeTextByRichness(existing.url, incoming.url),
        }),
      );
      nextProfile = normalizeCandidateProfile(
        {
          ...nextProfile,
          links:
            action === "add_incoming"
              ? result.add()
              : action === "replace_existing"
                ? result.replace()
                : result.append(),
        },
        nextProfile.userId,
      );
    }
  });

  return normalizeCandidateProfile(nextProfile, nextProfile.userId);
};

export const summarizeImportSuggestions = (suggestions: ProfileImportSuggestion[]) => ({
  newCount: suggestions.filter((item) => item.kind === "new").length,
  duplicateCount: suggestions.filter((item) => item.kind === "possible_duplicate").length,
  conflictingCount: suggestions.filter((item) => item.kind === "conflicts_existing").length,
  missingCount: suggestions.filter((item) => item.kind === "missing_from_import").length,
});

export const candidateProfileFromTextFields = (value: {
  userId?: string;
  headline?: string;
  summary?: string;
  location?: string;
  targetRoles?: string;
  targetIndustries?: string;
  targetLocations?: string;
  workModes?: string;
  notes?: string;
}): CandidateProfile =>
  normalizeCandidateProfile(
    {
      userId: value.userId,
      headline: value.headline,
      summary: value.summary,
      location: value.location,
      preferences: {
        targetRoles: splitCsv(value.targetRoles),
        targetIndustries: splitCsv(value.targetIndustries),
        locations: splitCsv(value.targetLocations),
        workModes: splitCsv(value.workModes),
        notes: value.notes || "",
      },
    },
    value.userId || "",
  );
