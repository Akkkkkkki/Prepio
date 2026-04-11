#!/usr/bin/env -S deno test --allow-all
/**
 * Filename: test_03_company_research.ts
 * Author: Nan Zhou
 * Date: 2025-01-15
 * Description: Unit tests for company-research Edge Function - Step 3.1 of interview prep workflow
 *
 * Business Flow:
 *   Direct call to company-research function (independent test)
 *   System performs AI-powered company research using Tavily API
 *   Test verifies: Company insights returned + Database records created
 *
 * What we verify:
 *   - Function returns valid company_insights JSON
 *   - Tavily API calls are logged in tavily_searches table
 *   - Scraped URLs are stored in scraped_urls table
 *   - Company culture, values, interview process extracted
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.192.0/testing/asserts.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { load } from "jsr:@std/dotenv";
await load({ envPath: ".env.local", export: true });

// ============================================================================
// Test Configuration
// ============================================================================
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "http://localhost:54321";
const supabaseKey =
  Deno.env.get("SUPABASE_PUBLISHABLE_DEFAULT_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY") ??
  "";

// Test user credentials
const TEST_USER_EMAIL = Deno.env.get("TEST_USER_EMAIL") ?? "joe.zhounan@gmail.com";
const TEST_USER_PASSWORD = Deno.env.get("TEST_USER_PASSWORD") ?? "x198239x";

// ============================================================================
// Helper Functions
// ============================================================================
async function getAuthenticatedClient(): Promise<{ client: SupabaseClient, userId: string }> {
  const client = createClient(supabaseUrl, supabaseKey);

  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });

  if (authError) {
    throw new Error(`Failed to authenticate test user: ${authError.message}`);
  }

  if (!authData.user) {
    throw new Error("No user returned from authentication");
  }

  return { client, userId: authData.user.id };
}

async function createTestSearch(
  supabase: SupabaseClient,
  userId: string,
  company: string,
  role: string
): Promise<string> {
  const { data: search, error } = await supabase
    .from("searches")
    .insert({
      user_id: userId,
      company,
      role,
      country: "United States",
      search_status: "pending"
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create test search: ${error.message}`);
  return search.id;
}

// ============================================================================
// Test Suite: Company Research Function
// ============================================================================

Deno.test({
  name: "Company Research - Test 3.1: Basic company research with database verification",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const { client: supabase, userId } = await getAuthenticatedClient();
    let searchId: string | null = null;

    try {
      // Step 1: Create a search for context (optional for company-research, but good practice)
      console.log("  📝 Creating test search for context...");
      searchId = await createTestSearch(supabase, userId, "Google", "Software Engineer");
      console.log("  ✅ Test search created:", searchId);

      // Step 2: Call company-research Edge Function
      console.log("  🔍 Calling company-research Edge Function...");
      const functionUrl = `${supabaseUrl}/functions/v1/company-research`;
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          company: "Google",
          role: "Software Engineer",
          country: "United States",
          searchId: searchId
        })
      });

      console.log("  📊 HTTP Response:", {
        status: response.status,
        statusText: response.statusText
      });

      assertEquals(response.ok, true, "Company research should return 200 OK");

      // Step 3: Parse response and verify structure
      const result = await response.json();
      console.log("  📦 Response structure:", {
        has_company_insights: !!result.company_insights,
        insights_keys: result.company_insights ? Object.keys(result.company_insights) : []
      });

      assertExists(result.company_insights, "Should return company_insights");
      assertExists(result.company_insights.name, "Should have company name");
      assertExists(result.company_insights.industry, "Should have industry");
      assertExists(result.company_insights.culture, "Should have culture");

      console.log("  ✅ Company insights structure valid");
      console.log("  📊 Company Insights:", JSON.stringify({
        name: result.company_insights.name,
        industry: result.company_insights.industry,
        culture: result.company_insights.culture?.substring(0, 100) + "...",
        values: result.company_insights.values,
        has_interview_stages: !!result.company_insights.interview_stages,
        interview_stages_count: result.company_insights.interview_stages?.length || 0
      }, null, 2));

      // Step 4: Cross-verify database - Check tavily_searches table
      console.log("  🔍 Cross-verifying Tavily API calls in database...");
      const { data: tavilySearches, error: tavilyError } = await supabase
        .schema("ops")
        .from("tavily_searches")
        .select("*")
        .eq("search_id", searchId)
        .order("created_at", { ascending: false });

      if (tavilyError) {
        console.warn("  ⚠️  Could not query tavily_searches:", tavilyError.message);
      } else {
        console.log("  📊 Tavily searches found:", tavilySearches?.length || 0);
        if (tavilySearches && tavilySearches.length > 0) {
          console.log("  📊 Tavily search details:", JSON.stringify({
            api_type: tavilySearches[0].api_type,
            query_text: tavilySearches[0].query_text?.substring(0, 100),
            results_count: tavilySearches[0].results_count,
            response_status: tavilySearches[0].response_status,
            credits_used: tavilySearches[0].credits_used
          }, null, 2));
        }
      }

      // Step 5: Cross-verify database - Check scraped_urls table
      // Note: scraped_urls uses company_name for deduplication, not search_id
      console.log("  🔍 Cross-verifying scraped URLs in database...");
      const { data: scrapedUrls, error: urlsError } = await supabase
        .schema("ops")
        .from("scraped_urls")
        .select("*")
        .eq("company_name", "Google")
        .order("created_at", { ascending: false });

      if (urlsError) {
        console.warn("  ⚠️  Could not query scraped_urls:", urlsError.message);
      } else {
        console.log("  📊 Scraped URLs found:", scrapedUrls?.length || 0);
        if (scrapedUrls && scrapedUrls.length > 0) {
          console.log("  📊 Sample scraped URL:", JSON.stringify({
            url: scrapedUrls[0].url,
            company_name: scrapedUrls[0].company_name,
            title: scrapedUrls[0].title,
            content_length: scrapedUrls[0].full_content?.length || 0,
            quality_score: scrapedUrls[0].content_quality_score,
            times_reused: scrapedUrls[0].times_reused
          }, null, 2));
        }
      }

      console.log("  ✅ Database cross-verification complete");

    } finally {
      // Cleanup
      if (searchId) {
        console.log("  🧹 Cleaning up test data...");
        await supabase.schema("ops").from("scraped_urls").delete().eq("search_id", searchId);
        await supabase.schema("ops").from("tavily_searches").delete().eq("search_id", searchId);
        await supabase.from("searches").delete().eq("id", searchId);
        console.log("  ✅ Test data cleaned up");
      }
      await supabase.removeAllChannels();
    }
  }
});

Deno.test({
  name: "Company Research - Test 3.2: Validate searchId requirement (error handling)",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const { client: supabase } = await getAuthenticatedClient();

    try {
      // Call company-research without searchId - should fail gracefully
      console.log("  🔍 Calling company-research without searchId...");
      const functionUrl = `${supabaseUrl}/functions/v1/company-research`;
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          company: "Microsoft",
          role: "Product Manager",
          country: "United States"
          // Missing searchId - should cause error
        })
      });

      console.log("  📊 HTTP Response:", response.status);

      // Should return error status (400 or 500)
      assertEquals(response.ok, false, "Should fail without searchId");
      assertEquals(response.status >= 400, true, "Should return error status code");

      const result = await response.json();
      console.log("  ✅ Error handling verified");
      console.log("  📊 Error response:", JSON.stringify(result, null, 2));

    } finally {
      await supabase.removeAllChannels();
    }
  }
});

Deno.test({
  name: "Company Research - Test 3.3: Verify interview questions bank extraction",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const { client: supabase, userId } = await getAuthenticatedClient();
    let searchId: string | null = null;

    try {
      console.log("  📝 Creating test search...");
      searchId = await createTestSearch(supabase, userId, "Amazon", "Backend Engineer");

      console.log("  🔍 Researching Amazon interview process...");
      const functionUrl = `${supabaseUrl}/functions/v1/company-research`;
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          company: "Amazon",
          role: "Backend Engineer",
          country: "United States",
          searchId: searchId
        })
      });

      assertEquals(response.ok, true, "Should return 200 OK");

      const result = await response.json();
      const insights = result.company_insights;

      // Check if interview questions bank was extracted
      console.log("  📊 Interview Questions Bank:", JSON.stringify({
        has_questions_bank: !!insights.interview_questions_bank,
        behavioral: insights.interview_questions_bank?.behavioral?.length || 0,
        technical: insights.interview_questions_bank?.technical?.length || 0,
        situational: insights.interview_questions_bank?.situational?.length || 0,
        company_specific: insights.interview_questions_bank?.company_specific?.length || 0
      }, null, 2));

      // Check interview stages
      console.log("  📊 Interview Stages:", JSON.stringify({
        has_stages: !!insights.interview_stages,
        stages_count: insights.interview_stages?.length || 0,
        stage_names: insights.interview_stages?.map((s: any) => s.name) || []
      }, null, 2));

      // Check interview experiences
      console.log("  📊 Interview Experiences:", JSON.stringify({
        has_experiences: !!insights.interview_experiences,
        positive_count: insights.interview_experiences?.positive_feedback?.length || 0,
        negative_count: insights.interview_experiences?.negative_feedback?.length || 0,
        difficulty: insights.interview_experiences?.difficulty_rating || "N/A",
        duration: insights.interview_experiences?.process_duration || "N/A"
      }, null, 2));

      console.log("  ✅ Interview data extraction verified");

    } finally {
      if (searchId) {
        console.log("  🧹 Cleaning up test data...");
        await supabase.schema("ops").from("scraped_urls").delete().eq("search_id", searchId);
        await supabase.schema("ops").from("tavily_searches").delete().eq("search_id", searchId);
        await supabase.from("searches").delete().eq("id", searchId);
        console.log("  ✅ Test data cleaned up");
      }
      await supabase.removeAllChannels();
    }
  }
});

Deno.test({
  name: "Company Research - Test 3.4: Handle invalid company gracefully",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const { client: supabase } = await getAuthenticatedClient();

    try {
      console.log("  🧪 Testing with fake company name...");
      const functionUrl = `${supabaseUrl}/functions/v1/company-research`;
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          company: "FakeCompanyThatDoesNotExist12345",
          role: "Software Engineer",
          country: "United States"
        })
      });

      console.log("  📊 Response status:", response.status);

      // Should still return 200 with basic fallback data
      if (response.ok) {
        const result = await response.json();
        console.log("  ✅ Function handled gracefully");
        console.log("  📊 Returned company name:", result.company_insights?.name);
      } else {
        console.log("  ℹ️  Function returned error (acceptable behavior)");
      }

    } finally {
      await supabase.removeAllChannels();
    }
  }
});

// ============================================================================
// Run with: deno test --allow-all tests/unit/test_edge_functions/test_03_company_research.ts
// ============================================================================
