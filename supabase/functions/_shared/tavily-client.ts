// Shared Tavily client utility for consistent API interactions
import { RESEARCH_CONFIG } from "./config.ts";
import { UrlDeduplicationService } from "./url-deduplication.ts";

export interface TavilySearchRequest {
  query: string;
  searchDepth?: 'basic' | 'advanced';
  maxResults?: number;
  includeAnswer?: boolean;
  includeRawContent?: boolean;
  includeDomains?: string[];
  excludeDomains?: string[];
  timeRange?: 'day' | 'week' | 'month' | 'year';
}

export interface TavilyExtractRequest {
  urls: string[];
}

export interface TavilySearchResult {
  query: string;
  answer?: string;
  results: Array<{
    title: string;
    url: string;
    content: string;
    raw_content?: string;
    score: number;
    published_date?: string;
  }>;
}

export interface TavilyExtractResult {
  url: string;
  content: string;
  raw_content: string;
  status_code: number;
}

// Enhanced Tavily Search API with URL deduplication
export async function searchTavilyWithDeduplication(
  apiKey: string,
  request: TavilySearchRequest,
  company: string,
  role?: string,
  country?: string,
  searchId?: string,
  userId?: string,
  supabase?: any
): Promise<TavilySearchResult | null> {
  const startTime = Date.now();
  const endpoint = 'https://api.tavily.com/search';
  
  // Initialize URL deduplication service
  let urlDeduplication: UrlDeduplicationService | null = null;
  let deduplicationResult: any = null;
  
  if (supabase && company) {
    urlDeduplication = new UrlDeduplicationService(supabase);
    deduplicationResult = await urlDeduplication.findReusableUrls(company, role, country);
    
    // Add excluded domains to request if not already specified
    if (!request.excludeDomains && deduplicationResult.excluded_domains.length > 0) {
      request.excludeDomains = deduplicationResult.excluded_domains;
    }
  }

  const requestPayload = {
    query: request.query,
    search_depth: request.searchDepth || 'advanced',
    max_results: request.maxResults || 15,
    include_answer: request.includeAnswer !== false,
    include_raw_content: request.includeRawContent !== false,
    include_domains: request.includeDomains,
    exclude_domains: request.excludeDomains,
    time_range: request.timeRange
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestPayload),
    });

    const duration = Date.now() - startTime;
    const responseData = response.ok ? await response.json() : null;
    const resultsCount = responseData?.results?.length || 0;

    // Log to database if supabase client is available
    if (supabase && searchId && userId) {
      try {
        await supabase
          .schema("ops")
          .from("tavily_searches")
          .insert({
            search_id: searchId,
            user_id: userId,
            api_type: 'search',
            query_text: request.query,
            response_payload: responseData,
            response_status: response.status,
            results_count: resultsCount,
            request_duration_ms: duration,
            credits_used: 1, // Basic search = 1 credit
            error_message: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`
          });
      } catch (logError) {
        console.error("Failed to log Tavily search:", logError);
      }
    }

    if (response.ok) {
      // Store URLs and content using deduplication service
      if (urlDeduplication && responseData?.results && searchId) {
        try {
          for (const result of responseData.results) {
            // Assess content quality
            const contentType = urlDeduplication.classifyContentType(result.url, result.title, result.content);
            const qualityScore = urlDeduplication.assessContentQuality(
              result.content,
              result.title,
              result.url,
              contentType
            );

            // Store the URL
            const urlId = await urlDeduplication.storeScrapedUrl(
              result.url,
              company,
              role,
              country,
              {
                title: result.title,
                content_summary: result.content.substring(0, 500),
                content_type: contentType,
                quality_score: qualityScore,
                extraction_method: 'search_result'
              }
            );

            if (urlId) {
              // Store the content
              await urlDeduplication.storeScrapedContent(urlId, {
                full_content: result.content,
                raw_html: result.raw_content,
                extracted_questions: urlDeduplication.extractQuestions(result.content),
                extracted_insights: urlDeduplication.extractInsights(result.content),
                content_source: 'tavily_search'
              });

              // Track URL usage for this search
              await urlDeduplication.trackUrlUsage(searchId, urlId, 'fresh_scrape', qualityScore);
            }
          }
        } catch (storageError) {
          console.error("Failed to store URLs/content:", storageError);
        }
      }

      return responseData;
    }
    return null;
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Log error to database if supabase client is available
    if (supabase && searchId && userId) {
      try {
        await supabase
          .schema("ops")
          .from("tavily_searches")
          .insert({
            search_id: searchId,
            user_id: userId,
            api_type: 'search',
            query_text: request.query,
            response_payload: null,
            response_status: 0,
            results_count: 0,
            request_duration_ms: duration,
            credits_used: 0,
            error_message: (error as Error).message || "Network/API error"
          });
      } catch (logError) {
        console.error("Failed to log Tavily error:", logError);
      }
    }
    
    console.error("Error in Tavily search:", error);
    return null;
  }
}

// Tavily Extract API for deep content extraction
export async function extractTavily(
  apiKey: string,
  request: TavilyExtractRequest,
  searchId?: string,
  userId?: string,
  supabase?: any
): Promise<TavilyExtractResult[]> {
  const startTime = Date.now();
  const endpoint = 'https://api.tavily.com/extract';
  
  const requestPayload = {
    urls: request.urls
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestPayload),
    });

    const duration = Date.now() - startTime;
    const responseData = response.ok ? await response.json() : null;
    const resultsCount = responseData?.results?.length || 0;

    // Log to database if supabase client is available
    if (supabase && searchId && userId) {
      try {
        await supabase
          .schema("ops")
          .from("tavily_searches")
          .insert({
            search_id: searchId,
            user_id: userId,
            api_type: 'extract',
            query_text: `Extract ${request.urls.length} URLs`,
            response_payload: responseData,
            response_status: response.status,
            results_count: resultsCount,
            request_duration_ms: duration,
            credits_used: request.urls.length, // Extract = 1 credit per URL
            error_message: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`
          });
      } catch (logError) {
        console.error("Failed to log Tavily extract:", logError);
      }
    }

    if (response.ok) {
      return responseData.results || [];
    }
    return [];
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Log error to database if supabase client is available
    if (supabase && searchId && userId) {
      try {
        await supabase
          .schema("ops")
          .from("tavily_searches")
          .insert({
            search_id: searchId,
            user_id: userId,
            api_type: 'extract',
            query_text: `Extract ${request.urls.length} URLs`,
            response_payload: null,
            response_status: 0,
            results_count: 0,
            request_duration_ms: duration,
            credits_used: 0,
            error_message: (error as Error).message || "Network/API error"
          });
      } catch (logError) {
        console.error("Failed to log Tavily error:", logError);
      }
    }
    
    console.error("Error in Tavily extract:", error);
    return [];
  }
}

