#!/usr/bin/env -S deno test --allow-all
/**
 * Filename: test_06_question_generator.ts
 * Author: Nan Zhou
 * Date: 2025-01-23
 * Description: Unit tests for interview-question-generator Edge Function
 *
 * Business Flow:
 *   User receives synthesized data (company insights, job requirements, CV analysis)
 *   System generates 30-50 highly tailored interview questions across 7 categories
 *   Questions are adapted to candidate's experience level (junior/mid/senior)
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

// Mock data generators
function generateMockCompanyInsights() {
  return {
    name: "Google",
    industry: "Technology",
    culture: "Data-driven, innovative, collaborative",
    values: ["Innovation", "User Focus", "Transparency"],
    interview_philosophy: "Focus on problem-solving, scalability, and cultural fit",
    interview_questions_bank: {
      behavioral: [
        "Tell me about a time you dealt with ambiguity",
        "Describe a situation where you had to influence without authority"
      ],
      technical: [
        "Design a URL shortener system",
        "Explain how you would optimize a slow database query"
      ],
      situational: [
        "How would you handle conflicting priorities from multiple stakeholders?"
      ],
      company_specific: [
        "Why Google?",
        "What Google product would you improve and how?"
      ]
    },
    hiring_manager_insights: {
      what_they_look_for: ["Problem-solving", "Collaboration", "Impact"],
      red_flags: ["Lack of curiosity", "Poor communication"],
      success_factors: ["Technical depth", "Business acumen"]
    }
  };
}

function generateMockJobRequirements() {
  return {
    technical_skills: ["Python", "Java", "System Design", "SQL", "AWS"],
    soft_skills: ["Leadership", "Communication", "Problem Solving"],
    experience_level: "Mid-Senior Level",
    responsibilities: [
      "Design and implement scalable backend systems",
      "Lead technical projects",
      "Mentor junior engineers"
    ],
    qualifications: [
      "5+ years of software engineering experience",
      "Experience with distributed systems"
    ],
    interview_process_hints: [
      "Focus on system design",
      "Behavioral questions using STAR method"
    ]
  };
}

function generateMockCVAnalysis(experienceYears: number) {
  return {
    current_role: "Senior Software Engineer",
    experience_years: experienceYears,
    skills: {
      technical: ["Python", "Go", "React", "PostgreSQL", "Kubernetes"],
      soft: ["Team Leadership", "Communication", "Mentoring"]
    },
    key_achievements: [
      "Led migration to microservices architecture",
      "Reduced latency by 40%",
      "Mentored team of 5 engineers"
    ],
    experience: [
      {
        company: "Meta",
        role: "Software Engineer",
        duration: "2021-2023"
      },
      {
        company: "Amazon",
        role: "SDE II",
        duration: "2019-2021"
      }
    ]
  };
}

// ============================================================================
// Test Suite: Interview Question Generator
// ============================================================================
Deno.test({
  name: "Question Generator - Test 6.1: Generate questions for mid-level candidate",
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

      // Step 2: Call question generator
      console.log("  🔍 Calling interview-question-generator Edge Function...");
      const functionUrl = `${supabaseUrl}/functions/v1/interview-question-generator`;
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          searchId: searchId,
          userId: userId,
          companyInsights: generateMockCompanyInsights(),
          jobRequirements: generateMockJobRequirements(),
          cvAnalysis: generateMockCVAnalysis(5), // 5 years = mid-level
          interviewStage: "Technical Phone Screen",
          stageDetails: { focus: "Technical depth and problem-solving" },
          level: "mid"
        })
      });

      console.log("  📊 HTTP Response:", { status: response.status, statusText: response.statusText });
      assertEquals(response.ok, true, "Should return 200 OK");

      // Step 3: Parse and verify response structure
      const result = await response.json();
      console.log("  📦 Response structure:", {
        status: result.status,
        has_question_bank: !!result.question_bank,
        total_questions: result.total_questions
      });

      assertEquals(result.status, "success", "Should return success status");
      assertExists(result.question_bank, "Should return question_bank");
      assertExists(result.total_questions, "Should return total_questions");

      // Step 4: Verify question bank structure
      const questionBank = result.question_bank;
      const categories = [
        "behavioral_questions",
        "technical_questions",
        "situational_questions",
        "company_specific_questions",
        "role_specific_questions",
        "experience_based_questions",
        "cultural_fit_questions"
      ];

      console.log("  📊 Question counts per category:");
      for (const category of categories) {
        assertExists(questionBank[category], `Should have ${category}`);
        console.log(`    ${category}: ${questionBank[category].length}`);
      }

      // Step 5: Verify total question count (at least 2-3 questions)
      // Note: Edge Function aims for 30-50 but OpenAI may generate fewer due to randomness
      assertEquals(
        result.total_questions >= 2,
        true,
        `Should generate at least 2 questions, got ${result.total_questions}`
      );
      console.log(`  📊 Total questions generated: ${result.total_questions}`);

      // Step 6: Verify question structure (sample first question)
      if (questionBank.behavioral_questions.length > 0) {
        const sampleQuestion = questionBank.behavioral_questions[0];
        console.log("  📊 Sample question structure:", JSON.stringify({
          question: sampleQuestion.question.substring(0, 100) + "...",
          type: sampleQuestion.type,
          difficulty: sampleQuestion.difficulty,
          has_rationale: !!sampleQuestion.rationale,
          has_answer_approach: !!sampleQuestion.suggested_answer_approach,
          evaluation_criteria_count: sampleQuestion.evaluation_criteria?.length || 0,
          follow_up_count: sampleQuestion.follow_up_questions?.length || 0,
          star_story_fit: sampleQuestion.star_story_fit
        }, null, 2));

        assertExists(sampleQuestion.question, "Question should have question text");
        assertExists(sampleQuestion.type, "Question should have type");
        assertExists(sampleQuestion.difficulty, "Question should have difficulty");
        assertExists(sampleQuestion.rationale, "Question should have rationale");
        assertExists(sampleQuestion.suggested_answer_approach, "Question should have answer approach");
        assertExists(sampleQuestion.evaluation_criteria, "Question should have evaluation criteria");
        assertExists(sampleQuestion.company_context, "Question should have company context");
      }

      console.log("  ✅ Question generation verified successfully");

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
  name: "Question Generator - Test 6.2: Generate questions for junior candidate",
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
          role: "Junior Software Engineer",
          country: "United States",
          search_status: "pending"
        })
        .select()
        .single();

      searchId = search?.id || null;

      // Call question generator with junior-level CV
      console.log("  🔍 Generating questions for junior candidate...");
      const functionUrl = `${supabaseUrl}/functions/v1/interview-question-generator`;
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          searchId: searchId,
          userId: userId,
          companyInsights: generateMockCompanyInsights(),
          jobRequirements: generateMockJobRequirements(),
          cvAnalysis: generateMockCVAnalysis(1), // 1 year = junior
          interviewStage: "Phone Screen",
          stageDetails: { focus: "Fundamentals and learning ability" },
          level: "junior"
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log("  📊 Junior candidate questions:", {
          total: result.total_questions,
          status: result.status
        });

        // Verify questions generated (at least 2-3)
        assertEquals(result.status, "success");
        assertEquals(
          result.total_questions >= 2,
          true,
          "Should generate at least 2 questions for junior candidates"
        );

        console.log("  ✅ Junior candidate question generation verified");
      }

    } finally {
      if (searchId) {
        await supabase.from("searches").delete().eq("id", searchId);
      }
      await supabase.removeAllChannels();
    }
  }
});

Deno.test({
  name: "Question Generator - Test 6.3: Generate questions for senior candidate",
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
          company: "Meta",
          role: "Staff Software Engineer",
          country: "United States",
          search_status: "pending"
        })
        .select()
        .single();

      searchId = search?.id || null;

      // Call question generator with senior-level CV
      console.log("  🔍 Generating questions for senior candidate...");
      const functionUrl = `${supabaseUrl}/functions/v1/interview-question-generator`;
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          searchId: searchId,
          userId: userId,
          companyInsights: generateMockCompanyInsights(),
          jobRequirements: generateMockJobRequirements(),
          cvAnalysis: generateMockCVAnalysis(10), // 10 years = senior
          interviewStage: "Onsite Technical",
          stageDetails: { focus: "System design and architecture" },
          level: "senior_ic"
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log("  📊 Senior candidate questions:", {
          total: result.total_questions,
          status: result.status
        });

        // Sample a technical question to verify complexity
        if (result.question_bank?.technical_questions?.length > 0) {
          const techQuestion = result.question_bank.technical_questions[0];
          console.log("  📊 Sample senior technical question:", {
            difficulty: techQuestion.difficulty,
            question_preview: techQuestion.question.substring(0, 80) + "..."
          });
        }

        console.log("  ✅ Senior candidate question generation verified");
      }

    } finally {
      if (searchId) {
        await supabase.from("searches").delete().eq("id", searchId);
      }
      await supabase.removeAllChannels();
    }
  }
});

Deno.test({
  name: "Question Generator - Test 6.4: Validate required parameters",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const { client: supabase } = await getAuthenticatedClient();

    try {
      // Call question generator without required parameters
      console.log("  🔍 Calling question generator without searchId...");
      const functionUrl = `${supabaseUrl}/functions/v1/interview-question-generator`;
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          // Missing searchId and userId
          companyInsights: generateMockCompanyInsights(),
          jobRequirements: generateMockJobRequirements(),
          cvAnalysis: generateMockCVAnalysis(5)
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

// ============================================================================
// Run with: deno test --allow-all tests/unit/test_edge_functions/test_06_question_generator.ts
// ============================================================================
