import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.2";
import { getOpenAIModel } from "../_shared/config.ts";
import {
  resolveExperienceLevel,
  type CanonicalLevel,
} from "./experience-level.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QuestionGenerationRequest {
  searchId: string;
  userId: string;
  companyInsights: any;
  jobRequirements: any;
  cvAnalysis: any;
  interviewStage: string;
  stageDetails: any;
  level?: CanonicalLevel;
}

interface GeneratedQuestion {
  question: string;
  type: string;
  difficulty: string;
  rationale: string;
  suggested_answer_approach: string;
  evaluation_criteria: string[];
  follow_up_questions: string[];
  star_story_fit: boolean;
  company_context: string;
  depth_label?: string;
  good_answer_signals?: string[];
  weak_answer_signals?: string[];
  seniority_expectation?: string;
  sample_answer_outline?: string;
}

interface QuestionBank {
  behavioral_questions: GeneratedQuestion[];
  technical_questions: GeneratedQuestion[];
  situational_questions: GeneratedQuestion[];
  company_specific_questions: GeneratedQuestion[];
  role_specific_questions: GeneratedQuestion[];
  experience_based_questions: GeneratedQuestion[];
  cultural_fit_questions: GeneratedQuestion[];
}

const buildStubQuestion = (
  question: string,
  type: string,
  company?: string,
  role?: string
): GeneratedQuestion => ({
  question,
  type,
  difficulty: "Medium",
  rationale: "Covers core competencies while tailoring to the role and company context.",
  suggested_answer_approach: "Use a concise STAR story with measurable impact.",
  evaluation_criteria: ["Clarity", "Impact", "Collaboration"],
  follow_up_questions: ["What tradeoffs did you consider?", "How did you measure success?"],
  star_story_fit: true,
  company_context: company ? `Aligns to ${company}'s expectations for ${role ?? "the role"}.` : "Role-aligned context.",
  depth_label: "Mid-level depth expected",
  good_answer_signals: [
    "Clear situation framing",
    "Specific collaboration details",
    "Measurable results tied to role goals"
  ],
  weak_answer_signals: [
    "Generic statements without context",
    "Blaming teammates without ownership"
  ],
  seniority_expectation: "Mid-level candidates should show ownership plus collaboration.",
  sample_answer_outline: "Situation • Challenge • Your actions • Impact metrics • Reflection",
});

const buildStubQuestionBank = (
  companyInsights: any,
  jobRequirements: any,
  cvAnalysis: any,
  interviewStage: string
): QuestionBank => {
  const company = companyInsights?.name ?? "the company";
  const role = jobRequirements?.role ?? cvAnalysis?.current_role ?? "the role";
  return {
    behavioral_questions: [
      buildStubQuestion(
        `Describe a time you navigated ambiguity while shipping a feature for ${company}.`,
        "behavioral",
        company,
        role
      ),
    ],
    technical_questions: [
      buildStubQuestion(
        `Walk through how you would design an API to support ${role} workflows.`,
        "technical",
        company,
        role
      ),
    ],
    situational_questions: [
      buildStubQuestion(
        `How would you handle conflicting priorities between product and reliability during ${interviewStage}?`,
        "situational",
        company,
        role
      ),
    ],
    company_specific_questions: [
      buildStubQuestion(
        `What about ${company}'s culture resonates with you, and how have you demonstrated it?`,
        "company_specific",
        company,
        role
      ),
    ],
    role_specific_questions: [
      buildStubQuestion(
        `Tell me about a project that best demonstrates your fit for ${role}.`,
        "role_specific",
        company,
        role
      ),
    ],
    experience_based_questions: [
      buildStubQuestion(
        "Share a STAR example where you unblocked a team through technical leadership.",
        "experience_based",
        company,
        role
      ),
    ],
    cultural_fit_questions: [
      buildStubQuestion(
        `How do you create inclusive collaboration in cross-functional teams at ${company}?`,
        "cultural_fit",
        company,
        role
      ),
    ],
  };
};