// Original Tavily Search API (for backward compatibility)
export async function searchTavily(
  apiKey: string,
  request: TavilySearchRequest,
  searchId?: string,
  userId?: string,
  supabase?: any
): Promise<TavilySearchResult | null> {
  // Use the enhanced version without deduplication by passing empty company
  return searchTavilyWithDeduplication(apiKey, request, '', undefined, undefined, searchId, userId, supabase);
}

// Function to get existing content for reusable URLs
export async function getExistingUrlContent(
  urls: string[],
  company: string,
  role?: string,
  country?: string,
  supabase?: any
): Promise<{ url: string; content: any; isReused: boolean }[]> {
  if (!supabase || !company || urls.length === 0) {
    return [];
  }

  try {
    const urlDeduplication = new UrlDeduplicationService(supabase);
    const existingContent = await urlDeduplication.getExistingContent(urls, company, role, country);
    
    return existingContent.map(item => ({
      url: item.url,
      content: {
        title: item.metadata.title,
        content: item.content.full_content,
        raw_content: item.content.raw_html,
        score: item.metadata.content_quality_score,
        extracted_questions: item.content.extracted_questions,
        extracted_insights: item.content.extracted_insights
      },
      isReused: true
    }));
  } catch (error) {
    console.error('Error getting existing URL content:', error);
    return [];
  }
}

