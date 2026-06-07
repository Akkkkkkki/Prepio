type ProfileBullet = {
  id?: string;
  text?: string;
  competencyTags?: string[];
  interviewThemes?: string[];
  focusAreas?: string[];
  starStory?: boolean;
};

type ProfileExperience = {
  company?: string;
  title?: string;
  summary?: string;
  bullets?: ProfileBullet[];
};

type ProfileProject = {
  title?: string;
  context?: string;
  technologies?: string[];
  tags?: string[];
  bullets?: ProfileBullet[];
};

type ProfileSkillGroup = {
  name?: string;
  skills?: string[];
};

export type CandidateProfileForStoryLinking = {
  headline?: string;
  summary?: string;
  experiences?: ProfileExperience[];
  projects?: ProfileProject[];
  skills?: ProfileSkillGroup[];
  preferences?: {
    targetRoles?: string[];
    targetIndustries?: string[];
  };
  lastResumeId?: string | null;
};

export type SerializedStoryBullet = {
  alias: string;
  realBulletId: string;
  text: string;
  sourceLabel: string;
  competencyTags: string[];
  interviewThemes: string[];
  focusAreas: string[];
  starStory: boolean;
  orderIndex: number;
};

export type ProfilePromptContext = {
  promptBlock: string;
  aliasToBulletId: Record<string, string>;
  bulletIndex: Record<string, Omit<SerializedStoryBullet, "alias" | "realBulletId">>;
  bulletsByAlias: Record<string, SerializedStoryBullet>;
};

type SerializeOptions = {
  charBudget?: number;
  maxExperienceBullets?: number;
  maxProjectBullets?: number;
};

type QuestionForStoryMatch = {
  question?: string;
  stageName?: string | null;
  linkedPriority?: string;
  reason?: string;
  leveragesStoryId?: string | null;
};

const DEFAULT_CHAR_BUDGET = 6000;
const DEFAULT_EXPERIENCE_BULLET_CAP = 6;
const DEFAULT_PROJECT_BULLET_CAP = 5;

const STOP_WORDS = new Set([
  "about",
  "after",
  "also",
  "and",
  "are",
  "but",
  "can",
  "did",
  "for",
  "from",
  "had",
  "has",
  "have",
  "how",
  "into",
  "its",
  "our",
  "the",
  "their",
  "then",
  "this",
  "that",
  "what",
  "when",
  "where",
  "with",
  "you",
  "your",
]);

const clean = (value: unknown) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";

const cleanList = (values: unknown) =>
  Array.isArray(values) ? values.map(clean).filter(Boolean) : [];

const sortCitableBullets = (bullets: ProfileBullet[]) =>
  [...bullets]
    .filter((bullet) => clean(bullet.text) && clean(bullet.id))
    .sort((left, right) => {
      if (Boolean(left.starStory) !== Boolean(right.starStory)) {
        return left.starStory ? -1 : 1;
      }
      return clean(right.text).length - clean(left.text).length;
    });

const tokenize = (value: string) =>
  new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9+#.\s-]/g, " ")
      .split(/[\s/-]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
  );

const appendWithinBudget = (lines: string[], line: string, budget: number) => {
  const nextLength = lines.join("\n").length + (lines.length ? 1 : 0) + line.length;
  if (nextLength > budget) return false;
  lines.push(line);
  return true;
};