// AI-powered interview question generation based on all gathered data
async function generateInterviewQuestions(
  companyInsights: any,
  jobRequirements: any,
  cvAnalysis: any,
  interviewStage: string,
  stageDetails: any,
  level: CanonicalLevel | undefined,
  openaiApiKey: string
): Promise<QuestionBank> {
  
  let questionContext = `Interview Question Generation Context:\n\n`;
  
  questionContext += `INTERVIEW STAGE: ${interviewStage}\n`;
  if (stageDetails) {
    questionContext += `Stage Details: ${JSON.stringify(stageDetails)}\n`;
  }
  
  // Build company context
  if (companyInsights) {
    questionContext += `\nCOMPANY INSIGHTS:\n`;
    questionContext += `Company: ${companyInsights.name}\n`;
    questionContext += `Industry: ${companyInsights.industry}\n`;
    questionContext += `Culture: ${companyInsights.culture}\n`;
    questionContext += `Values: ${companyInsights.values?.join(', ')}\n`;
    questionContext += `Interview Philosophy: ${companyInsights.interview_philosophy}\n`;
    
    if (companyInsights.interview_questions_bank) {
      questionContext += `\nACTUAL QUESTIONS FROM REVIEWS:\n`;
      questionContext += `Behavioral: ${companyInsights.interview_questions_bank.behavioral?.join(', ')}\n`;
      questionContext += `Technical: ${companyInsights.interview_questions_bank.technical?.join(', ')}\n`;
      questionContext += `Situational: ${companyInsights.interview_questions_bank.situational?.join(', ')}\n`;
      questionContext += `Company Specific: ${companyInsights.interview_questions_bank.company_specific?.join(', ')}\n`;
    }
    
    if (companyInsights.hiring_manager_insights) {
      questionContext += `\nHIRING MANAGER INSIGHTS:\n`;
      questionContext += `What They Look For: ${companyInsights.hiring_manager_insights.what_they_look_for?.join(', ')}\n`;
      questionContext += `Red Flags: ${companyInsights.hiring_manager_insights.red_flags?.join(', ')}\n`;
      questionContext += `Success Factors: ${companyInsights.hiring_manager_insights.success_factors?.join(', ')}\n`;
    }
  }
  
  // Build job requirements context
  if (jobRequirements) {
    questionContext += `\nJOB REQUIREMENTS:\n`;
    questionContext += `Technical Skills: ${jobRequirements.technical_skills?.join(', ')}\n`;
    questionContext += `Soft Skills: ${jobRequirements.soft_skills?.join(', ')}\n`;
    questionContext += `Experience Level: ${jobRequirements.experience_level}\n`;
    questionContext += `Key Responsibilities: ${jobRequirements.responsibilities?.join(', ')}\n`;
    questionContext += `Qualifications: ${jobRequirements.qualifications?.join(', ')}\n`;
    questionContext += `Interview Process Hints: ${jobRequirements.interview_process_hints?.join(', ')}\n`;
  }
  
  // Determine experience level with fallback logic:
  // 1. Use canonical level if provided (user's explicit choice)
  // 2. Fall back to CV-inferred level
  // 3. Default to 'mid' if neither exists
  const {
    experienceLevel,
    experienceYears,
    source: experienceLevelSource,
  } = resolveExperienceLevel(level, cvAnalysis);

  if (experienceLevelSource === "explicit") {
    console.log(`Using user-specified level: ${experienceLevel}`);
  } else if (experienceLevelSource === "cv") {
    console.log(`Inferred seniority from CV: ${experienceLevel} (${experienceYears} years)`);
  } else {
    console.log("No seniority information available, defaulting to mid-level");
  }
  
  // Build candidate context
  if (cvAnalysis) {
    questionContext += `\nCANDIDATE PROFILE:\n`;
    questionContext += `Current Role: ${cvAnalysis.current_role}\n`;
    questionContext += `Experience: ${experienceYears} years (${experienceLevel} level)\n`;
    questionContext += `Experience Level: ${experienceLevel.toUpperCase()} - Adjust question difficulty and quantity accordingly\n`;
    questionContext += `Technical Skills: ${cvAnalysis.skills?.technical?.join(', ')}\n`;
    questionContext += `Key Achievements: ${cvAnalysis.key_achievements?.join(', ')}\n`;
    questionContext += `Experience History: ${cvAnalysis.experience?.map(exp => `${exp.role} at ${exp.company}`).join(', ')}\n`;
  } else {
    questionContext += `\nCANDIDATE PROFILE:\n`;
    questionContext += `Experience Level: ${experienceLevel.toUpperCase()} - Adjust question difficulty and quantity accordingly\n`;
  }
  
  // Focus on QUALITY over QUANTITY - generate fewer but highly tailored questions
  questionContext += `\nTARGET: Generate 5-8 HIGHLY TAILORED questions per category for TOTAL 30-50 questions.\n`;
  questionContext += `CRITICAL: Each question MUST be deeply tailored to:\n`;
  questionContext += `  - The candidate's specific background (work history, projects, achievements)\n`;
  questionContext += `  - The specific job requirements and responsibilities\n`;
  questionContext += `  - The company's culture, values, and interview philosophy\n`;
  questionContext += `  - Real interview questions extracted from candidate reports\n`;
  questionContext += `\nQUALITY OVER QUANTITY: Better to have 30 highly relevant, tailored questions than 100 generic ones.\n`;
  
  if (experienceLevel === 'junior') {
    questionContext += `\nFOCUS FOR JUNIOR CANDIDATE: Fundamentals, learning ability, potential, adaptability. Questions should focus on basic concepts, learning scenarios, and growth mindset. Reference specific projects or experiences from the candidate's background.\n`;
  } else if (experienceLevel === 'mid') {
    questionContext += `\nFOCUS FOR MID-LEVEL CANDIDATE: Execution, problem-solving, leadership potential, project management. Questions should focus on project ownership, technical depth, and team collaboration. Reference specific achievements and responsibilities from the candidate's work history.\n`;
  } else {
    questionContext += `\nFOCUS FOR SENIOR CANDIDATE: Strategic thinking, mentorship, complex problem-solving, system design, team leadership. Questions should focus on architecture, business impact, and organizational influence. Reference specific leadership experiences and strategic projects from the candidate's background.\n`;
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: getOpenAIModel('questionGeneration'),
      messages: [
        {
          role: 'system',
          content: `You are an expert interview preparation specialist with deep knowledge of hiring practices across major companies. Generate HIGHLY TAILORED, realistic interview questions based on the provided context.

CRITICAL FOCUS: QUALITY OVER QUANTITY
- Generate 5-8 questions per category (30-50 total) that are DEEPLY TAILORED
- Each question MUST reference specific details from the candidate's background, job requirements, or company research
- Better to have 30 highly relevant questions than 100 generic ones

MANDATORY REQUIREMENTS:
1. RESEARCH-FIRST APPROACH: Prioritize questions derived from actual company interview experiences and research
2. DEEP TAILORING: 100% of questions must reference specific details:
   - Candidate's specific work history, projects, or achievements
   - Specific job responsibilities and requirements
   - Company-specific information, culture, or research findings
   - Real interview questions extracted from candidate reports
3. ADAPTIVE COMPLEXITY: Adjust question complexity based on candidate's experience level
4. REAL QUESTIONS: Use actual questions from interview reviews as foundation, then create tailored variations
5. STAGE-APPROPRIATE: Questions must align with the specific interview stage and interviewer type
6. EXPERIENCE-MATCHED: Question complexity and focus must match candidate's experience level

TARGET VOLUME:
- TOTAL: 30-50 questions across all categories (5-8 per category)
- Focus on QUALITY and TAILORING, not quantity
- Each question should be unique and highly relevant

For each question, provide:
- The specific question (MUST reference specific details from context)
- Question type and difficulty (adjust difficulty based on candidate experience)
- Rationale for why this question would be asked (reference specific company/job/CV details)
- Suggested answer approach
- Evaluation criteria interviewers would use
- Potential follow-up questions
- Whether it's suitable for STAR method
- Company-specific context (MUST include specific company details)
- A short depth label explaining how deep the interviewer expects candidates to go
- A list of \"good answer signals\" (what strong answers include)
- A list of \"weak answer signals\" (what to avoid)
- A one-line seniority expectation note
- A concise sample answer outline the candidate can follow

CRITICAL REQUIREMENTS - STRICTLY ENFORCE:
- DEEP TAILORING: Every question must reference specific details from:
  * Candidate's work history, projects, achievements, or skills
  * Job responsibilities, requirements, or qualifications
  * Company culture, values, interview philosophy, or real interview questions
- RESEARCH-DRIVEN: If company research contains actual interview questions, use them as foundation and create tailored variations
- EXPERIENCE ADAPTATION: Adjust question complexity and focus:
  * Junior (0-2 years): Focus on fundamentals, learning scenarios, basic problem-solving - reference their projects/education
  * Mid-level (3-7 years): Focus on project ownership, technical depth, team collaboration - reference their work achievements
  * Senior (8+ years): Focus on strategy, architecture, organizational impact - reference their leadership experiences
- NO GENERIC QUESTIONS: Every question must be specific and tailored. Generic questions like "Tell me about yourself" are FORBIDDEN unless tailored to the specific context
- QUALITY DISTRIBUTION: 20% Easy, 50% Medium, 30% Hard (adjust complexity based on experience level)

You MUST return ONLY valid JSON in this exact structure - no markdown, no additional text:

{
  "behavioral_questions": [
    {
      "question": "specific question",
      "type": "behavioral",
      "difficulty": "Easy/Medium/Hard",
      "rationale": "why this question is asked",
      "suggested_answer_approach": "how to approach answering",
      "evaluation_criteria": ["what interviewers look for"],
      "follow_up_questions": ["potential follow-ups"],
      "star_story_fit": true/false,
      "company_context": "company-specific context",
      "depth_label": "how deep to go",
      "good_answer_signals": ["signal 1", "signal 2"],
      "weak_answer_signals": ["pitfall 1", "pitfall 2"],
      "seniority_expectation": "what level is expected",
      "sample_answer_outline": "short outline to follow"
    }
  ],
  "technical_questions": [
    {
      "question": "specific question",
      "type": "technical",
      "difficulty": "Easy/Medium/Hard",
      "rationale": "why this question is asked",
      "suggested_answer_approach": "how to approach answering",
      "evaluation_criteria": ["what interviewers look for"],
      "follow_up_questions": ["potential follow-ups"],
      "star_story_fit": true/false,
      "company_context": "company-specific context",
      "depth_label": "how deep to go",
      "good_answer_signals": ["signal 1", "signal 2"],
      "weak_answer_signals": ["pitfall 1", "pitfall 2"],
      "seniority_expectation": "what level is expected",
      "sample_answer_outline": "short outline to follow"
    }
  ],
  "situational_questions": [
    {
      "question": "specific question",
      "type": "situational",
      "difficulty": "Easy/Medium/Hard",
      "rationale": "why this question is asked",
      "suggested_answer_approach": "how to approach answering",
      "evaluation_criteria": ["what interviewers look for"],
      "follow_up_questions": ["potential follow-ups"],
      "star_story_fit": true/false,
      "company_context": "company-specific context",
      "depth_label": "how deep to go",
      "good_answer_signals": ["signal 1", "signal 2"],
      "weak_answer_signals": ["pitfall 1", "pitfall 2"],
      "seniority_expectation": "what level is expected",
      "sample_answer_outline": "short outline to follow"
    }
  ],
  "company_specific_questions": [
    {
      "question": "specific question",
      "type": "company_specific",
      "difficulty": "Easy/Medium/Hard",
      "rationale": "why this question is asked",
      "suggested_answer_approach": "how to approach answering",
      "evaluation_criteria": ["what interviewers look for"],
      "follow_up_questions": ["potential follow-ups"],
      "star_story_fit": true/false,
      "company_context": "company-specific context",
      "depth_label": "how deep to go",
      "good_answer_signals": ["signal 1", "signal 2"],
      "weak_answer_signals": ["pitfall 1", "pitfall 2"],
      "seniority_expectation": "what level is expected",
      "sample_answer_outline": "short outline to follow"
    }
  ],
  "role_specific_questions": [
    {
      "question": "specific question",
      "type": "role_specific",
      "difficulty": "Easy/Medium/Hard",
      "rationale": "why this question is asked",
      "suggested_answer_approach": "how to approach answering",
      "evaluation_criteria": ["what interviewers look for"],
      "follow_up_questions": ["potential follow-ups"],
      "star_story_fit": true/false,
      "company_context": "company-specific context",
      "depth_label": "how deep to go",
      "good_answer_signals": ["signal 1", "signal 2"],
      "weak_answer_signals": ["pitfall 1", "pitfall 2"],
      "seniority_expectation": "what level is expected",
      "sample_answer_outline": "short outline to follow"
    }
  ],
  "experience_based_questions": [
    {
      "question": "specific question",
      "type": "experience_based",
      "difficulty": "Easy/Medium/Hard",
      "rationale": "why this question is asked",
      "suggested_answer_approach": "how to approach answering",
      "evaluation_criteria": ["what interviewers look for"],
      "follow_up_questions": ["potential follow-ups"],
      "star_story_fit": true/false,
      "company_context": "company-specific context"
    }
  ],
  "cultural_fit_questions": [
    {
      "question": "specific question",
      "type": "cultural_fit",
      "difficulty": "Easy/Medium/Hard",
      "rationale": "why this question is asked",
      "suggested_answer_approach": "how to approach answering",
      "evaluation_criteria": ["what interviewers look for"],
      "follow_up_questions": ["potential follow-ups"],
      "star_story_fit": true/false,
      "company_context": "company-specific context",
      "depth_label": "how deep to go",
      "good_answer_signals": ["signal 1", "signal 2"],
      "weak_answer_signals": ["pitfall 1", "pitfall 2"],
      "seniority_expectation": "what level is expected",
      "sample_answer_outline": "short outline to follow"
    }
  ]
}`
        },
        {
          role: 'user',
          content: `Generate comprehensive interview questions based on this context:\n\n${questionContext}`
        }
      ],
      max_tokens: 6000,  // Increased from 3000, using getMaxTokens would be better but this works
      response_format: { type: "json_object" }  // Ensure JSON output
    }),
  });

  if (!response.ok) {
    throw new Error(`Question generation failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const questionResult = data.choices[0].message.content;
  
  try {
    return JSON.parse(questionResult);
  } catch (parseError) {
    console.error("Failed to parse question generation JSON:", parseError);
    
    // Return fallback structure
    return {
      behavioral_questions: [],
      technical_questions: [],
      situational_questions: [],
      company_specific_questions: [],
      role_specific_questions: [],
      experience_based_questions: [],
      cultural_fit_questions: []
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchId, userId, companyInsights, jobRequirements, cvAnalysis, interviewStage, stageDetails, level } = await req.json() as QuestionGenerationRequest;

    if (!searchId || !userId) {
      throw new Error("Missing required parameters: searchId and userId");
    }

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    const useFallback = !openaiApiKey;

    console.log("Starting interview question generation for search:", searchId, "stage:", interviewStage, "level:", level);

    // Generate comprehensive question bank (fallback when offline/CI)
    let questionBank: QuestionBank;
    if (useFallback) {
      console.warn("Using fallback interview question bank (missing OpenAI API key)");
      questionBank = buildStubQuestionBank(companyInsights, jobRequirements, cvAnalysis, interviewStage);
    } else {
      try {
        questionBank = await generateInterviewQuestions(
          companyInsights,
          jobRequirements,
          cvAnalysis,
          interviewStage,
          stageDetails,
          level,
          openaiApiKey!
        );
      } catch (generationError) {
        console.error("Question generation failed, serving fallback:", generationError);
        questionBank = buildStubQuestionBank(companyInsights, jobRequirements, cvAnalysis, interviewStage);
      }
    }

    console.log("Interview question generation completed successfully");

    return new Response(
      JSON.stringify({ 
        status: "success", 
        message: "Interview questions generated successfully",
        question_bank: questionBank,
        total_questions: Object.values(questionBank).reduce((sum, questions) => sum + questions.length, 0)
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error processing interview question generation:", error);

    return new Response(
      JSON.stringify({ 
        status: "error", 
        message: error.message || "Failed to generate interview questions"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