// Function to combine fresh search results with existing cached content
export async function getCombinedSearchResults(
  company: string,
  role?: string,
  country?: string,
  supabase?: any
): Promise<{ reusableUrls: string[]; cachedResults: any[]; shouldSkipFreshSearch: boolean; excluded_domains: string[] }> {
  if (!supabase || !company) {
    return { reusableUrls: [], cachedResults: [], shouldSkipFreshSearch: false, excluded_domains: [] };
  }

  try {
    // Add timeout to the entire operation
    const combinedPromise = async () => {
      const urlDeduplication = new UrlDeduplicationService(supabase);
      const deduplicationResult = await urlDeduplication.findReusableUrls(company, role, country, {
        maxAgeDays: 7, // More recent for better relevance
        minQualityScore: 0.6, // Higher quality threshold
        limit: 20
      });

      // Get existing content for reusable URLs (but limit this)
      let existingContent: any[] = [];
      if (deduplicationResult.reusable_urls.length > 0) {
        try {
          existingContent = await getExistingUrlContent(
            deduplicationResult.reusable_urls.slice(0, 10), // Limit to 10 URLs max
            company,
            role,
            country,
            supabase
          );
        } catch (contentError) {
          console.warn('Error getting existing content, continuing without cache:', contentError);
        }
      }

      // Determine if we have enough cached content to skip fresh search
      const highQualityContent = existingContent.filter(item => item.content.score > 0.7);
      const shouldSkipFreshSearch = highQualityContent.length >= 8; // Reduced threshold

      return {
        reusableUrls: deduplicationResult.reusable_urls,
        cachedResults: existingContent,
        shouldSkipFreshSearch,
        excluded_domains: deduplicationResult.excluded_domains
      };
    };

    // Set a 10-second timeout for the entire combined operation
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Combined search timeout')), 10000)
    );

    return await Promise.race([combinedPromise(), timeoutPromise]) as any;
  } catch (error) {
    console.warn('Error getting combined search results, using fallback:', error);
    return { reusableUrls: [], cachedResults: [], shouldSkipFreshSearch: false, excluded_domains: [] };
  }
}

// Enhanced function to extract high-quality interview URLs with scoring
export function extractInterviewReviewUrls(searchResults: TavilySearchResult[]): string[] {
  const urlScores: Map<string, number> = new Map();
  
  searchResults.forEach(result => {
    if (result.results) {
      result.results.forEach(item => {
        let score = 0;
        const url = item.url.toLowerCase();
        const title = item.title.toLowerCase();
        const content = item.content.toLowerCase();
        
        // URL pattern scoring
        RESEARCH_CONFIG.content.interviewUrlPatterns.forEach(pattern => {
          if (url.includes(pattern.toLowerCase())) score += 3;
          if (title.includes(pattern.toLowerCase())) score += 2;
          if (content.includes(pattern.toLowerCase())) score += 1;
        });
        
        // Experience quality pattern scoring
        RESEARCH_CONFIG.content.experienceQualityPatterns.forEach(pattern => {
          const patternLower = pattern.toLowerCase();
          if (title.includes(patternLower)) score += 2;
          if (content.includes(patternLower)) score += 1;
        });
        
        // Forum-specific pattern bonus
        Object.entries(RESEARCH_CONFIG.content.forumContentPatterns).forEach(([platform, patterns]) => {
          if (url.includes(platform)) {
            patterns.forEach(pattern => {
              if (title.includes(pattern.toLowerCase()) || content.includes(pattern.toLowerCase())) {
                score += 2;
              }
            });
          }
        });
        
        // Priority scoring for high-value domains
        if (url.includes('glassdoor.com/interview')) score += 5;
        if (url.includes('blind.teamblind.com')) score += 4;
        if (url.includes('levels.fyi')) score += 3;
        if (url.includes('reddit.com/r/cscareerquestions')) score += 3;
        if (url.includes('1point3acres.com')) score += 2;
        if (url.includes('leetcode.com/discuss')) score += 2;
        
        // Freshness bonus (2024-2025 content)
        if (title.includes('2024') || title.includes('2025') || content.includes('2024') || content.includes('2025')) {
          score += 2;
        }
        
        // Only include URLs with minimum quality score
        if (score >= 3) {
          urlScores.set(item.url, score);
        }
      });
    }
  });
  
  // Sort by score and return top URLs
  const sortedUrls = Array.from(urlScores.entries())
    .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
    .map(([url]) => url)
    .slice(0, RESEARCH_CONFIG.tavily.maxResults.extraction);
  
  console.log(`Enhanced URL extraction: Found ${urlScores.size} quality URLs, returning top ${sortedUrls.length}`);
  
  return sortedUrls;
}