export function serializeProfileForPrompt(
  profile: CandidateProfileForStoryLinking | null | undefined,
  opts: SerializeOptions = {},
): ProfilePromptContext | null {
  if (!profile) return null;

  const charBudget = opts.charBudget ?? DEFAULT_CHAR_BUDGET;
  const maxExperienceBullets = opts.maxExperienceBullets ?? DEFAULT_EXPERIENCE_BULLET_CAP;
  const maxProjectBullets = opts.maxProjectBullets ?? DEFAULT_PROJECT_BULLET_CAP;
  const lines = ["=== STRUCTURED CANDIDATE PROFILE ==="];
  const aliasToBulletId: Record<string, string> = {};
  const bulletIndex: ProfilePromptContext["bulletIndex"] = {};
  const bulletsByAlias: ProfilePromptContext["bulletsByAlias"] = {};
  let nextAlias = 1;
  let orderIndex = 0;

  const addLine = (line: string) => appendWithinBudget(lines, line, charBudget);
  const addBullet = (bullet: ProfileBullet, sourceLabel: string) => {
    const realBulletId = clean(bullet.id);
    const text = clean(bullet.text);
    if (!realBulletId || !text) return false;

    const alias = `S${nextAlias}`;
    const line = `- ${alias} [${sourceLabel}]${bullet.starStory ? " STAR" : ""}: ${text}`;
    if (!appendWithinBudget(lines, line, charBudget)) return false;

    nextAlias += 1;
    orderIndex += 1;
    aliasToBulletId[alias] = realBulletId;
    const indexed = {
      text,
      sourceLabel,
      competencyTags: cleanList(bullet.competencyTags),
      interviewThemes: cleanList(bullet.interviewThemes),
      focusAreas: cleanList(bullet.focusAreas),
      starStory: Boolean(bullet.starStory),
      orderIndex,
    };
    bulletIndex[realBulletId] = indexed;
    bulletsByAlias[alias] = { alias, realBulletId, ...indexed };
    return true;
  };

  const headline = clean(profile.headline);
  const summary = clean(profile.summary);
  if (headline) addLine(`Headline: ${headline}`);
  if (summary) addLine(`Summary: ${summary}`);

  const targetRoles = cleanList(profile.preferences?.targetRoles);
  const targetIndustries = cleanList(profile.preferences?.targetIndustries);
  if (targetRoles.length) addLine(`Target roles: ${targetRoles.join(", ")}`);
  if (targetIndustries.length) addLine(`Target industries: ${targetIndustries.join(", ")}`);

  const skills = (profile.skills || [])
    .flatMap((group: ProfileSkillGroup) => cleanList(group.skills))
    .filter(Boolean);
  if (skills.length) addLine(`Skills: ${Array.from(new Set(skills)).join(", ")}`);

  (profile.experiences || []).forEach((experience) => {
    const sourceLabel = [clean(experience.title), clean(experience.company)].filter(Boolean).join(" @ ");
    const label = sourceLabel || "Experience";
    if (addLine(`Experience: ${label}`)) {
      const summaryLine = clean(experience.summary);
      if (summaryLine) addLine(`  Summary: ${summaryLine}`);
      sortCitableBullets(experience.bullets || [])
        .slice(0, maxExperienceBullets)
        .forEach((bullet) => addBullet(bullet, label));
    }
  });

  (profile.projects || []).forEach((project) => {
    const sourceLabel = clean(project.title) ? `Project: ${clean(project.title)}` : "Project";
    if (addLine(sourceLabel)) {
      const context = clean(project.context);
      const technologies = cleanList(project.technologies);
      const tags = cleanList(project.tags);
      if (context) addLine(`  Context: ${context}`);
      if (technologies.length) addLine(`  Technologies: ${technologies.join(", ")}`);
      if (tags.length) addLine(`  Tags: ${tags.join(", ")}`);
      sortCitableBullets(project.bullets || [])
        .slice(0, maxProjectBullets)
        .forEach((bullet) => addBullet(bullet, sourceLabel));
    }
  });

  const starAliases = () =>
    Object.values(bulletsByAlias)
      .filter((bullet) => bullet.starStory)
      .map((bullet) => bullet.alias);
  const starLine = () => {
    const aliases = starAliases();
    return `STAR-FLAGGED STORIES AVAILABLE TO CITE: ${aliases.length ? aliases.join(", ") : "none"}`;
  };
  const insertAt = Math.min(1, lines.length);
  lines.splice(insertAt, 0, starLine());

  while (lines.join("\n").length > charBudget && lines.length > 2) {
    const removed = lines.pop() || "";
    const alias = removed.match(/^- (S\d+) /)?.[1];
    if (alias) {
      const bullet = bulletsByAlias[alias];
      if (bullet) {
        delete aliasToBulletId[alias];
        delete bulletIndex[bullet.realBulletId];
        delete bulletsByAlias[alias];
      }
      lines[insertAt] = starLine();
    }
  }

  if (!Object.keys(aliasToBulletId).length) return null;

  return {
    promptBlock: lines.join("\n"),
    aliasToBulletId,
    bulletIndex,
    bulletsByAlias,
  };
}

export function resolveStoryAlias(
  alias: string | null | undefined,
  profileContext: ProfilePromptContext | null | undefined,
): SerializedStoryBullet | null {
  const normalizedAlias = clean(alias);
  if (!normalizedAlias || !profileContext) return null;
  return profileContext.bulletsByAlias[normalizedAlias] ?? null;
}

export function matchStoryForQuestion(
  question: QuestionForStoryMatch,
  profileContext: ProfilePromptContext | null | undefined,
  stageThemes: string[] = [],
  threshold = 2,
): SerializedStoryBullet | null {
  if (!profileContext) return null;

  const questionTerms = tokenize(
    [
      question.question,
      question.stageName,
      question.linkedPriority,
      question.reason,
      ...stageThemes,
    ]
      .map(clean)
      .filter(Boolean)
      .join(" "),
  );

  if (!questionTerms.size) return null;

  let best: { bullet: SerializedStoryBullet; score: number } | null = null;
  for (const bullet of Object.values(profileContext.bulletsByAlias)) {
    const bulletTerms = tokenize(
      [
        ...bullet.competencyTags,
        ...bullet.interviewThemes,
        ...bullet.focusAreas,
      ].join(" "),
    );
    let score = 0;
    questionTerms.forEach((term) => {
      if (bulletTerms.has(term)) score += 1;
    });
    if (bullet.starStory && score > 0) score += 0.25;

    if (
      !best ||
      score > best.score ||
      (score === best.score && bullet.starStory && !best.bullet.starStory) ||
      (score === best.score &&
        bullet.starStory === best.bullet.starStory &&
        bullet.orderIndex < best.bullet.orderIndex)
    ) {
      best = { bullet, score };
    }
  }

  return best && best.score >= threshold ? best.bullet : null;
}

export function resolveOrMatchStoryForQuestion(
  question: QuestionForStoryMatch,
  profileContext: ProfilePromptContext | null | undefined,
  stageThemes: string[] = [],
): SerializedStoryBullet | null {
  return (
    resolveStoryAlias(question.leveragesStoryId, profileContext) ??
    matchStoryForQuestion(question, profileContext, stageThemes)
  );
}
