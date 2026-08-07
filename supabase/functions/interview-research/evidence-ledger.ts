export type Priority = "high" | "medium" | "low";

export type EvidenceSourceType =
  | "official_company"
  | "official_job"
  | "user_note"
  | "cv"
  | "public_report"
  | "market_heuristic";

export interface EvidenceLedgerEntry {
  id: string;
  sourceType: EvidenceSourceType;
  sourceLabel: string;
  excerpt: string;
  url: string | null;
  relevance: Priority;
  trustWeight: Priority;
  contradictionGroup: string | null;
  title: string;
  platform: string;
  publishedDate: string | null;
  snippet: string;
}

export interface EvidenceLedgerInput {
  company: string;
  userNote?: string;
  jobDescription?: string;
  cvText?: string;
  companyResearchData?: unknown;
  jobRawData?: unknown;
}

export interface CitationValidationResult {
  validIds: string[];
  droppedIds: string[];
}

type LedgerDraft = Omit<EvidenceLedgerEntry, "id">;

const COMMUNITY_HOSTS = [
  "glassdoor.com",
  "teamblind.com",
  "reddit.com",
  "1point3acres.com",
  "leetcode.com",
  "levels.fyi",
  "interviewing.io",
];

const COMPANY_SUFFIXES = new Set([
  "co",
  "company",
  "corp",
  "corporation",
  "group",
  "inc",
  "limited",
  "llc",
  "ltd",
  "plc",
  "the",
]);

const RELEVANCE_ORDER: Record<Priority, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const SOURCE_ORDER: Record<EvidenceSourceType, number> = {
  market_heuristic: 1,
  public_report: 2,
  official_job: 3,
  official_company: 4,
  cv: 4,
  user_note: 4,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? value as Record<string, unknown>
    : null;
}

function asRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map(asRecord).filter((row): row is Record<string, unknown> => Boolean(row))
    : [];
}

function compactText(value: unknown, max = 700): string {
  const text = typeof value === "string"
    ? value.replace(/\s+/g, " ").trim()
    : "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function normalizeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function hostFor(url: string | null): string {
  if (!url) return "user";
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function companyTokens(company: string): string[] {
  const words = company
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !COMPANY_SUFFIXES.has(word));
  const compact = words.join("");
  return Array.from(new Set(compact ? [...words, compact] : words));
}

