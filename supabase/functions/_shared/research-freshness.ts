export interface ResearchSourceDate {
  url: string;
  publishedAt: string | null;
  observedAt: string;
}

export interface ResearchFreshness {
  sourceCount: number;
  datedSourceCount: number;
  observedAt: string;
  oldestPublishedAt: string | null;
  newestPublishedAt: string | null;
  sourceDates: ResearchSourceDate[];
  summary: string;
}

function normalizeObservedAt(value?: string): string {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString()
    : parsed.toISOString();
}

function normalizePublishedAt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return null;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function normalizeSourceUrl(value: unknown): string | null {
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

function buildSummary(sourceCount: number, publishedDates: string[]): string {
  const sourceLabel = sourceCount === 1 ? "source" : "sources";
  if (sourceCount === 0) {
    return "No research sources were captured for this run.";
  }
  if (publishedDates.length === 0) {
    return `Based on ${sourceCount} ${sourceLabel}; publication dates were unavailable.`;
  }

  const years = publishedDates.map((date) => Number(date.slice(0, 4)));
  const oldestYear = Math.min(...years);
  const newestYear = Math.max(...years);
  const yearLabel = oldestYear === newestYear
    ? String(oldestYear)
    : `${oldestYear}–${newestYear}`;
  const datedLabel = publishedDates.length === 1
    ? "the dated report is from"
    : `${publishedDates.length} dated reports span`;

  return `Based on ${sourceCount} ${sourceLabel}; ${datedLabel} ${yearLabel}.`;
}

/**
 * Builds deterministic run-level freshness metadata from real Tavily results.
 *
 * Source dates are kept separate from the model-authored evidence log: each
 * record is derived from a retrieved URL, de-duplicated, and stamped with the
 * time this research run observed it.
 */
export function buildResearchFreshness(
  searchPayloads: unknown,
  observedAt?: string,
): ResearchFreshness {
  const normalizedObservedAt = normalizeObservedAt(observedAt);
  const byUrl = new Map<string, string | null>();
  const payloads = Array.isArray(searchPayloads) ? searchPayloads : [];

  payloads.forEach((payload: unknown) => {
    if (!payload || typeof payload !== "object") return;
    const payloadRecord = payload as Record<string, unknown>;
    const results = Array.isArray(payloadRecord.results)
      ? payloadRecord.results
      : [];

    results.forEach((result: unknown) => {
      if (!result || typeof result !== "object") return;
      const resultRecord = result as Record<string, unknown>;
      const url = normalizeSourceUrl(resultRecord.url);
      if (!url) return;

      const publishedAt = normalizePublishedAt(
        resultRecord.published_date ?? resultRecord.publishedAt,
      );
      const existingPublishedAt = byUrl.get(url);
      if (!byUrl.has(url) || (!existingPublishedAt && publishedAt)) {
        byUrl.set(url, publishedAt);
      }
    });
  });

  const sourceDates = Array.from(byUrl, ([url, publishedAt]) => ({
    url,
    publishedAt,
    observedAt: normalizedObservedAt,
  }));
  const publishedDates = sourceDates
    .map((source) => source.publishedAt)
    .filter((date): date is string => Boolean(date))
    .sort();

  return {
    sourceCount: sourceDates.length,
    datedSourceCount: publishedDates.length,
    observedAt: normalizedObservedAt,
    oldestPublishedAt: publishedDates[0] ?? null,
    newestPublishedAt: publishedDates.at(-1) ?? null,
    sourceDates,
    summary: buildSummary(sourceDates.length, publishedDates),
  };
}
