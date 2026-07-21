export type ResearchRoleFamily = "tech" | "consulting" | "finance" | "other";

export type ResearchLevel =
  | "junior"
  | "mid"
  | "senior_ic"
  | "people_manager"
  | "unknown"
  | string
  | undefined;

export interface QueryPlanInput {
  company: string;
  role?: string;
  country?: string;
  level?: ResearchLevel;
  userNote?: string;
  ticker?: string;
  maxQueries?: number;
}

export interface PlannedQuery {
  query: string;
  source: string;
}

export interface QueryPlan {
  roleFamily: ResearchRoleFamily;
  queries: PlannedQuery[];
  includeDomains: string[];
  signals: {
    role: string;
    level: string;
    country: string | null;
    userNote: string[];
  };
  budget: {
    maxQueries: number;
    plannedQueries: number;
  };
}

const DOMAIN_PACKS: Record<ResearchRoleFamily | "common", string[]> = {
  common: [
    "glassdoor.com",
    "reddit.com",
    "linkedin.com",
    "indeed.com",
  ],
  tech: [
    "blind.teamblind.com",
    "levels.fyi",
    "leetcode.com",
    "interviewing.io",
    "1point3acres.com",
  ],
  consulting: [
    "caseinterview.com",
    "managementconsulted.com",
    "preplounge.com",
    "reddit.com",
  ],
  finance: [
    "wallstreetoasis.com",
    "mergersandinquisitions.com",
    "efinancialcareers.com",
    "reddit.com",
  ],
  other: [
    "glassdoor.com",
    "reddit.com",
    "linkedin.com",
    "indeed.com",
  ],
};

const TARGETED_USER_NOTE_DOMAINS = [
  "medium.com",
  "substack.com",
  "youtube.com",
  "speakerdeck.com",
];

const ROLE_KEYWORDS: Record<ResearchRoleFamily, RegExp[]> = {
  tech: [
    /\b(engineer|developer|software|frontend|backend|full.?stack|platform|infrastructure|devops|sre|data scientist|machine learning|ml|ai|security|product manager|designer|ux|qa)\b/i,
  ],
  consulting: [
    /\b(consultant|consulting|case interview|case study|strategy|associate consultant|business analyst|engagement manager|mckinsey|bain|bcg)\b/i,
  ],
  finance: [
    /\b(finance|financial|investment banking|banker|trader|equity research|private equity|hedge fund|asset management|quant|investment banking associate|finance associate|valuation|lbo|dcf|financial modeling)\b/i,
    // "analyst" alone is ambiguous (data/security/product analyst); only treat it
    // as finance when a finance qualifier sits next to it.
    /\b(?:equity|credit|risk|investment|financial|finance|fixed.?income|treasury|m&a|sell.?side|buy.?side|quant(?:itative)?)\s+analyst\b/i,
    /\banalyst\b.*\b(?:investment banking|equity research|finance|financial)\b/i,
  ],
  other: [],
};

const LEVEL_PHRASES: Record<string, string> = {
  junior: "new grad junior entry level",
  mid: "mid level",
  senior_ic: "senior staff principal",
  people_manager: "manager leadership people management",
  unknown: "",
};

function cleanQuery(query: string): string {
  return query.replace(/\s+/g, " ").trim();
}

function dedupe<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function classifyRoleFamily(role?: string, userNote?: string): ResearchRoleFamily {
  const text = `${role ?? ""} ${userNote ?? ""}`;
  for (const family of ["consulting", "finance", "tech"] as const) {
    if (ROLE_KEYWORDS[family].some((pattern) => pattern.test(text))) {
      return family;
    }
  }
  return "other";
}

function getLevelPhrase(level: ResearchLevel): string {
  if (!level) return "";
  return LEVEL_PHRASES[String(level)] ?? String(level).replace(/_/g, " ");
}

interface ExtractedUserNoteSignals {
  labels: string[];
  targeted: string[];
}

function extractUserNoteSignals(userNote?: string): ExtractedUserNoteSignals {
  if (!userNote) return { labels: [], targeted: [] };
  const labels: string[] = [];
  const targeted: string[] = [];
  const normalized = userNote.trim();

  const teamMatch = normalized.match(
    /\b([A-Z][A-Za-z0-9&-]*(?:\s+[A-Z][A-Za-z0-9&-]*){0,2})\s+(?:team|group|org|department)\b/,
  );
  const teamFirstMatch = normalized.match(
    /\b(?:team|group|org|department)\s+([A-Z][A-Za-z0-9&-]*(?:\s+[A-Z][A-Za-z0-9&-]*){0,2})\b/,
  );
  const teamName = teamMatch?.[1] ?? teamFirstMatch?.[1];
  if (teamName) {
    const teamSignal = `${teamName.trim()} team`;
    labels.push(teamSignal);
    targeted.push(teamSignal);
  }

  const interviewerMatch = normalized.match(
    /\b(?:[Ii]nterviewer|[Ww]ith|[Mm]eeting|[Mm]eet|[Ss]peaking with|[Tt]alking to)\s+(?:the\s+)?([A-Z][A-Za-z'-]+(?:\s+[A-Z][A-Za-z'-]+){1,2})\b/,
  );
  if (interviewerMatch?.[1]) {
    const interviewerSignal = interviewerMatch[1].trim();
    labels.push(interviewerSignal);
    targeted.push(interviewerSignal);
  }

  if (/\bcase\b/i.test(normalized)) labels.push("case interview");
  if (/\bsystem design\b/i.test(normalized)) labels.push("system design");
  if (/\bmodeling|valuation|lbo|dcf\b/i.test(normalized)) labels.push("financial modeling");

  return {
    labels: dedupe(labels).slice(0, 4),
    targeted: dedupe(targeted).slice(0, 2),
  };
}

