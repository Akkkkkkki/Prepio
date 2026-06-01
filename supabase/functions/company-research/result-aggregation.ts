// Pure aggregation of fresh Tavily search results and cached content into
// the `search_results` payload returned by `searchCompanyInfo`.
//
// Extracted so the cached-only and fresh+cached branches share one
// implementation, and so the contract (non-empty payload when search hits or
// cache hits exist) can be exercised in Vitest without spinning up Deno.

export interface CachedContentRow {
  url: string;
  content: {
    title?: string;
    content?: string;
    raw_content?: unknown;
    score?: number;
  };
}

export interface SearchResultRecord {
  title: string;
  url: string;
  content: string | undefined;
  raw_content: unknown;
  score: number | undefined;
  published_date: string | null;
}

export interface SearchPayload {
  query: string;
  answer: string;
  results: SearchResultRecord[];
}

export interface BuildSearchPayloadsInput {
  shouldSkipFresh: boolean;
  freshResults: Array<SearchPayload | null>;
  cachedResults: CachedContentRow[];
  company: string;
}

export interface BuildSearchPayloadsOutput {
  searchPayloads: SearchPayload[];
  validFreshResults: SearchPayload[];
}

function cachedRowToRecord(cached: CachedContentRow): SearchResultRecord {
  return {
    title: cached.content.title || "Cached Content",
    url: cached.url,
    content: cached.content.content,
    raw_content: cached.content.raw_content,
    score: cached.content.score,
    published_date: null,
  };
}

export function buildSearchPayloads(
  input: BuildSearchPayloadsInput,
): BuildSearchPayloadsOutput {
  const { shouldSkipFresh, freshResults, cachedResults, company } = input;

  if (shouldSkipFresh) {
    const cachedPayload: SearchPayload = {
      query: `Cached results for ${company}`,
      answer: `Using cached interview and company data for ${company}`,
      results: cachedResults.map(cachedRowToRecord),
    };
    return { searchPayloads: [cachedPayload], validFreshResults: [] };
  }

  const validFreshResults = freshResults.filter(
    (r): r is SearchPayload => r !== null,
  );

  if (cachedResults.length > 0) {
    const cachedPayload: SearchPayload = {
      query: `Cached content for ${company}`,
      answer: `Reusing ${cachedResults.length} previously analyzed sources`,
      results: cachedResults.map(cachedRowToRecord),
    };
    return {
      searchPayloads: [cachedPayload, ...validFreshResults],
      validFreshResults,
    };
  }

  return { searchPayloads: validFreshResults, validFreshResults };
}
