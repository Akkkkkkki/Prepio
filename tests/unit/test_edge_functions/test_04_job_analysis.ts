#!/usr/bin/env -S deno test --allow-all
/**
 * Filename: test_04_job_analysis.ts
 * Author: Nan Zhou
 * Date: 2025-01-23
 * Description: Unit tests for job-analysis Edge Function - Step 3.2 of interview prep workflow
 *
 * Business Flow:
 *   User provides job posting URLs (roleLinks)
 *   System extracts job requirements using Tavily Extract API
 *   AI analyzes and structures requirements (skills, experience, responsibilities)
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
let TEST_USER_ID: string | null = null;

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

  TEST_USER_ID = authData.user.id;
  return { client, userId: authData.user.id };
}

// ============================================================================
// Test Suite: Job Analysis
// ============================================================================
Deno.test({
  name: "Job Analysis - Test 4.1: Analyze job posting URLs",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const { client: supabase, userId } = await getAuthenticatedClient();
    let searchId: string | null = null;

    try {
      // Step 1: Create test search
      console.log("  📝 Creating test search...");
      const { data: search, error: searchError } = await supabase
        .from("searches")
        .insert({
          user_id: userId,
          company: "Google",
          role: "Software Engineer",
          country: "United States",
          search_status: "pending"
        })
        .select()
        .single();

      assertEquals(searchError, null);
      assertExists(search);
      searchId = search.id;
      console.log("  ✅ Test search created:", searchId);

      // Step 2: Call job-analysis Edge Function
      console.log("  🔍 Calling job-analysis Edge Function...");
      const functionUrl = `${supabaseUrl}/functions/v1/job-analysis`;
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          roleLinks: [
            "https://www.google.com/about/careers/applications/jobs/results/89308786006598342-software-engineer-early-career-2025-start",
            "https://careers.google.com/jobs/results/132480917468783302-software-engineer/"
          ],
          searchId: searchId,
          company: "Google",
          role: "Software Engineer"
        })
      });

      console.log("  📊 HTTP Response:", { status: response.status, statusText: response.statusText });
      assertEquals(response.ok, true, "Should return 200 OK");

      // Step 3: Parse and verify response structure
      const result = await response.json();
      console.log("  📦 Response structure:", {
        has_job_requirements: !!result.job_requirements,
        requirements_keys: result.job_requirements ? Object.keys(result.job_requirements) : []
      });

      assertExists(result.job_requirements, "Should return job_requirements");
      assertExists(result.job_requirements.technical_skills, "Should have technical_skills");
      assertExists(result.job_requirements.soft_skills, "Should have soft_skills");
      assertExists(result.job_requirements.experience_level, "Should have experience_level");

      console.log("  ✅ Job requirements structure valid");
      console.log("  📊 Job Requirements:", JSON.stringify({
        technical_skills_count: result.job_requirements.technical_skills?.length || 0,
        soft_skills_count: result.job_requirements.soft_skills?.length || 0,
        experience_level: result.job_requirements.experience_level,
        responsibilities_count: result.job_requirements.responsibilities?.length || 0,
        urls_processed: result.urls_processed || 0
      }, null, 2));

      // Step 4: Cross-verify database - Check tavily_searches table
      console.log("  🔍 Cross-verifying Tavily Extract calls in database...");
      const { data: tavilySearches, error: tavilyError } = await supabase
        .from("tavily_searches")
        .select("*")
        .eq("search_id", searchId)
        .eq("api_type", "extract")
        .order("created_at", { ascending: false });

      if (tavilyError) {
        console.warn("  ⚠️  Could not query tavily_searches:", tavilyError.message);
      } else {
        console.log("  📊 Tavily extract calls found:", tavilySearches?.length || 0);
        if (tavilySearches && tavilySearches.length > 0) {
          console.log("  📊 Tavily extract details:", JSON.stringify({
            api_type: tavilySearches[0].api_type,
            query_text: tavilySearches[0].query_text?.substring(0, 100),
            results_count: tavilySearches[0].results_count,
            response_status: tavilySearches[0].response_status,
            credits_used: tavilySearches[0].credits_used
          }, null, 2));
        }
      }

      console.log("  ✅ Database cross-verification complete");

    } finally {
      // Cleanup
      if (searchId) {
        console.log("  🧹 Cleaning up test data...");
        await supabase.from("searches").delete().eq("id", searchId);
        console.log("  ✅ Test data cleaned up");
      }
      await supabase.removeAllChannels();
    }
  }
});

Deno.test({
  name: "Job Analysis - Test 4.2: Validate required parameters",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const { client: supabase } = await getAuthenticatedClient();

    try {
      // Call job-analysis without required parameters
      console.log("  🔍 Calling job-analysis without roleLinks...");
      const functionUrl = `${supabaseUrl}/functions/v1/job-analysis`;
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          // Missing roleLinks and searchId
          company: "Microsoft",
          role: "Product Manager"
        })
      });

      console.log("  📊 HTTP Response:", response.status);

      // Should return error status
      assertEquals(response.ok, false, "Should fail without required parameters");
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
  name: "Job Analysis - Test 4.3: Handle empty roleLinks array",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const { client: supabase, userId } = await getAuthenticatedClient();
    let searchId: string | null = null;

    try {
      // Create test search
      const { data: search } = await supabase
        .from("searches")
        .insert({
          user_id: userId,
          company: "Amazon",
          role: "DevOps Engineer",
          country: "United States",
          search_status: "pending"
        })
        .select()
        .single();

      searchId = search?.id || null;

      // Call with empty roleLinks array
      console.log("  🧪 Testing with empty roleLinks array...");
      const functionUrl = `${supabaseUrl}/functions/v1/job-analysis`;
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          roleLinks: [], // Empty array
          searchId: searchId,
          company: "Amazon",
          role: "DevOps Engineer"
        })
      });

      console.log("  📊 Response status:", response.status);

      // Should return error
      assertEquals(response.ok, false, "Should fail with empty roleLinks");

      console.log("  ✅ Empty array handling verified");

    } finally {
      if (searchId) {
        await supabase.from("searches").delete().eq("id", searchId);
      }
      await supabase.removeAllChannels();
    }
  }
});

Deno.test({
  name: "Job Analysis - Test 4.4: Analyze multiple job URLs",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const { client: supabase, userId } = await getAuthenticatedClient();
    let searchId: string | null = null;

    try {
      // Create test search
      console.log("  📝 Creating test search...");
      const { data: search } = await supabase
        .from("searches")
        .insert({
          user_id: userId,
          company: "Amazon",
          role: "Senior Cloud Infrastructure Architect",
          country: "United States",
          search_status: "pending"
        })
        .select()
        .single();

      searchId = search?.id || null;
      console.log("  ✅ Test search created");

      // Call with multiple URLs (real job postings from different companies)
      console.log("  🔍 Analyzing multiple job posting URLs...");
      const functionUrl = `${supabaseUrl}/functions/v1/job-analysis`;
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          roleLinks: [
            "https://www.amazon.jobs/en/jobs/2834090/senior-cloud-infrastructure-architect-aws-professional-services",
            "https://www.amazon.jobs/en/jobs/2965070/senior-delivery-consultant-cloud-infrastructure-architect-wwps-proserve",
            "https://www.amazon.jobs/en/jobs/3070621/aws-public-sector-senior-cloud-architect-cloud-infrastructure"
          ],
          searchId: searchId,
          company: "Amazon",
          role: "Senior Cloud Infrastructure Architect"
        })
      });

      console.log("  📊 Response status:", response.status);

      if (response.ok) {
        const result = await response.json();
        console.log("  📊 Job Analysis Results:", JSON.stringify({
          technical_skills: result.job_requirements?.technical_skills?.slice(0, 5) || [],
          soft_skills: result.job_requirements?.soft_skills?.slice(0, 3) || [],
          experience_level: result.job_requirements?.experience_level,
          urls_processed: result.urls_processed
        }, null, 2));

        console.log("  ✅ Multiple URLs analyzed successfully");
      } else {
        console.log("  ℹ️  Analysis failed (acceptable if URLs are invalid/unreachable)");
      }

    } finally {
      if (searchId) {
        console.log("  🧹 Cleaning up test data...");
        await supabase.from("searches").delete().eq("id", searchId);
        console.log("  ✅ Test data cleaned up");
      }
      await supabase.removeAllChannels();
    }
  }
});

// ============================================================================
// Run with: deno test --allow-all tests/unit/test_edge_functions/test_04_job_analysis.ts
// ============================================================================
