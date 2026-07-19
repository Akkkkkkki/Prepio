import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";
import { extractInterviewReviewUrls, searchTavily, TavilySearchRequest } from "../_shared/tavily-client.ts";
import { callOpenAI, parseJsonResponse, OpenAIRequest } from "../_shared/openai-client.ts";
import { SearchLogger } from "../_shared/logger.ts";
import { RESEARCH_CONFIG, getCompanyTicker, getOpenAIModel } from "../_shared/config.ts";
import { UrlDeduplicationService } from "../_shared/url-deduplication.ts";
import { authorizeRequest, ensureServiceCaller } from "../_shared/auth.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { buildSearchPayloads, type SearchPayload } from "./result-aggregation.ts";
import { buildResearchQueryPlan, type ResearchLevel } from "./query-planner.ts";
import { getCompanyAnalysisSystemPrompt } from "./analysis-prompt.ts";

interface CompanyResearchRequest {
  company: string;
  role?: string;
  country?: string;
  level?: ResearchLevel;
  userNote?: string;
  searchId: string;
}

interface InterviewStage {
  name: string;
  order_index: number;
  duration: string;
  interviewer: string;
  content: string;
  common_questions: string[];
  difficulty_level: string;
  success_tips: string[];
}

interface CompanyInsights {
  name: string;
  industry: string;
  culture: string;
  values: string[];
  interview_philosophy: string;
  recent_hiring_trends: string;
  interview_stages: InterviewStage[];
  interview_experiences: {
    positive_feedback: string[];
    negative_feedback: string[];
    common_themes: string[];
    difficulty_rating: string;
    process_duration: string;
  };
  interview_questions_bank: {
    behavioral: string[];
    technical: string[];
    situational: string[];
    company_specific: string[];
  };
  hiring_manager_insights: {
    what_they_look_for: string[];
    red_flags: string[];
    success_factors: string[];
  };
}

interface CompanyResearchOutput {
  company_insights: CompanyInsights;
  raw_research_data: any[];
}

