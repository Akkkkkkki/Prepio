export interface ResearchSourceDate {
  url: string;
  publishedAt: string | null;
  observedAt: string;
}

export interface ResearchFreshness {
  sourceCount: number;
  datedSourceCount: number;
  /** When this run assembled the freshness metadata. */
  observedAt: string;
  /**
   * Earliest / latest time any individual source in this run was actually
   * fetched from its origin. Cached sources carry their original scrape time,
   * so these are not the run time when the cache was reused.
   */
  oldestObservedAt: string | null;
  newestObservedAt: string | null;
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

/**
 * Per-source observation time, if the retrieval path recorded one. Cached
 * rows carry the timestamp of the original scrape; fresh Tavily results have
 * none and fall back to the run's observation time.
 */
function normalizeSourceObservedAt(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value.trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
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
  const byUrl = new Map<string, { publishedAt: string | null; observedAt: string }>();
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
      // A source reused from the scrape cache was never re-fetched in this
      // run, so it keeps its original observation time rather than "now".
      const sourceObservedAt = normalizeSourceObservedAt(
        resultRecord.observed_at ?? resultRecord.observedAt,
      ) ?? normalizedObservedAt;

      const existing = byUrl.get(url);
      if (!existing) {
        byUrl.set(url, { publishedAt, observedAt: sourceObservedAt });
        return;
      }
      // Keep the first published date we can find, and the most recent
      // observation across duplicate hits on the same URL.
      byUrl.set(url, {
        publishedAt: existing.publishedAt ?? publishedAt,
        observedAt: sourceObservedAt > existing.observedAt
          ? sourceObservedAt
          : existing.observedAt,
      });
    });
  });

  return summarize(Array.from(byUrl, ([url, entry]) => ({
    url,
    publishedAt: entry.publishedAt,
    observedAt: entry.observedAt,
  })), normalizedObservedAt);
}

function summarize(
  sourceDates: ResearchSourceDate[],
  runObservedAt: string,
): ResearchFreshness {
  const publishedDates = sourceDates
    .map((source) => source.publishedAt)
    .filter((date): date is string => Boolean(date))
    .sort();
  const observedDates = sourceDates
    .map((source) => source.observedAt)
    .sort();

  return {
    sourceCount: sourceDates.length,
    datedSourceCount: publishedDates.length,
    observedAt: runObservedAt,
    oldestObservedAt: observedDates[0] ?? null,
    newestObservedAt: observedDates.at(-1) ?? null,
    oldestPublishedAt: publishedDates[0] ?? null,
    newestPublishedAt: publishedDates.at(-1) ?? null,
    sourceDates,
    summary: buildSummary(sourceDates.length, publishedDates),
  };
}

/**
 * Unions freshness from every retrieval path a run used (company search and
 * job-description extraction), de-duplicating by source URL so a link that
 * both paths touched is counted once.
 */
export function mergeResearchFreshness(
  parts: Array<ResearchFreshness | null | undefined>,
  observedAt?: string,
): ResearchFreshness | null {
  const present = parts.filter((part): part is ResearchFreshness => Boolean(part));
  if (present.length === 0) return null;

  const byUrl = new Map<string, ResearchSourceDate>();
  present.forEach((part) => {
    (part.sourceDates ?? []).forEach((source) => {
      const existing = byUrl.get(source.url);
      if (!existing) {
        byUrl.set(source.url, source);
        return;
      }
      byUrl.set(source.url, {
        url: source.url,
        publishedAt: existing.publishedAt ?? source.publishedAt,
        observedAt: source.observedAt > existing.observedAt
          ? source.observedAt
          : existing.observedAt,
      });
    });
  });

  const runObservedAt = normalizeObservedAt(
    observedAt ?? present.map((part) => part.observedAt).sort().at(-1),
  );
  return summarize(Array.from(byUrl.values()), runObservedAt);
}
