export interface DeepExtractionPlanInput {
  candidateUrls: string[];
  plannedSearches: number;
  maxCredits: number;
  desiredMinUrls?: number;
  desiredMaxUrls?: number;
  enableDeepExtraction?: boolean;
}

export interface DeepExtractionPlan {
  urls: string[];
  plannedSearchCredits: number;
  plannedExtractCredits: number;
  estimatedCredits: number;
  maxCredits: number;
  remainingCreditsBeforeExtraction: number;
  candidateUrlCount: number;
  skippedReason: "disabled" | "no_urls" | "credit_cap_reached" | null;
}

function uniqueUrls(urls: string[]): string[] {
  return Array.from(new Set(urls.map((url) => url.trim()).filter(Boolean)));
}

export function planDeepExtraction(input: DeepExtractionPlanInput): DeepExtractionPlan {
  const {
    candidateUrls,
    desiredMaxUrls = 5,
    enableDeepExtraction = true,
  } = input;

  const plannedSearchCredits = Math.max(0, Math.floor(input.plannedSearches));
  const maxCredits = Math.max(0, Math.floor(input.maxCredits));
  const candidates = uniqueUrls(candidateUrls);
  const remainingCreditsBeforeExtraction = Math.max(0, maxCredits - plannedSearchCredits);

  let skippedReason: DeepExtractionPlan["skippedReason"] = null;
  if (!enableDeepExtraction) {
    skippedReason = "disabled";
  } else if (candidates.length === 0) {
    skippedReason = "no_urls";
  } else if (remainingCreditsBeforeExtraction === 0) {
    skippedReason = "credit_cap_reached";
  }

  const maxUrlsWithinBudget = skippedReason
    ? 0
    : Math.min(Math.max(0, desiredMaxUrls), remainingCreditsBeforeExtraction);
  const urls = candidates.slice(0, maxUrlsWithinBudget);
  const plannedExtractCredits = urls.length;

  return {
    urls,
    plannedSearchCredits,
    plannedExtractCredits,
    estimatedCredits: plannedSearchCredits + plannedExtractCredits,
    maxCredits,
    remainingCreditsBeforeExtraction,
    candidateUrlCount: candidates.length,
    skippedReason,
  };
}
