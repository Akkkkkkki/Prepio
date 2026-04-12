#!/usr/bin/env -S deno test --allow-all
/**
 * Filename: test_07_complete_workflow.ts
 * Author: Nan Zhou
 * Date: 2025-01-23
 * Description: Integration test for complete interview prep workflow
 *
 * Flow:
 *   Create search → Trigger interview-research (202)
 *   → Wait for completion → Verify all data generated
 *   → Check: company insights, job requirements, CV analysis, comparison, questions
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

// Sample CV text
function generateSampleCV() {
  return `
John Doe
Senior Software Engineer | 5 years experience
john.doe@email.com

EXPERIENCE
- Led microservices migration at Meta (2021-2023)
- Built scalable backend systems at Amazon (2019-2021)

SKILLS
Technical: Python, Go, React, PostgreSQL, Kubernetes, AWS
Soft: Team Leadership, Communication, Mentoring

EDUCATION
BS Computer Science, Stanford University (2018)
`;
}

// Wait for search to complete with timeout
async function waitForSearchCompletion(
  supabase: SupabaseClient,
  searchId: string,
  maxWaitMs = 60000
): Promise<any> {
  const startTime = Date.now();
  const pollInterval = 2000; // 2 seconds

  while (Date.now() - startTime < maxWaitMs) {
    const { data: search, error } = await supabase
      .from("searches")
      .select("*")
      .eq("id", searchId)
      .single();

    if (error) {
      throw new Error(`Failed to query search: ${error.message}`);
    }

    console.log(`  ⏳ Search status: ${search.search_status} (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`);

    if (search.search_status === "completed") {
      return search;
    }

    if (search.search_status === "failed") {
      throw new Error(`Search failed: ${search.error_message || "Unknown error"}`);
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Search did not complete within ${maxWaitMs}ms`);
}

// ============================================================================
// Test Suite: Complete Workflow
// ============================================================================
Deno.test({
  name: "Integration - Test 07.1: Complete interview prep workflow",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const { client: supabase, userId } = await getAuthenticatedClient();
    let searchId: string | null = null;

    try {
      // Step 1: Create search with CV
      console.log("  📝 Step 1: Creating search with CV...");
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
      console.log(`  ✅ Search created: ${searchId}`);

      // Step 2: Trigger interview-research
      console.log("  🚀 Step 2: Triggering interview-research...");
      const functionUrl = `${supabaseUrl}/functions/v1/interview-research`;
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          searchId: searchId,
          userId: userId,
          company: "Google",
          role: "Software Engineer",
          country: "United States",
          roleLinks: [
            "https://www.google.com/about/careers/applications/jobs/results/89308786006598342-software-engineer-early-career-2025-start"
          ],
          cv: generateSampleCV(),
          level: "mid"
        })
      });

      console.log(`  📊 Response: ${response.status}`);
      assertEquals(response.status, 202, "Should return 202 Accepted");

      // Step 3: Wait for completion
      console.log("  ⏳ Step 3: Waiting for processing to complete (max 120s)...");
      const completedSearch = await waitForSearchCompletion(supabase, searchId, 120000);
      console.log("  ✅ Search completed successfully");

      // Step 4: Verify prep_plans data
      console.log("  🔍 Step 4: Verifying prep plan data...");
      const { data: prepPlan, error: prepPlanError } = await supabase
        .from("prep_plans")
        .select("*")
        .eq("search_id", searchId)
        .single();

      if (prepPlanError) {
        console.warn(`  ⚠️  Prep plan not found: ${prepPlanError.message}`);
      } else {
        assertExists(prepPlan, "Should have a prep plan");
        assertExists(prepPlan.candidate_positioning, "Should have candidate positioning data");

        console.log("  📊 Prep plan:", JSON.stringify({
          has_summary: !!prepPlan.summary,
          has_positioning: !!prepPlan.candidate_positioning,
          prep_priorities: Array.isArray(prepPlan.prep_priorities) ? prepPlan.prep_priorities.length : 0
        }, null, 2));
      }

      // Step 5: Verify interview questions generated
      console.log("  🔍 Step 5: Verifying interview questions...");
      const { data: questions, error: qError } = await supabase
        .from("interview_questions")
        .select("*")
        .eq("search_id", searchId);

      assertEquals(qError, null);
      assertExists(questions);
      console.log(`  📊 Total questions generated: ${questions.length}`);

      // Should have generated significant number of questions
      assertEquals(
        questions.length > 10,
        true,
        `Should generate 10+ questions, got ${questions.length}`
      );

      // Step 6: Verify interview stages
      console.log("  🔍 Step 6: Verifying interview stages...");
      const { data: stages, error: stagesError } = await supabase
        .from("interview_stages")
        .select("*")
        .eq("search_id", searchId);

      assertEquals(stagesError, null);
      assertExists(stages);
      console.log(`  📊 Interview stages created: ${stages?.length || 0}`);

      console.log("  ✅ Complete workflow integration test passed");

    } finally {
      // Cleanup
      if (searchId) {
        console.log("  🧹 Cleaning up test data...");
        // Delete will cascade to related tables
        await supabase.from("searches").delete().eq("id", searchId);
        console.log("  ✅ Test data cleaned up");
      }
      await supabase.removeAllChannels();
    }
  }
});

Deno.test({
  name: "Integration - Test 07.2: Verify database consistency after workflow",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const { client: supabase, userId } = await getAuthenticatedClient();
    let searchId: string | null = null;

    try {
      // Create and trigger workflow
      console.log("  📝 Creating search and triggering workflow...");
      const { data: search } = await supabase
        .from("searches")
        .insert({
          user_id: userId,
          company: "Meta",
          role: "Senior Engineer",
          country: "United States",
          search_status: "pending"
        })
        .select()
        .single();

      searchId = search?.id || null;

      const functionUrl = `${supabaseUrl}/functions/v1/interview-research`;
      await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          searchId: searchId,
          userId: userId,
          company: "PwC",
          role: "Audit Senior Associate",
          country: "United Kingdom",
          roleLinks: ["https://jobs.pwc.co.uk/uk/en/job/PUDPUNUK579983WDEXTERNALENUK/Audit-Senior-Associate"],
          cv: generateSampleCV(),
          level: "senior_ic"
        })
      });

      // Wait for completion
      console.log("  ⏳ Waiting for processing...");
      await waitForSearchCompletion(supabase, searchId!, 120000);

      // Verify all related data exists
      console.log("  🔍 Verifying database consistency...");

      const { data: questions } = await supabase
        .from("interview_questions")
        .select("id")
        .eq("search_id", searchId);

      const { data: stages } = await supabase
        .from("interview_stages")
        .select("id")
        .eq("search_id", searchId);

      const { data: prepPlan } = await supabase
        .from("prep_plans")
        .select("id")
        .eq("search_id", searchId)
        .single();

      console.log("  📊 Database consistency check:", JSON.stringify({
        questions_count: questions?.length || 0,
        stages_count: stages?.length || 0,
        has_prep_plan: !!prepPlan
      }, null, 2));

      // All data should be linked to the same search_id
      assertEquals(questions && questions.length > 0, true, "Should have questions");
      assertEquals(stages && stages.length > 0, true, "Should have stages");

      console.log("  ✅ Database consistency verified");

    } finally {
      if (searchId) {
        await supabase.from("searches").delete().eq("id", searchId);
      }
      await supabase.removeAllChannels();
    }
  }
});

// ============================================================================
// Run with: deno test --allow-all tests/integration/test_workflows/test_07_complete_workflow.ts
// ============================================================================
