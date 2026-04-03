export type SeniorityLevel = "junior" | "mid" | "senior";

export type ResearchStep = "company" | "details" | "tailoring";

export type ResearchDraft = {
  company: string;
  role: string;
  country: string;
  targetSeniority?: SeniorityLevel;
  cv: string;
  roleLinks: string;
  step: ResearchStep;
  savedAt: string;
};

export type AuthReturnState = {
  from: { pathname: string };
  source?: "research_home";
  draftStorageKey?: string;
};

export const RESEARCH_DRAFT_STORAGE_KEY = "prepio:research-home-draft:v1";

const RESEARCH_STEPS: ResearchStep[] = ["company", "details", "tailoring"];
const SENIORITY_LEVELS: SeniorityLevel[] = ["junior", "mid", "senior"];

const isBrowser = () => typeof window !== "undefined";

const isResearchStep = (value: unknown): value is ResearchStep =>
  typeof value === "string" && RESEARCH_STEPS.includes(value as ResearchStep);

const isSeniorityLevel = (value: unknown): value is SeniorityLevel =>
  typeof value === "string" && SENIORITY_LEVELS.includes(value as SeniorityLevel);

const normalizeString = (value: unknown) => (typeof value === "string" ? value : "");

export const normalizeResearchDraft = (value: unknown): ResearchDraft | null => {
  if (!value || typeof value !== "object") return null;

  const draft = value as Partial<ResearchDraft>;
  if (!isResearchStep(draft.step)) return null;

  return {
    company: normalizeString(draft.company),
    role: normalizeString(draft.role),
    country: normalizeString(draft.country),
    targetSeniority: isSeniorityLevel(draft.targetSeniority)
      ? draft.targetSeniority
      : undefined,
    cv: normalizeString(draft.cv),
    roleLinks: normalizeString(draft.roleLinks),
    step: draft.step,
    savedAt: normalizeString(draft.savedAt) || new Date().toISOString(),
  };
};

export const loadResearchDraft = (
  storageKey: string = RESEARCH_DRAFT_STORAGE_KEY,
): ResearchDraft | null => {
  if (!isBrowser()) return null;

  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    return normalizeResearchDraft(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const saveResearchDraft = (
  draft: ResearchDraft,
  storageKey: string = RESEARCH_DRAFT_STORAGE_KEY,
) => {
  if (!isBrowser()) return;

  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(draft));
  } catch {
    return;
  }
};

export const clearResearchDraft = (
  storageKey: string = RESEARCH_DRAFT_STORAGE_KEY,
) => {
  if (!isBrowser()) return;

  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    return;
  }
};
