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
  companyResearchData?: any;
  jobRawData?: any;
}

export interface CitationValidationResult {
  validIds: string[];
  droppedIds: string[];
}

const COMMUNITY_HOSTS = [
  "glassdoor.",
  "teamblind.com",
  "blind.teamblind.com",
  "reddit.com",
  "1point3acres.com",
  "leetcode.com",
  "levels.fyi",
  "interviewing.io",
];

function clip(value: unknown, max = 700): string {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function hostFor(url: string | null): string {
  if (!url) return "user";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function normalizeCompanyToken(company: string): string {
  return company.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function classifySource(url: string | null, title: string, company: string): EvidenceSourceType {
  if (!url) return "market_heuristic";
  const host = hostFor(url).toLowerCase();
  const haystack = `${host} ${title}`.toLowerCase();
  if (haystack.includes("job") || haystack.includes("career") || haystack.includes("greenhouse.io") || haystack.includes("lever.co")) {
    return "official_job";
  }
  if (COMMUNITY_HOSTS.some((domain) => haystack.includes(domain))) {
    return "public_report";
  }
  const companyToken = normalizeCompanyToken(company);
  const hostToken = host.replace(/[^a-z0-9]/g, "");
  if (companyToken && hostToken.includes(companyToken)) {
    return "official_company";
  }
  return "market_heuristic";
}

function trustWeightFor(sourceType: EvidenceSourceType): Priority {
  if (sourceType === "official_company" || sourceType === "official_job" || sourceType === "user_note" || sourceType === "cv") {
    return "high";
  }
  if (sourceType === "public_report") return "medium";
  return "low";
}

function relevanceFor(sourceType: EvidenceSourceType, score?: unknown): Priority {
  if (sourceType === "user_note" || sourceType === "official_job") return "high";
  if (typeof score === "number") {
    if (score >= 0.75) return "high";
    if (score >= 0.4) return "medium";
    return "low";
  }
  return sourceType === "market_heuristic" ? "low" : "medium";
}

function appendEntry(
  entries: Omit<EvidenceLedgerEntry, "id">[],
  input: {
    sourceType: EvidenceSourceType;
    sourceLabel: string;
    snippet: string;
    url: string | null;
    relevance?: Priority;
    title?: string;
    platform?: string;
    publishedDate?: string | null;
    score?: unknown;
  },
) {
  const snippet = clip(input.snippet);
  if (!snippet) return;
  const sourceType = input.sourceType;
  entries.push({
    sourceType,
    sourceLabel: input.sourceLabel,
    excerpt: snippet,
    url: input.url,
    relevance: input.relevance ?? relevanceFor(sourceType, input.score),
    trustWeight: trustWeightFor(sourceType),
    contradictionGroup: null,
    title: input.title || input.sourceLabel,
    platform: input.platform || hostFor(input.url),
    publishedDate: input.publishedDate ?? null,
    snippet,
  });
}

function addRetrievedRows(
  entries: Omit<EvidenceLedgerEntry, "id">[],
  company: string,
  rows: any[],
  forcedSourceType?: EvidenceSourceType,
) {
  rows.forEach((row) => {
    const url = safeHttpUrl(row?.url);
    if (!url) return;
    const title = clip(row?.title, 180) || hostFor(url);
    const snippet = clip(row?.raw_content || row?.content || row?.snippet || row?.answer);
    if (!snippet) return;
    const sourceType = forcedSourceType ?? classifySource(url, title, company);
    appendEntry(entries, {
      sourceType,
      sourceLabel: title,
      title,
      snippet,
      url,
      platform: hostFor(url),
      publishedDate: typeof row?.published_date === "string" ? row.published_date : null,
      score: row?.score,
    });
  });
}

export function buildEvidenceLedger(input: EvidenceLedgerInput): EvidenceLedgerEntry[] {
  const entries: Omit<EvidenceLedgerEntry, "id">[] = [];

  appendEntry(entries, {
    sourceType: "user_note",
    sourceLabel: "User note",
    title: "User note",
    snippet: input.userNote || "",
    url: null,
    platform: "user",
    relevance: "high",
  });
  appendEntry(entries, {
    sourceType: "official_job",
    sourceLabel: "Pasted job description",
    title: "Pasted job description",
    snippet: input.jobDescription || "",
    url: null,
    platform: "user",
    relevance: "high",
  });
  appendEntry(entries, {
    sourceType: "cv",
    sourceLabel: "Candidate CV",
    title: "Candidate CV",
    snippet: input.cvText || "",
    url: null,
    platform: "user",
    relevance: "medium",
  });

  const companySearchPayloads = Array.isArray(input.companyResearchData?.search_results)
    ? input.companyResearchData.search_results
    : [];
  companySearchPayloads.forEach((payload: any) => {
    addRetrievedRows(entries, input.company, Array.isArray(payload?.results) ? payload.results : []);
  });

  const companyExtracts = Array.isArray(input.companyResearchData?.extracted_content)
    ? input.companyResearchData.extracted_content
    : [];
  addRetrievedRows(entries, input.company, companyExtracts);

  const jobResults = Array.isArray(input.jobRawData?.results) ? input.jobRawData.results : [];
  addRetrievedRows(entries, input.company, jobResults, "official_job");

  const seen = new Set<string>();
  return entries
    .filter((entry) => {
      const key = entry.url ? `url:${entry.url}` : `inline:${entry.sourceType}:${entry.snippet}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((entry, index) => ({ ...entry, id: `ev-${index + 1}` }));
}

export function validateEvidenceIds(value: unknown, ledger: EvidenceLedgerEntry[]): CitationValidationResult {
  const known = new Set(ledger.map((entry) => entry.id));
  const ids = Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  const validIds: string[] = [];
  const droppedIds: string[] = [];

  ids.forEach((id) => {
    if (known.has(id)) {
      if (!validIds.includes(id)) validIds.push(id);
    } else if (!droppedIds.includes(id)) {
      droppedIds.push(id);
    }
  });

  return { validIds, droppedIds };
}

export function sanitizePlanEvidenceCitations(plan: any, ledger: EvidenceLedgerEntry[]) {
  const droppedIds: string[] = [];
  const apply = (target: any) => {
    if (!target || typeof target !== "object") return;
    const result = validateEvidenceIds(target.evidenceIds, ledger);
    if (Array.isArray(target.evidenceIds) || result.validIds.length > 0) {
      target.evidenceIds = result.validIds;
    }
    droppedIds.push(...result.droppedIds);
  };

  (Array.isArray(plan?.stageRoadmap) ? plan.stageRoadmap : []).forEach(apply);
  const qp = plan?.questionPlan ?? {};
  ["coreMustPractice", "likelyFollowUps", "extraDepth"].forEach((tier) => {
    (Array.isArray(qp[tier]) ? qp[tier] : []).forEach(apply);
  });

  plan.internalEvidenceLog = ledger;
  if (ledger.length === 0 && plan?.summary && typeof plan.summary === "object") {
    plan.summary.weakSignalCase = true;
    plan.summary.overallConfidence = "low";
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

  return ledger
    .map((entry) => {
      const url = entry.url ? `\nURL: ${entry.url}` : "";
      const publishedDate = entry.publishedDate ? `\nPublished date: ${entry.publishedDate}` : "";
      return [
        `${entry.id} | ${entry.sourceType} | trust=${entry.trustWeight} | relevance=${entry.relevance}`,
        `Title: ${entry.title}`,
        `Platform: ${entry.platform}${publishedDate}${url}`,
        `Snippet passed to model: ${entry.snippet}`,
      ].join("\n");
    })
    .join("\n\n");
}
