// Decides which community-source domains to exclude from the Tavily discovery
// phase based on what the native scrapers actually returned.
//
// The hybrid path native-scrapes Glassdoor/Blind/Reddit/LeetCode, then asked
// Tavily to skip those domains under the assumption that native coverage
// would carry them. In practice those sites are the most anti-bot-protected,
// so when native yield is zero the source is silently dropped from both paths
// — exactly the candidate-reported content the analyzer needs (PREPIO-49).
//
// The fix: only exclude a domain from Tavily when its native scrape cleared a
// coverage threshold. Below threshold, let Tavily try to fill the gap.

export const NATIVE_PLATFORM_DOMAINS: Record<string, string[]> = {
  glassdoor: ["glassdoor.com"],
  reddit: ["reddit.com"],
  blind: ["blind.teamblind.com"],
  leetcode: ["leetcode.com"],
};

// A platform is considered covered when native scraping returned at least this
// many experiences. The company-analysis prompt asks for 8-12 questions per
// category, so a handful of native hits per platform is a reasonable floor
// before we stop asking Tavily to look there too.
export const NATIVE_COVERAGE_THRESHOLD = 3;

export interface CoverageDecision {
  excludedDomains: string[];
  rescuedDomains: string[];
  uncoveredPlatforms: string[];
}

export function decideTavilyCoverage(
  platformBreakdown: Record<string, number> | undefined | null,
  threshold: number = NATIVE_COVERAGE_THRESHOLD,
): CoverageDecision {
  const breakdown = platformBreakdown ?? {};
  const excludedDomains: string[] = [];
  const rescuedDomains: string[] = [];
  const uncoveredPlatforms: string[] = [];

  for (const [platform, domains] of Object.entries(NATIVE_PLATFORM_DOMAINS)) {
    const yieldCount = breakdown[platform] ?? 0;
    if (yieldCount >= threshold) {
      excludedDomains.push(...domains);
    } else {
      rescuedDomains.push(...domains);
      uncoveredPlatforms.push(platform);
    }
  }

  return { excludedDomains, rescuedDomains, uncoveredPlatforms };
}
