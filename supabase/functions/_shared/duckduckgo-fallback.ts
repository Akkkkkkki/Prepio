// Tavily-only search wrapper.
//
// PREPIO-80 removed the old DuckDuckGo instant-answer fallback because it is
// not a web/forum search API and returned encyclopedic abstracts instead of
// interview reports. Keep this compatibility export for any older imports, but
// do not silently substitute non-equivalent evidence.

import { searchTavily } from "./tavily-client.ts";

export async function searchWithFallback(
  tavilyApiKey: string,
  query: string,
  maxResults: number = 10,
  searchId?: string,
  userId?: string,
  supabase?: any
): Promise<any> {
  try {
    console.log('Attempting Tavily search...');
    const tavilyResult = await searchTavily(tavilyApiKey, {
      query,
      searchDepth: 'basic',
      maxResults,
      includeAnswer: true,
      includeRawContent: false
    }, searchId, userId, supabase);
    
    if (tavilyResult && tavilyResult.results && tavilyResult.results.length > 0) {
      return tavilyResult;
    }
    console.warn('Tavily returned no results; no non-equivalent fallback will be used.');
  } catch (error) {
    console.warn('Tavily search failed; no non-equivalent fallback will be used:', error);
  }

  return null;
}
