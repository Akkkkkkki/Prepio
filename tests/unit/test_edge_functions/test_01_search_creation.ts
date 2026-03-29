#!/usr/bin/env -S deno test --allow-all
/**
 * Filename: test_01_search_creation.ts
 * Author: Nan Zhou
 * Date: 2025-01-15
 * Description: Unit tests for search creation - Step 1 of interview prep workflow
 *
 * Business Flow:
 *   User creates a new search with company/role/country
 *   System creates search record with 'pending' status
 *   If CV provided, creates resume record linked to search
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
// Test Data Generators
// ============================================================================
function generateSearchData(overrides = {}) {
  return {
    user_id: TEST_USER_ID,
    company: "Google",
    role: "Software Engineer",
    country: "United States",
    search_status: "pending",
    ...overrides
  };
}

function generateResumeData(searchId: string, overrides = {}) {
  return {
    user_id: TEST_USER_ID,
    search_id: searchId,
    content: `John Doe
Senior Software Engineer
5 years experience in full-stack development
Skills: React, TypeScript, Node.js, PostgreSQL
Education: BS Computer Science, Stanford University`,
    parsed_data: null,
    ...overrides
  };
}

// ============================================================================
// Test Suite: Search Creation
// ============================================================================
Deno.test({
  name: "Search Creation - Test 1.1: Create basic search without CV",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const { client: supabase, userId } = await getAuthenticatedClient();
    let searchId: string | null = null;

    try {
      // Step 1: Create search record
      const searchData = generateSearchData({ user_id: userId });
      const { data: search, error: searchError } = await supabase
        .from("searches")
        .insert(searchData)
        .select()
        .single();

      assertEquals(searchError, null, "Search creation should not have errors");
      assertExists(search, "Search record should be created");
      searchId = search.id;

      // Step 2: Cross-verify with direct database read
      console.log("  🔍 Cross-verifying with database...");
      const { data: dbSearch, error: fetchError } = await supabase
        .from("searches")
        .select("*")
        .eq("id", searchId)
        .single();

      assertEquals(fetchError, null, "Should be able to fetch created search from DB");
      assertExists(dbSearch, "Search should exist in database");

      // Step 3: Verify database data
      assertEquals(dbSearch.id, search.id, "DB ID should match");
      assertEquals(dbSearch.company, "Google", "DB company should match");
      assertEquals(dbSearch.role, "Software Engineer", "DB role should match");
      assertEquals(dbSearch.search_status, "pending", "DB status should be pending");
      assertEquals(dbSearch.user_id, userId, "DB user_id should match");
      assertExists(dbSearch.created_at, "DB should have created_at timestamp");

      console.log("  ✅ Database cross-verification passed");
      console.log("  📊 Database stored:", JSON.stringify({
        id: dbSearch.id,
        company: dbSearch.company,
        role: dbSearch.role,
        status: dbSearch.search_status,
        created_at: dbSearch.created_at
      }, null, 2));

    } finally {
      // Cleanup: Delete test data
      if (searchId) {
        console.log("  🧹 Cleaning up test data...");
        const { error: deleteError } = await supabase
          .from("searches")
          .delete()
          .eq("id", searchId);

        if (deleteError) {
          console.error("  ⚠️  Cleanup failed:", deleteError);
        } else {
          // Verify deletion
          const { data: verifyDelete } = await supabase
            .from("searches")
            .select("id")
            .eq("id", searchId)
            .single();

          if (!verifyDelete) {
            console.log("  ✅ Test data cleaned up");
          }
        }
      }
      await supabase.removeAllChannels();
    }
  }
});

Deno.test({
  name: "Search Creation - Test 1.2: Create search with CV upload",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const { client: supabase, userId } = await getAuthenticatedClient();
    let searchId: string | null = null;

    try {
      // Step 1: Create search record
      const searchData = generateSearchData({ user_id: userId, company: "Meta", role: "Frontend Engineer" });
      const { data: search, error: searchError } = await supabase
        .from("searches")
        .insert(searchData)
        .select()
        .single();

      assertEquals(searchError, null, "Search creation should not have errors");
      assertExists(search, "Search record should be created");
      searchId = search.id;

      // Step 2: Upload resume linked to search
      const resumeData = generateResumeData(search.id, { user_id: userId });
      const { data: resume, error: resumeError } = await supabase
        .from("resumes")
        .insert(resumeData)
        .select()
        .single();

      assertEquals(resumeError, null, "Resume creation should not have errors");
      assertExists(resume, "Resume record should be created");

      // Step 3: Cross-verify Search from database
      console.log("  🔍 Reading Search from database...");
      const { data: dbSearch, error: fetchSearchError } = await supabase
        .from("searches")
        .select("*")
        .eq("id", searchId)
        .single();

      assertEquals(fetchSearchError, null, "Should fetch search from DB");
      assertExists(dbSearch, "Search should exist in DB");
      assertEquals(dbSearch.company, "Meta", "DB company should be Meta");
      assertEquals(dbSearch.role, "Frontend Engineer", "DB role should match");

      // Step 4: Cross-verify Resume from database
      console.log("  🔍 Reading Resume from database...");
      const { data: dbResume, error: fetchResumeError } = await supabase
        .from("resumes")
        .select("*")
        .eq("id", resume.id)
        .single();

      assertEquals(fetchResumeError, null, "Should fetch resume from DB");
      assertExists(dbResume, "Resume should exist in DB");
      assertEquals(dbResume.search_id, searchId, "DB resume should link to search");
      assertEquals(dbResume.user_id, userId, "DB resume user_id should match");
      assertEquals(dbResume.content.includes("John Doe"), true, "DB resume should contain name");

      console.log("  ✅ Database cross-verification passed");
      console.log("  📊 Database stored:", JSON.stringify({
        search: { id: dbSearch.id, company: dbSearch.company, role: dbSearch.role },
        resume: { id: dbResume.id, search_id: dbResume.search_id, has_content: !!dbResume.content }
      }, null, 2));

    } finally {
      // Cleanup: Deleting search will cascade delete resume
      if (searchId) {
        console.log("  🧹 Cleaning up test data (search + resume)...");
        const { error: deleteError } = await supabase
          .from("searches")
          .delete()
          .eq("id", searchId);

        if (!deleteError) {
          console.log("  ✅ Test data cleaned up");
        }
      }
      await supabase.removeAllChannels();
    }
  }
});

Deno.test({
  name: "Search Creation - Test 1.3: Multiple searches for same company (same user)",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const { client: supabase, userId } = await getAuthenticatedClient();
    const searchIds: string[] = [];

    try {
      // Create search 1
      const search1Data = generateSearchData({ user_id: userId, company: "Amazon" });
      const { data: search1, error: error1 } = await supabase
        .from("searches")
        .insert(search1Data)
        .select()
        .single();

      assertEquals(error1, null);
      assertExists(search1);
      searchIds.push(search1.id);

      // Create search 2
      const search2Data = generateSearchData({ user_id: userId, company: "Amazon", role: "Backend Engineer" });
      const { data: search2, error: error2 } = await supabase
        .from("searches")
        .insert(search2Data)
        .select()
        .single();

      assertEquals(error2, null);
      assertExists(search2);
      searchIds.push(search2.id);

      // Cross-verify both records from database
      console.log("  🔍 Reading 2 Amazon search records from database...");
      const { data: dbSearches, error: fetchError } = await supabase
        .from("searches")
        .select("*")
        .in("id", searchIds)
        .order("created_at", { ascending: true });

      assertEquals(fetchError, null, "Should fetch searches from DB");
      assertEquals(dbSearches?.length, 2, "Should have 2 searches in DB");

      const [db1, db2] = dbSearches!;
      assertEquals(db1.company, "Amazon", "First search company should be Amazon");
      assertEquals(db2.company, "Amazon", "Second search company should be Amazon");
      assertEquals(db1.role, "Software Engineer", "First search role should match");
      assertEquals(db2.role, "Backend Engineer", "Second search role should match");
      assertEquals(db1.user_id, db2.user_id, "Both searches should have same user_id");

      console.log("  ✅ Database cross-verification passed - 2 independent records");
      console.log("  📊 Database stored:", JSON.stringify(dbSearches?.map(s => ({
        id: s.id,
        company: s.company,
        role: s.role
      })) || [], null, 2));

    } finally {
      // Cleanup
      if (searchIds.length > 0) {
        console.log(`  🧹 Cleaning up ${searchIds.length} test records...`);
        const { error: deleteError } = await supabase
          .from("searches")
          .delete()
          .in("id", searchIds);

        if (!deleteError) {
          console.log("  ✅ Test data cleaned up");
        }
      }
      await supabase.removeAllChannels();
    }
  }
});

Deno.test({
  name: "Search Creation - Test 1.4: Validate required fields",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const { client: supabase, userId } = await getAuthenticatedClient();

    try {
      // Try to create search without company (should fail)
      const invalidData = {
        user_id: userId,
        role: "Engineer",
        search_status: "pending"
        // Missing 'company' field
      };

      const { data, error } = await supabase
        .from("searches")
        .insert(invalidData)
        .select()
        .single();

      // Should have error
      assertExists(error, "Should have validation error for missing company");
      assertEquals(data, null, "No data should be returned on error");

      // Verify database did not create invalid record
      console.log("  🔍 Verifying no invalid record in database...");
      const { data: dbSearches } = await supabase
        .from("searches")
        .select("id")
        .eq("user_id", userId)
        .eq("role", "Engineer")
        .is("company", null);

      assertEquals(dbSearches?.length || 0, 0, "DB should not contain invalid record");

      console.log("  ✅ Validation passed - Database correctly rejected invalid data");

    } finally {
      await supabase.removeAllChannels();
    }
  }
});

Deno.test({
  name: "Search Creation - Test 1.5: Search status enumeration",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const { client: supabase, userId } = await getAuthenticatedClient();
    const searchIds: string[] = [];

    try {
      const validStatuses = ["pending", "processing", "completed", "failed"];

      for (const status of validStatuses) {
        const searchData = generateSearchData({
          user_id: userId,
          search_status: status,
          company: `TestCorp-${status}`
        });

        const { data: search, error } = await supabase
          .from("searches")
          .insert(searchData)
          .select()
          .single();

        assertEquals(error, null, `Status '${status}' should be valid`);
        assertExists(search);
        searchIds.push(search.id);
      }

      // Cross-verify all status records from database
      console.log("  🔍 Reading all status records from database...");
      const { data: dbSearches, error: fetchError } = await supabase
        .from("searches")
        .select("search_status, company")
        .in("id", searchIds)
        .order("company", { ascending: true });

      assertEquals(fetchError, null, "Should fetch all searches from DB");
      assertEquals(dbSearches?.length, 4, "Should have 4 searches in DB");

      // Verify each status
      if (dbSearches) {
        const statusMap = new Map(dbSearches.map(s => [s.company.split('-')[1], s.search_status]));
        validStatuses.forEach(status => {
          assertEquals(statusMap.get(status), status, `DB should have ${status} status`);
        });

        console.log("  ✅ Database cross-verification passed - All statuses correctly stored");
        console.log("  📊 Database stored:", JSON.stringify(dbSearches, null, 2));
      }

    } finally {
      // Cleanup
      if (searchIds.length > 0) {
        console.log(`  🧹 Cleaning up ${searchIds.length} test records...`);
        const { error: deleteError } = await supabase
          .from("searches")
          .delete()
          .in("id", searchIds);

        if (!deleteError) {
          console.log("  ✅ Test data cleaned up");
        }
      }
      await supabase.removeAllChannels();
    }
  }
});

// ============================================================================
// Run with: deno test --allow-all tests/unit/test_edge_functions/test_01_search_creation.ts
// ============================================================================
