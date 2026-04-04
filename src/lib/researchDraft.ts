export type SeniorityLevel = "junior" | "mid" | "senior";

export type ResearchStep = "company" | "details" | "tailoring";

export type AuthIntent = "research" | "practice" | "dashboard" | "profile";

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
  from: { pathname: string; search?: string };
  source?: "research_home";
  draftStorageKey?: string;
  intent?: AuthIntent;
  resumeLabel?: string;
};

export const RESEARCH_DRAFT_STORAGE_KEY = "prepio:research-home-draft:v1";
export const AUTH_RESUME_LABELS: Record<AuthIntent, string> = {
  research: "Research",
  practice: "Practice",
  dashboard: "Dashboard",
  profile: "Profile",
};

const RESEARCH_STEPS: ResearchStep[] = ["company", "details", "tailoring"];
const SENIORITY_LEVELS: SeniorityLevel[] = ["junior", "mid", "senior"];

const isBrowser = () => typeof window !== "undefined";

const isResearchStep = (value: unknown): value is ResearchStep =>
  typeof value === "string" && RESEARCH_STEPS.includes(value as ResearchStep);

const isSeniorityLevel = (value: unknown): value is SeniorityLevel =>
  typeof value === "string" && SENIORITY_LEVELS.includes(value as SeniorityLevel);

const normalizeString = (value: unknown) => (typeof value === "string" ? value : "");

export const getAuthIntentFromPath = (pathname: string): AuthIntent | undefined => {
  switch (pathname) {
    case "/":
      return "research";
    case "/practice":
      return "practice";
    case "/dashboard":
      return "dashboard";
    case "/profile":
      return "profile";
    default:
      return pathname.startsWith("/search/") ? "dashboard" : undefined;
  }
};

export const getAuthResumeLabel = (state?: Partial<AuthReturnState> | null) => {
  if (state?.resumeLabel) return state.resumeLabel;
  if (state?.intent) return AUTH_RESUME_LABELS[state.intent];

  const pathname = state?.from?.pathname;
  if (!pathname) return null;

  const intent = getAuthIntentFromPath(pathname);
  return intent ? AUTH_RESUME_LABELS[intent] : null;
};

type CreateAuthReturnStateInput = {
  pathname: string;
  draftStorageKey?: string;
  intent?: AuthIntent;
  resumeLabel?: string;
  source?: AuthReturnState["source"];
};

export const createAuthReturnState = ({
  pathname,
  draftStorageKey,
  intent,
  resumeLabel,
  source,
}: CreateAuthReturnStateInput): AuthReturnState => {
  // pathname may include a query string (e.g. "/dashboard?searchId=...")
  const qIndex = pathname.indexOf("?");
  const purePath = qIndex >= 0 ? pathname.slice(0, qIndex) : pathname;
  const search = qIndex >= 0 ? pathname.slice(qIndex) : undefined;
  const resolvedIntent = intent ?? getAuthIntentFromPath(purePath);

  return {
    from: { pathname: purePath, search },
    source,
    draftStorageKey,
    intent: resolvedIntent,
    resumeLabel: resumeLabel ?? (resolvedIntent ? AUTH_RESUME_LABELS[resolvedIntent] : undefined),
  };
};

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