// Enhanced company research with URL extraction and deep content analysis
async function searchCompanyInfo(
  company: string,
  role?: string,
  country?: string,
  level?: ResearchLevel,
  userNote?: string,
  searchId?: string,
  userId?: string,
  supabase?: any,
  logger?: SearchLogger
): Promise<any> {
  // Set a maximum execution time for the entire function (15 seconds for concurrent execution)
  const functionTimeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Company research function timeout')), 15000)
  );

  const researchPromise = async () => {
    const tavilyApiKey = Deno.env.get("TAVILY_API_KEY");
    if (!tavilyApiKey) {
      const errorMsg = "TAVILY_API_KEY not found in environment variables. Ensure you're running functions with: supabase functions serve --env-file .env.local";
      logger?.log('CONFIG_ERROR', 'API_KEY_MISSING', {
        company,
        role,
        missingKey: 'TAVILY_API_KEY'
      }, errorMsg);
      console.warn("TAVILY_API_KEY missing. Set it in the function secrets or .env.local.");
      return null;
    }

    logger?.log('CONFIG_SUCCESS', 'API_KEY_FOUND', { company, role, country, tavilyKeyLength: tavilyApiKey.length });

    logger?.log('SEARCH_START', 'COMPANY_INFO', { company, role, country });

    try {
      // Initialize URL deduplication service
      const urlDeduplication = new UrlDeduplicationService(supabase);

      // Phase 0: Check for cached research and existing content
      logger?.logPhaseTransition('INIT', 'CACHE_CHECK', { company, role, country });
      console.log("Phase 0: Checking for cached research and existing content...");

      // URL Deduplication: Find reusable content to reduce API costs
      let combinedResults: {
        reusableUrls: string[];
        cachedResults: any[];
        shouldSkipFreshSearch: boolean;
        excluded_domains: string[];
      } = {
        reusableUrls: [],
        cachedResults: [],
        shouldSkipFreshSearch: false,
        excluded_domains: []
      };

      try {
        const deduplicationResult = await urlDeduplication.findReusableUrls(company, role, country);

        if (deduplicationResult.reusable_urls.length > 0) {
          console.log(`Found ${deduplicationResult.reusable_urls.length} reusable URLs for ${company}`);

          // Get cached content for reusable URLs
          const cachedContent = await urlDeduplication.getExistingContent(deduplicationResult.reusable_urls, company, role, country);

          combinedResults = {
            reusableUrls: deduplicationResult.reusable_urls,
            cachedResults: cachedContent.map(item => ({
              url: item.url,
              content: {
                title: item.title,
                content: item.content,
                raw_content: item.content,
                score: 0.8 // Default score for cached content
              }
            })),
            shouldSkipFreshSearch: cachedContent.length >= 5, // Use cache if we have enough content
            excluded_domains: []
          };

          logger?.log('URL_DEDUPLICATION_SUCCESS', 'CACHE_HIT', {
            reusable_urls_found: deduplicationResult.reusable_urls.length,
            cached_content_retrieved: cachedContent.length,
            will_skip_fresh_search: combinedResults.shouldSkipFreshSearch
          });
        } else {
          console.log('No reusable URLs found, proceeding with fresh search');
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn('URL deduplication failed, proceeding with fresh search:', errorMsg);
        logger?.log('URL_DEDUPLICATION_FAILED', 'FALLBACK', { error: errorMsg });
      }

      // Store combinedResults for later use in response
      (logger as any).combinedResults = combinedResults;
      logger?.log('CACHE_CHECK_COMPLETE', 'PHASE0', {
        reusableUrls: combinedResults.reusableUrls.length,
        cachedResults: combinedResults.cachedResults.length,
        shouldSkipFreshSearch: combinedResults.shouldSkipFreshSearch
      });

      let searchResults: any[] = [];
      let validFreshResults: any[] = [];

      // If we have sufficient cached content, use it and skip fresh searches
      if (combinedResults.shouldSkipFreshSearch) {
        logger?.log('USING_CACHED_CONTENT', 'OPTIMIZATION', {
          cachedResultsCount: combinedResults.cachedResults.length,
          reason: 'Sufficient high-quality cached content available'
        });
        console.log(`Using ${combinedResults.cachedResults.length} cached results, skipping fresh search...`);

        const built = buildSearchPayloads({
          shouldSkipFresh: true,
          freshResults: [],
          cachedResults: combinedResults.cachedResults,
          company,
        });
        searchResults = built.searchPayloads;
        validFreshResults = built.validFreshResults;
      } else {
        const queryPlan = buildResearchQueryPlan({
          company,
          role,
          country,
          level,
          userNote,
          ticker: getCompanyTicker(company),
          // Keep today under the existing 15s synchronous budget: 6 searches
          // is one fifth of the configured per-run credit cap and matches the
          // previous discovery breadth.
          maxQueries: Math.min(6, RESEARCH_CONFIG.tavily.maxCreditsPerSearch),
        });
        const searchQueries = queryPlan.queries;

        logger?.log('QUERY_PLAN', 'DISCOVERY', {
          roleFamily: queryPlan.roleFamily,
          signals: queryPlan.signals,
          queries: queryPlan.queries,
          includeDomains: queryPlan.includeDomains,
          budget: queryPlan.budget,
        });

        logger?.logPhaseTransition('CACHE_CHECK', 'DISCOVERY', {
          queriesCount: searchQueries.length,
          cachedUrls: combinedResults.reusableUrls.length
        });
        console.log(`Phase 1: Discovering interview review URLs with enhanced forum targeting...`);

        // Phase 1: Discovery - collect URLs with comprehensive search for quality forum content
        const searchPromises = searchQueries.map(async (query, index) => {
          const startTime = Date.now();
          logger?.log('TAVILY_SEARCH_START', 'DISCOVERY', {
            query: query.query,
            source: query.source,
            index: index + 1,
            total: searchQueries.length,
            roleFamily: queryPlan.roleFamily,
          });

          const request: TavilySearchRequest = {
            query: query.query,
            searchDepth: 'basic', // Reduced depth for speed
            maxResults: 3, // Reduced from default to prevent timeout
            includeAnswer: true,
            includeRawContent: true,
            includeDomains: queryPlan.includeDomains,
            timeRange: RESEARCH_CONFIG.tavily.timeRange
          };

          try {
            const result = await searchTavily(tavilyApiKey, request, searchId, userId, supabase);
            const duration = Date.now() - startTime;

            logger?.logTavilySearch(query.query, 'DISCOVERY_SUCCESS', request, result, undefined, duration);
            if (!result?.results?.length) {
              logger?.log('TAVILY_SEARCH_EMPTY', 'DISCOVERY', {
                query: query.query,
                source: query.source,
                fallbackEngaged: false,
                reason: 'duckduckgo_instant_answer_fallback_removed',
              });
            }
            if (!result) return null;
            const payload: SearchPayload = {
              query: result.query,
              answer: result.answer ?? "",
              results: result.results.map((item) => ({
                title: item.title,
                url: item.url,
                content: item.content,
                raw_content: item.raw_content ?? null,
                score: item.score,
                published_date: item.published_date ?? null,
              })),
            };
            return payload;
          } catch (error) {
            const duration = Date.now() - startTime;
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            logger?.logTavilySearch(query.query, 'DISCOVERY_ERROR', request, undefined, errorMsg, duration);
            logger?.log('TAVILY_SEARCH_FALLBACK_UNAVAILABLE', 'DISCOVERY', {
              query: query.query,
              source: query.source,
              fallbackEngaged: false,
              reason: 'duckduckgo_instant_answer_fallback_removed',
            }, errorMsg);
            return null;
          }
        });

        const freshSearchResults = await Promise.all(searchPromises);
        const built = buildSearchPayloads({
          shouldSkipFresh: false,
          freshResults: freshSearchResults,
          cachedResults: combinedResults.cachedResults,
          company,
        });
        searchResults = built.searchPayloads;
        validFreshResults = built.validFreshResults;

        logger?.log('DISCOVERY_COMPLETE', 'PHASE1', {
          totalQueries: searchQueries.length,
          successfulResults: validFreshResults.length,
          failedResults: searchQueries.length - validFreshResults.length,
          cachedResultsAvailable: combinedResults.cachedResults.length
        });
      }

      // Phase 2: Extract URLs for deep content extraction
      logger?.logPhaseTransition('DISCOVERY', 'EXTRACTION', { urlsFound: 0 });
      const interviewUrls = extractInterviewReviewUrls(searchResults);
      logger?.log('URL_EXTRACTION', 'PHASE2', { totalUrls: interviewUrls.length, urls: interviewUrls.slice(0, 10) });
      console.log(`Phase 2: Extracting content from ${interviewUrls.length} interview review URLs...`);

      // Skip extraction phase temporarily to speed up response
      console.log(`Phase 2: Skipping URL extraction for faster response (found ${interviewUrls.length} URLs)`);
      const extractedContent: any[] = [];
      logger?.log('EXTRACTION_SKIPPED', 'PHASE2', { reason: 'Disabled for speed', urlsFound: interviewUrls.length });

      logger?.logPhaseTransition('EXTRACTION', 'RESULT_AGGREGATION', {
        searchResults: searchResults.length,
        extractedContent: extractedContent.length
      });

      // Combine search results with extracted content
      const result = {
        search_results: searchResults,
        extracted_content: extractedContent,
        total_urls_extracted: interviewUrls.length
      };

      logger?.log('SEARCH_COMPLETE', 'COMPANY_INFO', result);
      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger?.log('SEARCH_ERROR', 'COMPANY_INFO', { company, role }, errorMsg);
      console.error("Error in enhanced company search:", error);
      return null;
    }
  }; // End of researchPromise

  try {
    return await Promise.race([researchPromise(), functionTimeout]);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger?.log('SEARCH_TIMEOUT', 'COMPANY_INFO', { company, role }, errorMsg);
    console.error("Company research timed out or failed:", error);
    return null;
  }
}