function buildFamilyQueries(input: {
  company: string;
  role: string;
  country?: string;
  ticker: string;
  levelPhrase: string;
  userNoteSignals: string[];
  targetedUserNoteSignals: string[];
  roleFamily: ResearchRoleFamily;
}): PlannedQuery[] {
  const { company, role, country, ticker, levelPhrase, userNoteSignals, targetedUserNoteSignals, roleFamily } = input;
  const location = country ? `${country} ` : "";
  const seniority = levelPhrase ? `${levelPhrase} ` : "";

  const common: PlannedQuery[] = [
    {
      source: "glassdoor",
      query: `"${company}" ${role} ${location}${seniority}interview process questions site:glassdoor.com/Interview`,
    },
    {
      source: "reddit",
      query: `"${company}" ${role} ${location}interview experience site:reddit.com`,
    },
  ];

  const byFamily: Record<ResearchRoleFamily, PlannedQuery[]> = {
    tech: [
      {
        source: "blind",
        query: `${ticker} ${role} ${seniority}interview loop site:blind.teamblind.com`,
      },
      {
        source: "leetcode",
        query: `"${company}" ${role} coding system design interview site:leetcode.com/discuss`,
      },
      {
        source: "levels",
        query: `"${company}" ${role} ${location}interview 2024 2025 site:levels.fyi`,
      },
    ],
    consulting: [
      {
        source: "caseinterview",
        query: `"${company}" ${role} case interview experience site:caseinterview.com`,
      },
      {
        source: "managementconsulted",
        query: `"${company}" consulting interview ${location}site:managementconsulted.com`,
      },
      {
        source: "preplounge",
        query: `"${company}" case interview ${seniority}site:preplounge.com`,
      },
    ],
    finance: [
      {
        source: "wso",
        query: `"${company}" ${role} interview experience site:wallstreetoasis.com`,
      },
      {
        source: "mni",
        query: `"${company}" investment banking finance interview ${location}site:mergersandinquisitions.com`,
      },
      {
        source: "financialcareers",
        query: `"${company}" ${role} interview questions site:efinancialcareers.com`,
      },
    ],
    other: [
      {
        source: "linkedin",
        query: `"${company}" ${role} interview hiring process site:linkedin.com`,
      },
      {
        source: "indeed",
        query: `"${company}" ${role} interview review site:indeed.com`,
      },
      {
        source: "general",
        query: `"${company}" ${role} ${location}${seniority}interview stages questions`,
      },
    ],
  };

  const targetedSignals = targetedUserNoteSignals.map((signal) => `"${signal}"`).join(" ");
  const targeted: PlannedQuery[] = targetedSignals
    ? [
        {
          source: "user-note-linkedin",
          query: `"${company}" ${role} ${targetedSignals} interview site:linkedin.com`,
        },
        {
          source: "user-note-blog",
          query: `"${company}" ${role} ${targetedSignals} interview blog site:medium.com OR site:substack.com`,
        },
        {
          source: "user-note-talk",
          query: `"${company}" ${role} ${targetedSignals} interview talk conference site:youtube.com OR site:speakerdeck.com`,
        },
      ]
    : [];

  const contextual = userNoteSignals
    .filter((signal) => !targetedUserNoteSignals.includes(signal))
    .map((signal): PlannedQuery => ({
      source: "user-note",
      query: `"${company}" ${role} "${signal}" interview`,
    }));

  return [...common, ...byFamily[roleFamily], ...targeted, ...contextual].map((planned) => ({
    ...planned,
    query: cleanQuery(planned.query),
  }));
}

export function buildResearchQueryPlan(input: QueryPlanInput): QueryPlan {
  const maxQueries = Math.max(1, input.maxQueries ?? 6);
  const company = input.company.trim();
  const role = input.role?.trim() || "interview candidate";
  const country = input.country?.trim() || undefined;
  const ticker = input.ticker?.trim() || company.toUpperCase();
  const levelPhrase = getLevelPhrase(input.level);
  const roleFamily = classifyRoleFamily(role, input.userNote);
  const userNoteSignals = extractUserNoteSignals(input.userNote);
  const familyDomains = DOMAIN_PACKS[roleFamily];
  const includeDomains = dedupe([
    ...DOMAIN_PACKS.common,
    ...familyDomains,
    ...(userNoteSignals.targeted.length > 0 ? TARGETED_USER_NOTE_DOMAINS : []),
  ]);
  const queries = dedupe(
    buildFamilyQueries({
      company,
      role,
      country,
      ticker,
      levelPhrase,
      userNoteSignals: userNoteSignals.labels,
      targetedUserNoteSignals: userNoteSignals.targeted,
      roleFamily,
    }).map((planned) => JSON.stringify(planned)),
  )
    .slice(0, maxQueries)
    .map((serialized) => JSON.parse(serialized) as PlannedQuery);

  return {
    roleFamily,
    queries,
    includeDomains,
    signals: {
      role,
      level: levelPhrase || "unknown",
      country: country ?? null,
      userNote: userNoteSignals.labels,
    },
    budget: {
      maxQueries,
      plannedQueries: queries.length,
    },
  };
}
