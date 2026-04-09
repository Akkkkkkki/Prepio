import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.2";
import { SearchLogger } from "../_shared/logger.ts";
import { RESEARCH_CONFIG, getOpenAIModel, getMaxTokens } from "../_shared/config.ts";
import { ProgressTracker, PROGRESS_STEPS, CONCURRENT_TIMEOUTS, executeWithTimeout } from "../_shared/progress-tracker.ts";
import { authorizeRequest, type AuthorizedRequestContext } from "../_shared/auth.ts";
import { parseJsonResponse } from "../_shared/openai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Types ────────────────────────────────────────────────────

type Level = 'junior' | 'mid' | 'senior_ic' | 'people_manager' | 'unknown';
type Confidence = 'high' | 'medium' | 'low';
type Priority = 'high' | 'medium' | 'low';

interface InterviewResearchRequest {
  company: string;
  role?: string;
  country?: string;
  roleLinks?: string[];
  cv?: string;
  level?: Level;
  userNote?: string;
  jobDescription?: string;
  // Legacy field — mapped to level internally
  targetSeniority?: 'junior' | 'mid' | 'senior';
  userId: string;
  searchId: string;
}

interface RawResearchData {
  company_research_raw?: any;
  job_analysis_raw?: any;
  cv_analysis_raw?: any;
}

interface PrepPlanOutput {
  summary: {
    company: string;
    roleName: string | null;
    industryFocus: string;
    level: string;
    overallConfidence: Confidence;
    weakSignalCase: boolean;
  };
  assessmentSignals: Array<{ name: string; importance: Priority; rationale: string }>;
  stageRoadmap: Array<{
    stageName: string;
    orderIndex: number;
    confidence: Confidence;
    whatItTests: string[];
    whyLikely: string;
    prepPriority: Priority;
    questionThemes: string[];
    prepActions: string[];
    lowConfidenceGuidance: string | null;
  }>;
  prepPriorities: Array<{
    label: string;
    priority: Priority;
    whyItMatters: string;
    recommendedActions: string[];
  }>;
  candidatePositioning: {
    strengthsToLeanOn: string[];
    weakSpotsToAddress: string[];
    storyCoverageGaps: string[];
    mismatchRisks: string[];
  };
  practiceSequence: Array<{
    orderIndex: number;
    title: string;
    objective: string;
    linkedStageNames: string[];
    linkedPriorityLabels: string[];
  }>;
  questionPlan: {
    coreMustPractice: QuestionItem[];
    likelyFollowUps: QuestionItem[];
    extraDepth: QuestionItem[];
  };
  internalEvidenceLog: Array<{
    id: string;
    sourceType: string;
    sourceLabel: string;
    excerpt: string;
    url: string | null;
    relevance: Priority;
    trustWeight: Priority;
    contradictionGroup: string | null;
  }>;
}

interface QuestionItem {
  question: string;
  stageName: string | null;
  linkedPriority: string;
  reason: string;
  answerGuidanceStatus: 'pending' | 'generated';
}

// ── Helpers ──────────────────────────────────────────────────

function resolveLevel(req: InterviewResearchRequest): Level {
  if (req.level) return req.level;
  if (req.targetSeniority === 'senior') return 'senior_ic';
  if (req.targetSeniority) return req.targetSeniority as Level;
  return 'unknown';
}

async function withDbTimeout<T>(
  operation: () => Promise<T>,
  label: string,
  timeoutMs = 30000,
): Promise<T | null> {
  try {
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error(`Database timeout: ${label}`)), timeoutMs)
    );
    return await Promise.race([operation(), timeoutPromise as Promise<T>]);
  } catch (error) {
    console.error(`❌ DB operation failed (${label}):`, error);
    throw error;
  }
}

// ── Resume lookup (unchanged from v1) ────────────────────────