// AI analysis of company research data
async function analyzeCompanyData(
  company: string,
  role: string | undefined,
  country: string | undefined,
  researchData: any,
  openaiApiKey: string,
  logger?: SearchLogger
): Promise<CompanyInsights> {

  logger?.log('ANALYSIS_START', 'COMPANY_DATA', { company, role, country });

  let researchContext = `Company: ${company}`;
  if (role) researchContext += `\nRole: ${role}`;
  if (country) researchContext += `\nCountry: ${country}`;

  if (researchData) {
    researchContext += `\n\nCompany Research Data:\n`;

    // Process search results
    if (researchData.search_results) {
      researchData.search_results.forEach((result: any, index: number) => {
        if (result.answer) {
          researchContext += `Research ${index + 1}: ${result.answer}\n`;
        }
        if (result.results) {
          result.results.forEach((item: any) => {
            researchContext += `- ${item.title}: ${item.content}\n`;

            if (item.raw_content) {
              researchContext += `SOURCE-START\n${item.url}\n${item.raw_content.slice(0, RESEARCH_CONFIG.content.maxContentLength.sourceSnippet)}\nSOURCE-END\n\n`;
            }
          });
        }
      });
    }

    // Process extracted content from interview review sites
    if (researchData.extracted_content && researchData.extracted_content.length > 0) {
      researchContext += `\n\nDeep Extracted Interview Reviews:\n`;
      researchData.extracted_content.forEach((extract: any, index: number) => {
        if (extract.content && extract.url) {
          researchContext += `DEEP-EXTRACT-START\n${extract.url}\n${extract.content.slice(0, RESEARCH_CONFIG.content.maxContentLength.deepExtract)}\nDEEP-EXTRACT-END\n\n`;
        }
      });
    }
  }

  const openaiRequest: OpenAIRequest = {
    model: getOpenAIModel('companyResearch'),
    systemPrompt: getCompanyAnalysisSystemPrompt(),
    prompt: `Analyze this company research data and extract structured insights based on REAL candidate experiences:\n\n${researchContext}`,
    maxTokens: RESEARCH_CONFIG.openai.maxTokens.companyAnalysis,
    useJsonMode: RESEARCH_CONFIG.openai.useJsonMode
  };

  logger?.logDataProcessing('CONTEXT_BUILDING', {
    company, role, country,
    hasResearchData: !!researchData,
    searchResultsCount: researchData?.search_results?.length || 0,
    extractedContentCount: researchData?.extracted_content?.length || 0
  }, { contextLength: researchContext.length });

  try {
    const startTime = Date.now();
    logger?.logOpenAI('COMPANY_ANALYSIS', 'REQUEST_START', openaiRequest);

    const response = await callOpenAI(openaiApiKey, openaiRequest);
    const duration = Date.now() - startTime;

    logger?.logOpenAI('COMPANY_ANALYSIS', 'REQUEST_SUCCESS', openaiRequest, response, undefined, duration);

    const result = parseJsonResponse(response.content, {
      name: company,
      industry: "Unknown",
      culture: "Research in progress",
      values: [],
      interview_philosophy: "Standard interview process",
      recent_hiring_trends: "Information not available",
      interview_stages: [],
      interview_experiences: {
        positive_feedback: [],
        negative_feedback: [],
        common_themes: [],
        difficulty_rating: "Unknown",
        process_duration: "Unknown"
      },
      interview_questions_bank: {
        behavioral: [],
        technical: [],
        situational: [],
        company_specific: []
      },
      hiring_manager_insights: {
        what_they_look_for: [],
        red_flags: [],
        success_factors: []
      }
    });

    logger?.log('ANALYSIS_COMPLETE', 'COMPANY_DATA', {
      hasInterviewStages: result.interview_stages?.length > 0,
      stagesCount: result.interview_stages?.length || 0
    });

    return result;
  } catch (analysisError) {
    const errorMsg = analysisError instanceof Error ? analysisError.message : 'Unknown error';
    logger?.logOpenAI('COMPANY_ANALYSIS', 'REQUEST_ERROR', openaiRequest, undefined, errorMsg);
    console.error("Failed to analyze company data:", analysisError);

    // Return fallback structure
    return {
      name: company,
      industry: "Unknown",
      culture: "Research in progress",
      values: [],
      interview_philosophy: "Standard interview process",
      recent_hiring_trends: "Information not available",
      interview_stages: [],
      interview_experiences: {
        positive_feedback: [],
        negative_feedback: [],
        common_themes: [],
        difficulty_rating: "Unknown",
        process_duration: "Unknown"
      },
      interview_questions_bank: {
        behavioral: [],
        technical: [],
        situational: [],
        company_specific: []
      },
      hiring_manager_insights: {
        what_they_look_for: [],
        red_flags: [],
        success_factors: []
      }
    };
  }
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Create Supabase client up front so auth checks can run before any work.
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const authResult = await authorizeRequest(req, supabase);
  if (!authResult.ok) {
    return new Response(authResult.response.body, {
      status: authResult.response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const serviceCheck = ensureServiceCaller(authResult.context);
  if (!serviceCheck.ok) {
    return new Response(serviceCheck.response.body, {
      status: serviceCheck.response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { company, role, country, level, userNote, searchId } = await req.json() as CompanyResearchRequest;

    if (!company || !searchId) {
      throw new Error("Missing required parameters: company and searchId");
    }

    // Initialize logger
    const logger = new SearchLogger(searchId, 'company-research');
    logger.log('REQUEST_INPUT', 'VALIDATION', { company, role, country, level, hasUserNote: !!userNote, searchId });

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("Missing OpenAI API key");
    }

    console.log("Starting company research for", company, role || "");

    // Get userId from searches table for logging
    const { data: searchData } = await supabase
      .from("searches")
      .select("user_id")
      .eq("id", searchId)
      .single();

    const userId = searchData?.user_id;

    // Step 1: Conduct retrieval-grounded research via Tavily across every
    // allowed community domain.
    logger.log('STEP_START', 'RESEARCH', { step: 1, description: 'Conducting retrieval-grounded research' });
    console.log("Conducting retrieval-grounded research (Tavily)...");
    const researchData = await searchCompanyInfo(company, role, country, level, userNote, searchId, userId, supabase, logger);

    // Step 2: Analyze research data using AI
    logger.log('STEP_START', 'ANALYSIS', { step: 2, description: 'Analyzing company data' });
    console.log("Analyzing company data...");
    const companyInsights = await analyzeCompanyData(
      company,
      role,
      country,
      researchData,
      openaiApiKey,
      logger
    );

    // Step 3: Skip caching temporarily to avoid timeout issues
    console.log("Skipping research caching to avoid timeouts...");

    const researchOutput: CompanyResearchOutput = {
      company_insights: companyInsights,
      raw_research_data: researchData || []
    };

    console.log("Company research completed successfully");

    const responseData = {
      status: "success",
      message: "Company research completed",
      company_insights: companyInsights,
      research_sources: researchData ? researchData.search_results?.length || 0 : 0,
      extracted_urls: researchData ? researchData.total_urls_extracted || 0 : 0,
      deep_extracts: researchData ? researchData.extracted_content?.length || 0 : 0,
      optimization_info: {
        cached_urls_reused: 0, // Disabled temporarily
        fresh_searches_performed: 2, // Reduced for speed
        excluded_domains: 0, // Disabled temporarily
        cache_optimization_active: false, // Disabled temporarily
        speed_optimizations: "URL deduplication and extraction disabled for faster response"
      }
    };

    logger.logFunctionEnd(true, responseData);

    // Save logs to file for debugging
    await logger.saveToFile();

    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error processing company research:", error);

    // Try to get the logger from the request context if available
    try {
      const { searchId } = await req.json();
      if (searchId) {
        const errorLogger = new SearchLogger(searchId, 'company-research');
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errorLogger.logFunctionEnd(false, undefined, errorMsg);
        await errorLogger.saveToFile();
      }
    } catch (logError) {
      console.error("Failed to log error:", logError);
    }

    return new Response(
      JSON.stringify({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to process company research"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