function isCommunityHost(host: string): boolean {
  return COMMUNITY_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function isJobPosting(url: string, title: string): boolean {
  const parsed = new URL(url);
  const haystack = `${parsed.hostname} ${parsed.pathname} ${title}`.toLowerCase();
  return [
    "ashbyhq.com",
    "greenhouse.io",
    "jobs.",
    "/jobs/",
    "/job/",
    "careers.",
    "/careers/",
    "lever.co",
    "myworkdayjobs.com",
    "smartrecruiters.com",
  ].some((token) => haystack.includes(token));
}

function classifyRetrievedSource(
  url: string,
  title: string,
  company: string,
): EvidenceSourceType {
  const host = hostFor(url);
  if (isCommunityHost(host)) return "public_report";

  const normalizedHost = host.replace(/[^a-z0-9]/g, "");
  if (companyTokens(company).some((token) => normalizedHost.includes(token))) {
    return "official_company";
  }

  if (isJobPosting(url, title)) return "official_job";
  return "market_heuristic";
}

function trustWeightFor(sourceType: EvidenceSourceType): Priority {
  if (
    sourceType === "official_company" ||
    sourceType === "official_job" ||
    sourceType === "user_note" ||
    sourceType === "cv"
  ) {
    return "high";
  }
  return sourceType === "public_report" ? "medium" : "low";
}

function relevanceFor(sourceType: EvidenceSourceType, score: unknown): Priority {
  if (sourceType === "user_note" || sourceType === "official_job") return "high";
  if (typeof score === "number") {
    if (score >= 0.75) return "high";
    if (score >= 0.4) return "medium";
    return "low";
  }
  return sourceType === "market_heuristic" ? "low" : "medium";
}

function publishedDateFor(row: Record<string, unknown>): string | null {
  const value = row.published_date ?? row.publishedAt ?? row.published_at;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function snippetFor(row: Record<string, unknown>): string {
  for (const value of [
    row.raw_content,
    row.rawContent,
    row.content,
    row.snippet,
    row.answer,
  ]) {
    const snippet = compactText(value);
    if (snippet) return snippet;
  }
  return "";
}

function preferHigherRelevance(a: Priority, b: Priority): Priority {
  return RELEVANCE_ORDER[b] > RELEVANCE_ORDER[a] ? b : a;
}

function appendDraft(
  drafts: LedgerDraft[],
  indexByKey: Map<string, number>,
  key: string,
  draft: LedgerDraft,
) {
  const existingIndex = indexByKey.get(key);
  if (existingIndex === undefined) {
    indexByKey.set(key, drafts.length);
    drafts.push(draft);
    return;
  }

  const existing = drafts[existingIndex];
  const sourceType = SOURCE_ORDER[draft.sourceType] > SOURCE_ORDER[existing.sourceType]
    ? draft.sourceType
    : existing.sourceType;
  const useNewSnippet = draft.snippet.length > existing.snippet.length;
  drafts[existingIndex] = {
    ...existing,
    sourceType,
    sourceLabel: useNewSnippet ? draft.sourceLabel : existing.sourceLabel,
    excerpt: useNewSnippet ? draft.excerpt : existing.excerpt,
    relevance: preferHigherRelevance(existing.relevance, draft.relevance),
    trustWeight: trustWeightFor(sourceType),
    title: useNewSnippet ? draft.title : existing.title,
    publishedDate: existing.publishedDate ?? draft.publishedDate,
    snippet: useNewSnippet ? draft.snippet : existing.snippet,
  };
}

function addInlineEntry(
  drafts: LedgerDraft[],
  indexByKey: Map<string, number>,
  sourceType: "user_note" | "official_job" | "cv",
  sourceLabel: string,
  value: unknown,
  relevance: Priority,
) {
  const snippet = compactText(value);
  if (!snippet) return;
  appendDraft(drafts, indexByKey, `inline:${sourceType}:${snippet}`, {
    sourceType,
    sourceLabel,
    excerpt: snippet,
    url: null,
    relevance,
    trustWeight: trustWeightFor(sourceType),
    contradictionGroup: null,
    title: sourceLabel,
    platform: "user",
    publishedDate: null,
    snippet,
  });
}

function addRetrievedRows(
  drafts: LedgerDraft[],
  indexByKey: Map<string, number>,
  company: string,
  rows: Record<string, unknown>[],
  forcedSourceType?: EvidenceSourceType,
) {
  rows.forEach((row) => {
    const url = normalizeHttpUrl(row.url);
    if (!url) return;

    const snippet = snippetFor(row);
    if (!snippet) return;

    const title = compactText(row.title, 180) || hostFor(url);
    const sourceType = forcedSourceType ?? classifyRetrievedSource(url, title, company);
    appendDraft(drafts, indexByKey, `url:${url}`, {
      sourceType,
      sourceLabel: title,
      excerpt: snippet,
      url,
      relevance: relevanceFor(sourceType, row.score),
      trustWeight: trustWeightFor(sourceType),
      contradictionGroup: null,
      title,
      platform: hostFor(url),
      publishedDate: publishedDateFor(row),
      snippet,
    });
  });
}

export function buildEvidenceLedger(input: EvidenceLedgerInput): EvidenceLedgerEntry[] {
  const drafts: LedgerDraft[] = [];
  const indexByKey = new Map<string, number>();

  addInlineEntry(drafts, indexByKey, "user_note", "User note", input.userNote, "high");
  addInlineEntry(
    drafts,
    indexByKey,
    "official_job",
    "Pasted job description",
    input.jobDescription,
    "high",
  );
  addInlineEntry(drafts, indexByKey, "cv", "Candidate CV", input.cvText, "medium");

  const companyResearch = asRecord(input.companyResearchData);
  asRecords(companyResearch?.search_results).forEach((payload) => {
    addRetrievedRows(drafts, indexByKey, input.company, asRecords(payload.results));
  });
  addRetrievedRows(
    drafts,
    indexByKey,
    input.company,
    asRecords(companyResearch?.extracted_content),
  );

  const jobRawData = asRecord(input.jobRawData);
  addRetrievedRows(
    drafts,
    indexByKey,
    input.company,
    asRecords(jobRawData?.results),
    "official_job",
  );

  return drafts.map((entry, index) => ({ ...entry, id: `ev-${index + 1}` }));
}

export function validateEvidenceIds(
  value: unknown,
  ledger: EvidenceLedgerEntry[],
): CitationValidationResult {
  const knownIds = new Set(ledger.map((entry) => entry.id));
  const requestedIds = Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string")
    : [];
  const validIds: string[] = [];
  const droppedIds: string[] = [];

  requestedIds.forEach((id) => {
    if (knownIds.has(id)) {
      if (!validIds.includes(id)) validIds.push(id);
    } else if (!droppedIds.includes(id)) {
      droppedIds.push(id);
    }
  });

  return { validIds, droppedIds };
}

export function sanitizePlanEvidenceCitations(
  plan: Record<string, any>,
  ledger: EvidenceLedgerEntry[],
) {
  const droppedIds: string[] = [];
  const sanitizeTarget = (target: unknown) => {
    if (!target || typeof target !== "object") return;
    const record = target as Record<string, unknown>;
    const result = validateEvidenceIds(record.evidenceIds, ledger);
    record.evidenceIds = result.validIds;
    droppedIds.push(...result.droppedIds);
  };

  (Array.isArray(plan.stageRoadmap) ? plan.stageRoadmap : []).forEach(sanitizeTarget);
  const questionPlan = asRecord(plan.questionPlan);
  ["coreMustPractice", "likelyFollowUps", "extraDepth"].forEach((tier) => {
    const questions = questionPlan && Array.isArray(questionPlan[tier])
      ? questionPlan[tier]
      : [];
    questions.forEach(sanitizeTarget);
  });

  plan.internalEvidenceLog = ledger;
  if (ledger.length === 0) {
    const summary = asRecord(plan.summary);
    if (summary) {
      summary.weakSignalCase = true;
      summary.overallConfidence = "low";
    }
  }

  return {
    droppedCitationIds: Array.from(new Set(droppedIds)),
    ledgerCount: ledger.length,
  };
}

export function formatEvidenceLedgerForPrompt(ledger: EvidenceLedgerEntry[]): string {
  if (ledger.length === 0) {
    return "No verified evidence ledger entries were available. Do not cite sources or invent URLs.";
  }

  return ledger.map((entry) => {
    const publishedDate = entry.publishedDate
      ? `\nPublished date: ${entry.publishedDate}`
      : "";
    const url = entry.url ? `\nURL: ${entry.url}` : "";
    return [
      `${entry.id} | ${entry.sourceType} | trust=${entry.trustWeight} | relevance=${entry.relevance}`,
      `Title: ${entry.title}`,
      `Platform: ${entry.platform}${publishedDate}${url}`,
      `Snippet passed to model: ${entry.snippet}`,
    ].join("\n");
  }).join("\n\n");
}