async function fetchStoredResumeContent(supabase: any, userId: string, searchId?: string) {
  try {
    const columns = 'id, content, created_at';
    if (searchId) {
      const { data, error } = await supabase
        .from('resumes')
        .select(columns)
        .eq('search_id', searchId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (!error && data?.length) return data[0];
    }
    const { data, error } = await supabase
      .from('resumes')
      .select(columns)
      .eq('user_id', userId)
      .is('search_id', null)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error || !data?.length) return null;
    return data[0];
  } catch {
    return null;
  }
}

async function ensureResumeSnapshotForSearch(
  supabase: any,
  searchId: string,
  userId: string,
  content: string,
) {
  try {
    const { data: existing } = await supabase
      .from('resumes')
      .select('id')
      .eq('search_id', searchId)
      .limit(1);
    if (existing?.length) return existing[0].id;
    const { data } = await supabase
      .from('resumes')
      .insert({ user_id: userId, search_id: searchId, content, parsed_data: null, source: 'search_snapshot' })
      .select('id')
      .single();
    return data?.id ?? null;
  } catch {
    return null;
  }
}

// ── PHASE 1: Concurrent Data Gathering ──────────────────────

async function gatherCompanyData(company: string, role?: string, country?: string, searchId?: string) {
  try {
    console.log("📊 Gathering company research data...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONCURRENT_TIMEOUTS.companyResearch);
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/company-research`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ company, role, country, searchId }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (response.ok) {
      const result = await response.json();
      console.log("✅ Company research complete");
      return result.company_insights || null;
    }
    console.warn(`⚠️ Company research failed with status ${response.status}`);
    return null;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`⏱️ Company research timed out`);
    } else {
      console.error("❌ Company research error:", error);
    }
    return null;
  }
}

async function gatherJobData(roleLinks: string[], searchId: string, company?: string, role?: string) {
  if (!roleLinks?.length) {
    console.log("⏭️ No role links provided, skipping job analysis");
    return null;
  }
  try {
    console.log("📋 Gathering job analysis data...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONCURRENT_TIMEOUTS.jobAnalysis);
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/job-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ roleLinks, searchId, company, role }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (response.ok) {
      const result = await response.json();
      console.log("✅ Job analysis complete");
      return result.job_requirements || null;
    }
    console.warn(`⚠️ Job analysis failed with status ${response.status}`);
    return null;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`⏱️ Job analysis timed out`);
    } else {
      console.error("❌ Job analysis error:", error);
    }
    return null;
  }
}

async function gatherCVData(cv: string, userId: string) {
  if (!cv) {
    console.log("⏭️ No CV provided, skipping CV analysis");
    return null;
  }
  try {
    console.log("📄 Gathering CV analysis data...");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONCURRENT_TIMEOUTS.cvAnalysis);
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/cv-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ cvText: cv, userId }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (response.ok) {
      const result = await response.json();
      console.log("✅ CV analysis complete");
      return result;
    }
    console.warn(`⚠️ CV analysis failed with status ${response.status}`);
    return null;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`⏱️ CV analysis timed out`);
    } else {
      console.error("❌ CV analysis error:", error);
    }
    return null;
  }
}

// ── PHASE 2: Assessment-first PrepPlan synthesis ─────────────

function getPrepPlanSystemPrompt(): string {
  return `You are an expert interview preparation strategist who helps candidates build high-ROI preparation plans.

Your job is to analyze all available evidence about an employer, role, and candidate, then produce a structured PrepPlan that tells the candidate:
- What this employer is most likely assessing
- What the likely interview stages are (with confidence levels)
- What to prepare first, what to deprioritize
- How their background maps to the assessment criteria
- A concrete practice sequence with tiered questions

ASSESSMENT DIMENSIONS — always model these six:
1. Communication
2. Role-specific hard skill
3. Problem solving / judgment
4. Execution quality
5. Collaboration
6. Motivation / narrative

Also include when supported by evidence:
- Values / principles alignment
- Leadership / influence
- Product sense
- Domain depth
- Case structuring
- Analytical reasoning
- Speed / pressure handling

EVIDENCE POLICY:
- Official employer pages and official job postings are highest trust.
- User-provided notes and CV are first-class evidence.
- Public interview reports inform the plan but do not override stronger evidence alone.
- Company-specific principles are only mentioned when backed by official material + reinforced by interviewee evidence.
- Always produce ONE primary recommendation. Never push conflict resolution to the user.

STAGE INFERENCE:
- ALWAYS produce a stage roadmap, even in weak-signal cases.
- Mark each stage with confidence: high, medium, or low.
- In low-confidence cases, set weakSignalCase: true and add lowConfidenceGuidance to stages.

QUESTION GENERATION — MINIMUM 40 QUESTIONS TOTAL:
- Generate questions in three tiers: coreMustPractice, likelyFollowUps, extraDepth.
- MANDATORY MINIMUMS: coreMustPractice ≥ 15, likelyFollowUps ≥ 15, extraDepth ≥ 10. Total ≥ 40.
- If evidence is rich, scale UP (50-70 questions). Never scale below 40.
- A candidate cannot be fully prepared with only a handful of questions. Cover every stage, every assessment dimension, and every weak spot.
- Weight questions using stage hypotheses, prep priorities, and candidate weak spots.
- Questions must feel downstream of the research, not generic.
- Set answerGuidanceStatus to "pending" for all questions.

INDUSTRY SUPPORT: Optimize for tech, consulting, and finance. Do not assume software engineering everywhere.

Return ONLY valid JSON matching the exact schema specified. No markdown, no extra text.`;
}

function buildPrepPlanPrompt(
  company: string,
  role: string | undefined,
  country: string | undefined,
  level: Level,
  userNote: string | undefined,
  jobDescription: string | undefined,
  companyInsights: any,
  jobRequirements: any,
  cvAnalysis: any,
): string {
  let prompt = `Build a PrepPlan for:\n`;
  prompt += `Company: ${company}\n`;
  if (role) prompt += `Role: ${role}\n`;
  if (country) prompt += `Country: ${country}\n`;
  prompt += `Level: ${level}\n\n`;

  // ── User note (first-class evidence) ──
  if (userNote) {
    prompt += `=== USER NOTE (first-class evidence — may include known stages, interviewers, format, deadlines) ===\n`;
    prompt += `${userNote}\n\n`;
  }

  // ── Job description / links analysis ──
  if (jobDescription) {
    prompt += `=== JOB DESCRIPTION (pasted by user) ===\n`;
    prompt += `${jobDescription}\n\n`;
  }

  // ── Company research ──
  if (companyInsights) {
    prompt += `=== COMPANY RESEARCH ===\n`;
    prompt += `Industry: ${companyInsights.industry || 'Unknown'}\n`;
    prompt += `Culture: ${companyInsights.culture || 'Unknown'}\n`;
    prompt += `Values: ${companyInsights.values?.join(', ') || 'Unknown'}\n`;
    prompt += `Interview Philosophy: ${companyInsights.interview_philosophy || 'Unknown'}\n`;
    prompt += `Recent Hiring Trends: ${companyInsights.recent_hiring_trends || 'Unknown'}\n\n`;

    if (companyInsights.interview_stages?.length > 0) {
      prompt += `INTERVIEW PROCESS (from candidate reports):\n`;
      companyInsights.interview_stages.forEach((stage: any) => {
        prompt += `  Stage ${stage.order_index}: ${stage.name}`;
        if (stage.duration) prompt += ` (${stage.duration})`;
        if (stage.content) prompt += ` — ${stage.content}`;
        prompt += `\n`;
        if (stage.common_questions?.length > 0) {
          stage.common_questions.forEach((q: string) => {
            prompt += `    Q: "${q}"\n`;
          });
        }
      });
      prompt += `\n`;
    }

    if (companyInsights.interview_questions_bank) {
      prompt += `REAL INTERVIEW QUESTIONS FROM CANDIDATE REPORTS:\n`;
      const qBank = companyInsights.interview_questions_bank;
      for (const [category, questions] of Object.entries(qBank)) {
        if (Array.isArray(questions) && questions.length > 0) {
          prompt += `  ${category} (${questions.length}):\n`;
          (questions as string[]).forEach((q, i) => {
            prompt += `    ${i + 1}. "${q}"\n`;
          });
        }
      }
      prompt += `\n`;
    }

    if (companyInsights.interview_experiences) {
      const exp = companyInsights.interview_experiences;
      prompt += `INTERVIEW EXPERIENCES:\n`;
      if (exp.difficulty_rating) prompt += `  Difficulty: ${exp.difficulty_rating}\n`;
      if (exp.process_duration) prompt += `  Duration: ${exp.process_duration}\n`;
      if (exp.common_themes?.length) prompt += `  Themes: ${exp.common_themes.join(', ')}\n`;
      prompt += `\n`;
    }
  }

  // ── Job requirements (from link analysis) ──
  if (jobRequirements) {
    prompt += `=== JOB REQUIREMENTS (from link analysis) ===\n`;
    if (jobRequirements.technical_skills?.length)
      prompt += `Technical: ${jobRequirements.technical_skills.join(', ')}\n`;
    if (jobRequirements.soft_skills?.length)
      prompt += `Soft: ${jobRequirements.soft_skills.join(', ')}\n`;
    if (jobRequirements.responsibilities?.length) {
      prompt += `Responsibilities:\n`;
      jobRequirements.responsibilities.forEach((r: string) => { prompt += `  - ${r}\n`; });
    }
    if (jobRequirements.qualifications?.length) {
      prompt += `Qualifications:\n`;
      jobRequirements.qualifications.forEach((q: string) => { prompt += `  - ${q}\n`; });
    }
    if (jobRequirements.interview_process_hints?.length) {
      prompt += `Process hints: ${jobRequirements.interview_process_hints.join('; ')}\n`;
    }
    prompt += `\n`;
  }

  // ── CV evidence ──
  if (cvAnalysis) {
    const a = cvAnalysis.aiAnalysis || cvAnalysis;
    prompt += `=== CANDIDATE CV ===\n`;
    if (a.current_role) prompt += `Current role: ${a.current_role}\n`;
    if (a.experience_years) prompt += `Experience: ${a.experience_years} years\n`;
    if (a.experience?.length) {
      prompt += `Work history:\n`;
      a.experience.forEach((exp: any, i: number) => {
        prompt += `  ${i + 1}. ${exp.role} at ${exp.company}`;
        if (exp.duration) prompt += ` (${exp.duration})`;
        prompt += `\n`;
        if (exp.achievements?.length) {
          exp.achievements.slice(0, 3).forEach((ach: string) => {
            prompt += `     - ${ach}\n`;
          });
        }
      });
    }
    const skills = a.skills;
    if (skills) {
      const techSkills: string[] = skills.categories
        ? skills.categories.flatMap((c: { skills: string[] }) => c.skills)
        : (skills.technical || []);
      if (techSkills.length) prompt += `Technical skills: ${techSkills.join(', ')}\n`;
      if (skills.soft?.length) prompt += `Soft skills: ${skills.soft.join(', ')}\n`;
    }
    if (a.education) {
      prompt += `Education: ${a.education.degree || ''} at ${a.education.institution || ''}\n`;
    }
    prompt += `\n`;
  }

  // ── Output schema ──
  prompt += `=== OUTPUT ===\n`;
  prompt += `Return a JSON object with this exact structure:\n`;
  prompt += JSON.stringify(getPrepPlanSchema(), null, 2);
  prompt += `\n`;

  return prompt;
}

function getPrepPlanSchema(): any {
  return {
    summary: {
      company: "string",
      roleName: "string | null",
      industryFocus: "tech | consulting | finance | unknown",
      level: "junior | mid | senior_ic | people_manager | unknown",
      overallConfidence: "high | medium | low",
      weakSignalCase: false,
    },
    assessmentSignals: [
      { name: "e.g. Problem Solving", importance: "high | medium | low", rationale: "Why this matters for this role" },
    ],
    stageRoadmap: [
      {
        stageName: "e.g. Phone Screen",
        orderIndex: 1,
        confidence: "high | medium | low",
        whatItTests: ["communication", "motivation"],
        whyLikely: "Reason this stage likely exists",
        prepPriority: "high | medium | low",
        questionThemes: ["theme1", "theme2"],
        prepActions: ["action1", "action2"],
        lowConfidenceGuidance: "null or guidance text when confidence is low",
      },
    ],
    prepPriorities: [
      {
        label: "e.g. System Design Depth",
        priority: "high | medium | low",
        whyItMatters: "Reason",
        recommendedActions: ["action1"],
      },
    ],
    candidatePositioning: {
      strengthsToLeanOn: ["strength1"],
      weakSpotsToAddress: ["weakness1"],
      storyCoverageGaps: ["gap1"],
      mismatchRisks: ["risk1"],
    },
    practiceSequence: [
      {
        orderIndex: 1,
        title: "Step title",
        objective: "What this step achieves",
        linkedStageNames: ["Phone Screen"],
        linkedPriorityLabels: ["System Design Depth"],
      },
    ],
    questionPlan: {
      coreMustPractice: [
        { question: "Core question 1 — tailored to stage and candidate", stageName: "Phone Screen", linkedPriority: "high", reason: "Why this matters", answerGuidanceStatus: "pending" },
        { question: "Core question 2 — different dimension", stageName: "Technical Round", linkedPriority: "high", reason: "Why this matters", answerGuidanceStatus: "pending" },
        { question: "Core question 3 — covers weak spot", stageName: "Behavioral Round", linkedPriority: "high", reason: "Why this matters", answerGuidanceStatus: "pending" },
        "... MUST generate ≥ 15 items in this array"
      ],
      likelyFollowUps: [
        { question: "Follow-up question 1", stageName: null, linkedPriority: "medium", reason: "Why", answerGuidanceStatus: "pending" },
        { question: "Follow-up question 2", stageName: "Phone Screen", linkedPriority: "medium", reason: "Why", answerGuidanceStatus: "pending" },
        { question: "Follow-up question 3", stageName: null, linkedPriority: "medium", reason: "Why", answerGuidanceStatus: "pending" },
        "... MUST generate ≥ 15 items in this array"
      ],
      extraDepth: [
        { question: "Depth question 1", stageName: null, linkedPriority: "low", reason: "Why", answerGuidanceStatus: "pending" },
        { question: "Depth question 2", stageName: "Final Round", linkedPriority: "low", reason: "Why", answerGuidanceStatus: "pending" },
        "... MUST generate ≥ 10 items in this array"
      ],
    },
    internalEvidenceLog: [
      {
        id: "ev-1",
        sourceType: "official_company | official_job | user_note | cv | public_report | market_heuristic",
        sourceLabel: "Source name",
        excerpt: "Key excerpt",
        url: "null or URL",
        relevance: "high | medium | low",
        trustWeight: "high | medium | low",
        contradictionGroup: "null or group label",
      },
    ],
  };
}

async function synthesizePrepPlan(
  company: string,
  role: string | undefined,
  country: string | undefined,
  level: Level,
  userNote: string | undefined,
  jobDescription: string | undefined,
  companyInsights: any,
  jobRequirements: any,
  cvAnalysis: any,
  openaiApiKey: string,
): Promise<PrepPlanOutput | null> {
  try {
    console.log("🔄 Starting assessment-first PrepPlan synthesis...");

    const prompt = buildPrepPlanPrompt(
      company, role, country, level, userNote, jobDescription,
      companyInsights, jobRequirements, cvAnalysis,
    );

    const model = getOpenAIModel('interviewSynthesis');
    const maxTokens = 12000; // PrepPlan is larger than old synthesis
    console.log(`🤖 Using model: ${model}`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: 'system', content: getPrepPlanSystemPrompt() },
          { role: 'user', content: prompt },
        ],
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ OpenAI PrepPlan synthesis error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    const rawContent = data.choices[0].message.content;
    const plan = parseJsonResponse<PrepPlanOutput>(rawContent, null as any);

    if (!plan?.summary || !plan?.stageRoadmap) {
      console.error("❌ PrepPlan synthesis returned invalid structure");
      return null;
    }

    // Log summary
    const qp = plan.questionPlan;
    const totalQuestions =
      (qp?.coreMustPractice?.length || 0) +
      (qp?.likelyFollowUps?.length || 0) +
      (qp?.extraDepth?.length || 0);

    console.log("✅ PrepPlan synthesis complete");
    console.log(`   Stages: ${plan.stageRoadmap.length}, Signals: ${plan.assessmentSignals?.length || 0}`);
    console.log(`   Questions: ${totalQuestions} (core: ${qp?.coreMustPractice?.length || 0}, follow-up: ${qp?.likelyFollowUps?.length || 0}, depth: ${qp?.extraDepth?.length || 0})`);
    console.log(`   Confidence: ${plan.summary.overallConfidence}, Weak signal: ${plan.summary.weakSignalCase}`);

    return plan;
  } catch (error) {
    console.error("❌ PrepPlan synthesis error:", error);
    return null;
  }
}

// ── PHASE 3: Save PrepPlan + populate normalized tables ──────

async function savePrepPlanToDatabase(
  supabase: any,
  searchId: string,
  userId: string,
  rawData: RawResearchData,
  plan: PrepPlanOutput,
) {
  try {
    console.log("💾 Saving PrepPlan to database...");

    // 1. Save raw research to search_artifacts (backward compat)
    console.log("  → Saving raw research to search_artifacts...");
    await withDbTimeout(async () => {
      await supabase
        .from('search_artifacts')
        .upsert({
          search_id: searchId,
          user_id: userId,
          raw_research: rawData,
          comparison_analysis: plan.candidatePositioning || {},
          preparation_guidance: plan.prepPriorities || [],
        }, { onConflict: 'search_id' });
    }, 'Save raw data to search_artifacts', 20000);

    // 2. Save PrepPlan to prep_plans table
    console.log("  → Saving PrepPlan...");
    await withDbTimeout(async () => {
      const { error } = await supabase
        .from('prep_plans')
        .upsert({
          search_id: searchId,
          summary: plan.summary,
          assessment_signals: plan.assessmentSignals || [],
          stage_roadmap: plan.stageRoadmap || [],
          prep_priorities: plan.prepPriorities || [],
          candidate_positioning: plan.candidatePositioning || {},
          practice_sequence: plan.practiceSequence || [],
          question_plan: plan.questionPlan || {},
          internal_evidence_log: plan.internalEvidenceLog || [],
        }, { onConflict: 'search_id' });
      if (error) throw error;
    }, 'Save prep_plans', 30000);
    console.log("  ✅ PrepPlan saved");

    // 3. Insert interview_stages (normalized for practice FK references)
    console.log("  → Saving interview stages...");
    const stageRecords = await withDbTimeout(async () => {
      const stagesToInsert = (plan.stageRoadmap || []).map((stage, index) => ({
        search_id: searchId,
        name: stage.stageName,
        order_index: stage.orderIndex || index + 1,
        duration: null,
        interviewer: null,
        content: stage.whyLikely || null,
        guidance: stage.prepActions?.join('; ') || null,
        confidence: stage.confidence,
        what_it_tests: stage.whatItTests || [],
        why_likely: stage.whyLikely || null,
        prep_priority: stage.prepPriority,
        question_themes: stage.questionThemes || [],
        prep_actions: stage.prepActions || [],
        low_confidence_guidance: stage.lowConfidenceGuidance || null,
      }));
      if (!stagesToInsert.length) return [];
      const { data, error } = await supabase
        .from('interview_stages')
        .insert(stagesToInsert)
        .select();
      if (error) throw error;
      return data;
    }, 'Insert interview stages');

    // Build stage name → ID map for question linking
    const stageIdByName: Record<string, string> = {};
    (stageRecords || []).forEach((s: any) => {
      stageIdByName[s.name] = s.id;
    });
    console.log(`  ✅ ${(stageRecords || []).length} stages saved`);

    // 4. Insert interview_questions (normalized for practice references)
    console.log("  → Saving interview questions...");
    const normalizeDifficulty = (tier: string): string => {
      if (tier === 'core_must_practice') return 'Hard';
      if (tier === 'likely_follow_ups') return 'Medium';
      return 'Easy';
    };

    let totalQuestionsInserted = 0;
    await withDbTimeout(async () => {
      const questionsToInsert: any[] = [];
      const qp = plan.questionPlan;
      if (!qp) return null;

      const addQuestions = (items: QuestionItem[], tier: string) => {
        (items || []).forEach((q) => {
          const stageId = q.stageName ? (stageIdByName[q.stageName] ?? null) : null;
          questionsToInsert.push({
            search_id: searchId,
            stage_id: stageId,
            question: q.question,
            category: 'role_specific', // Default; the tier is the primary organizer now
            difficulty: normalizeDifficulty(tier),
            rationale: q.reason || '',
            suggested_answer_approach: '',
            evaluation_criteria: [],
            follow_up_questions: [],
            company_context: '',
            star_story_fit: false,
            tier,
            linked_priority: q.linkedPriority || '',
            reason: q.reason || '',
            answer_guidance_status: q.answerGuidanceStatus || 'pending',
          });
        });
      };

      addQuestions(qp.coreMustPractice, 'core_must_practice');
      addQuestions(qp.likelyFollowUps, 'likely_follow_ups');
      addQuestions(qp.extraDepth, 'extra_depth');

      if (!questionsToInsert.length) return null;
      totalQuestionsInserted = questionsToInsert.length;

      const { error } = await supabase
        .from('interview_questions')
        .insert(questionsToInsert);
      if (error) throw error;
    }, 'Insert interview questions');

    console.log(`  ✅ ${totalQuestionsInserted} questions saved`);

    // 5. Update search status to completed
    console.log("  → Updating search status...");
    await withDbTimeout(async () => {
      const { error } = await supabase
        .from('searches')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', searchId);
      if (error) throw error;
    }, 'Update search status');

    console.log("✅ All data saved successfully!");
  } catch (error) {
    console.error("❌ Database save error:", error);
    throw error;
  }
}

// ── Main handler ─────────────────────────────────────────────

async function processInterviewResearch(
  requestData: InterviewResearchRequest,
  authContext: AuthorizedRequestContext,
) {
  let tracker: ProgressTracker | null = null;
  const searchId = requestData.searchId;
  const userId = requestData.userId;
  let logger: SearchLogger | null = null;
  const level = resolveLevel(requestData);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    if (authContext.kind === "user" && authContext.userId !== userId) {
      throw new Error("User ID does not match authenticated user");
    }

    tracker = new ProgressTracker(searchId);
    logger = new SearchLogger(searchId, "interview-research", userId);
    await tracker.updateProgress("processing", "Research request accepted", 5);

    logger.log("REQUEST_RECEIVED", "INIT", {
      company: requestData.company,
      role: requestData.role,
      country: requestData.country,
      level,
      roleLinkCount: requestData.roleLinks?.length || 0,
      hasUserNote: !!requestData.userNote,
      hasJobDescription: !!requestData.jobDescription,
    });

    console.log(`\n🚀 Starting interview research (V2 PrepPlan) for search: ${searchId}`);
    console.log(`   Company: ${requestData.company}`);
    console.log(`   Role: ${requestData.role || 'Not specified'}`);
    console.log(`   Level: ${level}`);

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY") || "";

    // ── Resolve CV ──
    let cvText = (requestData.cv || "").trim();
    let cvSource: 'payload' | 'profile' | 'none' = 'none';
    if (cvText) {
      cvSource = 'payload';
    } else {
      const storedResume = await fetchStoredResumeContent(supabase, userId, searchId);
      if (storedResume?.content) {
        cvText = storedResume.content;
        cvSource = 'profile';
        console.log("📄 Using stored profile resume");
      }
    }
    if (cvSource !== 'none' && cvText) {
      await ensureResumeSnapshotForSearch(supabase, searchId, userId, cvText);
    }

    // ── PHASE 1: Concurrent Data Gathering ──
    console.log("\n📊 PHASE 1: Gathering research data...");
    await tracker.updateStep('DATA_GATHERING_START');

    const [companyInsights, jobRequirements, cvAnalysis] = await Promise.allSettled([
      gatherCompanyData(requestData.company, requestData.role, requestData.country, searchId),
      gatherJobData(requestData.roleLinks || [], searchId, requestData.company, requestData.role),
      gatherCVData(cvText, userId),
    ]).then(results => [
      results[0].status === 'fulfilled' ? results[0].value : null,
      results[1].status === 'fulfilled' ? results[1].value : null,
      results[2].status === 'fulfilled' ? results[2].value : null,
    ]);

    console.log("✅ PHASE 1 Complete");
    await tracker.updateStep('DATA_GATHERING_COMPLETE');

    // ── Save raw data ──
    const rawData: RawResearchData = {
      company_research_raw: companyInsights,
      job_analysis_raw: jobRequirements,
      cv_analysis_raw: cvAnalysis,
    };

    // ── PHASE 2: PrepPlan Synthesis ──
    console.log("\n🔄 PHASE 2: Assessment-first PrepPlan synthesis...");
    await tracker.updateStep('AI_SYNTHESIS_START');

    const prepPlan = await synthesizePrepPlan(
      requestData.company,
      requestData.role,
      requestData.country,
      level,
      requestData.userNote,
      requestData.jobDescription,
      companyInsights,
      jobRequirements,
      cvAnalysis,
      openaiApiKey,
    );

    if (!prepPlan) {
      throw new Error("PrepPlan synthesis failed");
    }

    await tracker.updateStep('AI_SYNTHESIS_COMPLETE');

    // ── PHASE 3: Save to database ──
    console.log("\n💾 PHASE 3: Saving PrepPlan to database...");
    await tracker.updateStep('QUESTION_GENERATION_START');

    await savePrepPlanToDatabase(supabase, searchId, userId, rawData, prepPlan);

    await tracker.updateStep('QUESTION_GENERATION_COMPLETE');
    console.log(`\n✅ Interview research complete for search: ${searchId}`);
    logger?.log("FUNCTION_SUCCESS", "COMPLETE");
    await tracker.markCompleted();

  } catch (error) {
    console.error("❌ Error in interview-research:", error);
    logger?.log("FUNCTION_ERROR", "GLOBAL", null, error instanceof Error ? error.message : String(error));

    if (searchId) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") || "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      );
      try {
        await supabase
          .from('searches')
          .update({ status: 'failed', error_message: error instanceof Error ? error.message : 'Unknown error' })
          .eq('id', searchId);
      } catch (markError) {
        console.error("Failed to mark search as failed:", markError);
      }
    }

    if (tracker) {
      await tracker.markFailed(error instanceof Error ? error.message : "Unknown error");
    }
  } finally {
    if (logger) {
      try { await logger.saveToFile(); } catch { /* ignore */ }
    }
  }
}

const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const edgeRuntime = globalThis as typeof globalThis & {
  EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void };
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  );
  const authResult = await authorizeRequest(req, supabase);

  if (!authResult.ok) {
    return authResult.response;
  }

  let requestData: InterviewResearchRequest;
  try {
    requestData = await req.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON body" }, 400);
  }

  if (!requestData.company || !requestData.searchId || !requestData.userId) {
    return jsonResponse({ success: false, error: "Missing required fields: company, searchId, userId" }, 400);
  }

  // Fire-and-forget: process in background if EdgeRuntime supports it
  const work = processInterviewResearch(requestData, authResult.context);

  if (edgeRuntime.EdgeRuntime?.waitUntil) {
    edgeRuntime.EdgeRuntime.waitUntil(work);
    return jsonResponse({ success: true, message: "Research started", searchId: requestData.searchId }, 202);
  }

  // Fallback: await inline
  await work;
  return jsonResponse({ success: true, message: "Research completed", searchId: requestData.searchId }, 200);
});
