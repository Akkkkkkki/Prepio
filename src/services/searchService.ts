import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import {
  type CandidateProfile,
  type ProfileImportRecord,
  type ProfileImportSuggestion,
  type ProfileMergeDecision,
  createEmptyCandidateProfile,
  mergeImportedProfile,
  normalizeCandidateProfile,
} from "@/lib/candidateProfile";

interface CreateSearchParams {
  company: string;
  role?: string;
  country?: string;
  roleLinks?: string[];
  cv?: string;
  level?: 'junior' | 'mid' | 'senior_ic' | 'people_manager' | 'unknown';
  userNote?: string;
  jobDescription?: string;
}

const RESEARCH_START_TIMEOUT_MS = 15000;
const PRACTICE_AUDIO_BUCKET = "practice-audio";

interface ResumeFileInput {
  name: string;
  path: string;
  size: number;
  mimeType: string;
}

type ResumeSource = 'manual' | 'upload' | 'search_snapshot';

const RESUME_FILES_BUCKET = "resume-files";

type SearchContext = Pick<Tables<"searches">, "company" | "role" | "country">;
type PracticeAnswerSummary = Pick<
  Tables<"practice_answers">,
  "id" | "question_id" | "answer_time_seconds" | "created_at"
>;

type PracticeAnswerQuestion = Pick<
  Tables<"interview_questions">,
  "question" | "category" | "difficulty" | "stage_id" | "suggested_answer_approach"
> & {
  interview_stages: Pick<Tables<"interview_stages">, "name"> | null;
};

export interface PracticeQuestionFlag {
  flag_type: string;
  id: string;
}

export type PracticeQuestionFlagMap = Record<string, PracticeQuestionFlag>;

export interface PracticeHistorySession extends Pick<
  Tables<"practice_sessions">,
  "id" | "search_id" | "started_at" | "completed_at" | "session_notes"
> {
  searches: SearchContext | null;
  practice_answers: PracticeAnswerSummary[];
}

export interface PracticeHistorySessionDetail extends Pick<
  Tables<"practice_sessions">,
  "id" | "search_id" | "started_at" | "completed_at" | "session_notes"
> {
  searches: SearchContext | null;
}

export interface PracticeHistoryAnswerDetail extends Pick<
  Tables<"practice_answers">,
  "id" | "question_id" | "text_answer" | "answer_time_seconds" | "created_at"
> {
  interview_questions: PracticeAnswerQuestion | null;
}

export interface PracticeHistoryOverviewStats {
  totalSessions: number;
  totalQuestionsAnswered: number;
  totalTimeSeconds: number;
  needsWorkCount: number;
}

type PracticeAnswerWithQuestion = {
  question_id: string;
  created_at: string;
};

type PracticeAnswerWithSessionQuestion = PracticeAnswerWithQuestion & {
  session_id: string;
};

type ResumeRecord = Tables<"resumes">;
type CandidateProfileRecord = Tables<"candidate_profiles">;
type ProfileImportRow = Tables<"profile_imports">;

const EMPTY_PRACTICE_OVERVIEW_STATS: PracticeHistoryOverviewStats = {
  totalSessions: 0,
  totalQuestionsAnswered: 0,
  totalTimeSeconds: 0,
  needsWorkCount: 0,
};

const normalizeRoleLinks = (roleLinks?: string[]) =>
  roleLinks?.map((link) => link.trim()).filter(Boolean) ?? [];

const getTimestamp = (value: string) => new Date(value).getTime();

const buildResumeParsedDataFallback = (content: string) => {
  const normalizedContent = content.trim();
  const lines = normalizedContent
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const emailMatch = normalizedContent.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const headline = lines[1] || lines[0] || "";

  return {
    personalInfo: {
      email: emailMatch?.[0],
    },
    professional: {
      currentRole: headline,
      summary: normalizedContent.slice(0, 280).trim(),
      workHistory: [],
    },
    education: [],
    skills: {
      categories: [],
      soft: [],
    },
    projects: [],
    certifications: [],
    languages: [],
    achievements: [],
    lastUpdated: new Date().toISOString().split("T")[0],
  };
};

export const dedupePracticeAnswersByQuestion = <T extends PracticeAnswerWithQuestion>(answers: T[]) => {
  const latestByQuestion = new Map<string, T>();

  answers.forEach((answer) => {
    const existing = latestByQuestion.get(answer.question_id);

    if (!existing || getTimestamp(answer.created_at) >= getTimestamp(existing.created_at)) {
      latestByQuestion.set(answer.question_id, answer);
    }
  });

  return Array.from(latestByQuestion.values()).sort(
    (left, right) => getTimestamp(left.created_at) - getTimestamp(right.created_at)
  );
};

export const dedupePracticeAnswersBySessionQuestion = <T extends PracticeAnswerWithSessionQuestion>(
  answers: T[]
) => {
  const latestBySessionQuestion = new Map<string, T>();

  answers.forEach((answer) => {
    const key = `${answer.session_id}:${answer.question_id}`;
    const existing = latestBySessionQuestion.get(key);

    if (!existing || getTimestamp(answer.created_at) >= getTimestamp(existing.created_at)) {
      latestBySessionQuestion.set(key, answer);
    }
  });

  return Array.from(latestBySessionQuestion.values()).sort(
    (left, right) => getTimestamp(left.created_at) - getTimestamp(right.created_at)
  );
};

const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("No authenticated user");
  }

  return user;
};

const normalizeProfileImportRecord = (
  row: ProfileImportRow | null,
  userId: string,
): ProfileImportRecord | null => {
  if (!row) {
    return null;
  }

  const draftProfile = normalizeCandidateProfile(
    (row.draft_profile as Partial<CandidateProfile> | null) || { userId },
    userId,
  );
  const mergeSuggestions = Array.isArray(row.merge_suggestions)
    ? (row.merge_suggestions as ProfileImportSuggestion[])
    : [];
  const importSummary =
    row.import_summary && typeof row.import_summary === "object"
      ? (row.import_summary as ProfileImportRecord["importSummary"])
      : {
          newCount: 0,
          duplicateCount: 0,
          conflictingCount: 0,
          missingCount: 0,
        };

  return {
    id: row.id,
    userId: row.user_id,
    resumeId: row.resume_id,
    source: row.source,
    draftProfile,
    mergeSuggestions,
    importSummary,
    status: row.status,
    createdAt: row.created_at,
    appliedAt: row.applied_at,
  };
};

const normalizeCandidateProfileRecord = (
  row: CandidateProfileRecord | null,
  userId: string,
): CandidateProfile | null => {
  if (!row) {
    return null;
  }

  return normalizeCandidateProfile(
    {
      userId: row.user_id,
      headline: row.headline,
      summary: row.summary,
      location: row.location,
      links: row.links as CandidateProfile["links"],
      experiences: row.experiences as CandidateProfile["experiences"],
      projects: row.projects as CandidateProfile["projects"],
      skills: row.skills as CandidateProfile["skills"],
      education: row.education as CandidateProfile["education"],
      certifications: row.certifications as CandidateProfile["certifications"],
      languages: row.languages as CandidateProfile["languages"],
      preferences: row.preferences as CandidateProfile["preferences"],
      completionScore: row.completion_score,
      lastResumeId: row.last_resume_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    userId,
  );
};

const toCandidateProfileRow = (profile: CandidateProfile) => ({
  user_id: profile.userId,
  headline: profile.headline,
  summary: profile.summary,
  location: profile.location,
  links: profile.links as Json,
  experiences: profile.experiences as Json,
  projects: profile.projects as Json,
  skills: profile.skills as Json,
  education: profile.education as Json,
  certifications: profile.certifications as Json,
  languages: profile.languages as Json,
  preferences: profile.preferences as Json,
  completion_score: profile.completionScore,
  last_resume_id: profile.lastResumeId,
});

export const searchService = {
  // Step 1: Create search record only (fast, synchronous)
  async createSearchRecord({ company, role, country, roleLinks, cv, level, userNote, jobDescription }: CreateSearchParams) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("No authenticated user");
      }
      const normalizedRoleLinks = normalizeRoleLinks(roleLinks);

      const { data: searchData, error: searchError } = await supabase
        .from("searches")
        .insert({
          user_id: user.id,
          company,
          role,
          country,
          role_links: normalizedRoleLinks,
          level: level || null,
          user_note: userNote || null,
          job_description: jobDescription || null,
          status: "pending",
        })
        .select()
        .single();

      if (searchError) throw searchError;

      return { searchId: searchData.id, success: true };
    } catch (error) {
      console.error("Error creating search record:", error);
      return { error, success: false };
    }
  },

  // Step 2: Start processing asynchronously (can take minutes)
  async startProcessing(searchId: string, { company, role, country, roleLinks, cv, level, userNote, jobDescription }: CreateSearchParams) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("No authenticated user");
      }
      const normalizedRoleLinks = normalizeRoleLinks(roleLinks);

      const response = await Promise.race([
        supabase.functions.invoke("interview-research", {
          body: {
            company,
            role,
            country,
            roleLinks: normalizedRoleLinks,
            cv,
            level,
            userNote,
            jobDescription,
            userId: user.id,
            searchId,
          }
        }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => {
            reject(new Error("Timed out while starting research"));
          }, RESEARCH_START_TIMEOUT_MS);
        }),
      ]);

      if (response.error) {
        throw response.error;
      }

      return { success: true };
    } catch (error) {
      console.error("Error starting processing:", error);
      
      // Update status to failed
      await supabase
        .from("searches")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Unable to start research",
        })
        .eq("id", searchId);
      
      return { error, success: false };
    }
  },

  // Legacy method for backward compatibility
  async createSearch(params: CreateSearchParams) {
    const recordResult = await this.createSearchRecord(params);
    if (!recordResult.success) return recordResult;
    
    const processResult = await this.startProcessing(recordResult.searchId!, params);
    return { searchId: recordResult.searchId, success: processResult.success, error: processResult.error };
  },

  async getSearchStatus(searchId: string) {
    try {
      const { data, error } = await supabase
        .from("searches")
        .select("id, status")
        .eq("id", searchId)
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error("Error getting search status:", error);
      return null;
    }
  },

  async getSearchResults(searchId: string) {
    try {
      const { data: search, error: searchError } = await supabase
        .from("searches")
        .select("*")
        .eq("id", searchId)
        .single();

      if (searchError) throw searchError;

      // Get the interview stages for the search
      const { data: stages, error: stagesError } = await supabase
        .from("interview_stages")
        .select("*")
        .eq("search_id", searchId)
        .order("order_index");

      if (stagesError) throw stagesError;

      // Get the questions for each stage
      const stagesWithQuestions = await Promise.all(
        stages.map(async (stage) => {
          const { data: questions, error: questionsError } = await supabase
            .from("interview_questions")
            .select("*")
            .eq("stage_id", stage.id);

          if (questionsError) throw questionsError;

          // Transform questions to include enhanced metadata
          const enhancedQuestions = (questions || []).map(q => ({
            ...q,
            type: q.question_type,
            answered: false, // For practice session tracking
          }));

          return {
            ...stage,
            questions: enhancedQuestions,
          };
        })
      );

      let prepPlan: Tables<"prep_plans"> | null = null;

      if (search.status === "completed" || search.status === "failed") {
        const { data: prepPlanData, error: prepPlanError } = await supabase
          .from("prep_plans")
          .select("*")
          .eq("search_id", searchId)
          .maybeSingle();

        if (prepPlanError) {
          console.warn("Prep plan query error:", prepPlanError.message || prepPlanError);
        } else {
          prepPlan = prepPlanData;
        }
      }

      return {
        search,
        stages: stagesWithQuestions,
        prepPlan,
        success: true
      };
    } catch (error) {
      console.error("Error getting search results:", error);
      return { error, success: false };
    }
  },

  async getPrepPlan(searchId: string) {
    try {
      const { data, error } = await supabase
        .from("prep_plans")
        .select("*")
        .eq("search_id", searchId)
        .maybeSingle();

      if (error) throw error;

      return { prepPlan: data, success: true };
    } catch (error) {
      console.error("Error getting prep plan:", error);
      return { error, success: false };
    }
  },

  async dismissBanner(searchId: string) {
    try {
      const { error } = await supabase
        .from("searches")
        .update({ banner_dismissed: true })
        .eq("id", searchId);
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error("Error dismissing banner:", error);
      return { error, success: false };
    }
  },

  async saveSelfRating(answerId: string, rating: number) {
    try {
      const { error } = await supabase
        .from("practice_answers")
        .update({ self_rating: rating })
        .eq("id", answerId);
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error("Error saving self rating:", error);
      return { error, success: false };
    }
  },

  async getSearchHistory() {
    try {
      const { data: searches, error } = await supabase
        .from("searches")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return { searches, success: true };
    } catch (error) {
      console.error("Error getting search history:", error);
      return { error, success: false };
    }
  },

  async getPracticeSessions(searchId?: string) {
    try {
      const user = await getCurrentUser();

      let query = supabase
        .from("practice_sessions")
        .select(`
          id,
          search_id,
          started_at,
          completed_at,
          session_notes,
          searches (
            company,
            role,
            country
          ),
          practice_answers (
            id,
            question_id,
            answer_time_seconds,
            created_at
          )
        `)
        .eq("user_id", user.id)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false });

      if (searchId) {
        query = query.eq("search_id", searchId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const sessions: PracticeHistorySession[] = (data ?? []).map((session) => {
        const practiceAnswers = dedupePracticeAnswersByQuestion(
          (session.practice_answers ?? []).map((answer) => ({
            id: answer.id,
            question_id: answer.question_id,
            answer_time_seconds: answer.answer_time_seconds,
            created_at: answer.created_at,
          }))
        );

        return {
          id: session.id,
          search_id: session.search_id,
          started_at: session.started_at,
          completed_at: session.completed_at,
          session_notes: session.session_notes,
          searches: Array.isArray(session.searches)
            ? session.searches[0] ?? null
            : session.searches ?? null,
          practice_answers: practiceAnswers,
        };
      });

      return { sessions, success: true };
    } catch (error) {
      console.error("Error getting practice sessions:", error);
      return { error, success: false };
    }
  },

  async getSessionDetail(sessionId: string) {
    try {
      const user = await getCurrentUser();

      const [sessionResult, answersResult] = await Promise.all([
        supabase
          .from("practice_sessions")
          .select(`
            id,
            search_id,
            started_at,
            completed_at,
            session_notes,
            searches (
              company,
              role,
              country
            )
          `)
          .eq("id", sessionId)
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("practice_answers")
          .select(`
            id,
            question_id,
            text_answer,
            answer_time_seconds,
            created_at,
            interview_questions (
              question,
              category,
              difficulty,
              stage_id,
              suggested_answer_approach,
              interview_stages (
                name
              )
            )
          `)
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true }),
      ]);

      if (sessionResult.error) throw sessionResult.error;
      if (answersResult.error) throw answersResult.error;

      const session: PracticeHistorySessionDetail = {
        id: sessionResult.data.id,
        search_id: sessionResult.data.search_id,
        started_at: sessionResult.data.started_at,
        completed_at: sessionResult.data.completed_at,
        session_notes: sessionResult.data.session_notes,
        searches: Array.isArray(sessionResult.data.searches)
          ? sessionResult.data.searches[0] ?? null
          : sessionResult.data.searches ?? null,
      };

      const answers: PracticeHistoryAnswerDetail[] = dedupePracticeAnswersByQuestion(
        (answersResult.data ?? []).map((answer) => ({
          id: answer.id,
          question_id: answer.question_id,
          text_answer: answer.text_answer,
          answer_time_seconds: answer.answer_time_seconds,
          created_at: answer.created_at,
          interview_questions: answer.interview_questions
            ? {
                ...answer.interview_questions,
                interview_stages: Array.isArray(answer.interview_questions.interview_stages)
                  ? answer.interview_questions.interview_stages[0] ?? null
                  : answer.interview_questions.interview_stages ?? null,
              }
            : null,
        }))
      );

      const questionIds = answers.map((answer) => answer.question_id);
      const flagsResult = questionIds.length > 0
        ? await this.getQuestionFlags(questionIds)
        : { flags: {}, success: true };

      return {
        session,
        answers,
        flags: flagsResult.success ? flagsResult.flags ?? {} : {},
        success: true,
      };
    } catch (error) {
      console.error("Error getting session detail:", error);
      return { error, success: false };
    }
  },

  async getPracticeOverviewStats(searchId?: string) {
    try {
      const user = await getCurrentUser();

      let sessionsQuery = supabase
        .from("practice_sessions")
        .select("id")
        .eq("user_id", user.id)
        .not("completed_at", "is", null);

      if (searchId) {
        sessionsQuery = sessionsQuery.eq("search_id", searchId);
      }

      const { data: sessions, error: sessionsError } = await sessionsQuery;

      if (sessionsError) throw sessionsError;

      const sessionIds = (sessions ?? []).map((session) => session.id);

      if (sessionIds.length === 0) {
        return { stats: EMPTY_PRACTICE_OVERVIEW_STATS, success: true };
      }

      const { data: answers, error: answersError } = await supabase
        .from("practice_answers")
        .select("session_id, question_id, answer_time_seconds, created_at")
        .in("session_id", sessionIds);

      if (answersError) throw answersError;

      const dedupedAnswers = dedupePracticeAnswersBySessionQuestion(answers ?? []);
      const questionIds = Array.from(new Set(dedupedAnswers.map((answer) => answer.question_id)));
      let needsWorkCount = 0;

      if (questionIds.length > 0) {
        const { data: flags, error: flagsError } = await supabase
          .from("user_question_flags")
          .select("question_id")
          .eq("user_id", user.id)
          .eq("flag_type", "needs_work")
          .in("question_id", questionIds);

        if (flagsError) throw flagsError;

        needsWorkCount = new Set((flags ?? []).map((flag) => flag.question_id)).size;
      }

      const stats: PracticeHistoryOverviewStats = {
        totalSessions: sessionIds.length,
        totalQuestionsAnswered: dedupedAnswers.length,
        totalTimeSeconds: dedupedAnswers.reduce(
          (total, answer) => total + (answer.answer_time_seconds ?? 0),
          0
        ),
        needsWorkCount,
      };

      return { stats, success: true };
    } catch (error) {
      console.error("Error getting practice overview stats:", error);
      return { error, success: false };
    }
  },

  async createPracticeSession(searchId: string) {
    try {
      const { data: user } = await supabase.auth.getUser();
      
      if (!user.user) throw new Error("No authenticated user");
      
      const { data: session, error } = await supabase
        .from("practice_sessions")
        .insert({
          search_id: searchId,
          user_id: user.user.id
        })
        .select()
        .single();

      if (error) throw error;

      return { session, success: true };
    } catch (error) {
      console.error("Error creating practice session:", error);
      return { error, success: false };
    }
  },

  async savePracticeAnswer({ sessionId, questionId, textAnswer, audioUrl, transcriptText, answerTime }: {
    sessionId: string;
    questionId: string;
    textAnswer?: string;
    audioUrl?: string;
    transcriptText?: string;
    answerTime?: number;
  }) {
    try {
      const { data: existingAnswers, error: existingError } = await supabase
        .from("practice_answers")
        .select("id, created_at")
        .eq("session_id", sessionId)
        .eq("question_id", questionId)
        .order("created_at", { ascending: false });

      if (existingError) throw existingError;

      if (existingAnswers && existingAnswers.length > 0) {
        const [latestAnswer, ...staleAnswers] = existingAnswers;

        if (staleAnswers.length > 0) {
          const { error: deleteError } = await supabase
            .from("practice_answers")
            .delete()
            .in("id", staleAnswers.map((answer) => answer.id));

          if (deleteError) throw deleteError;
        }

        const { data, error } = await supabase
          .from("practice_answers")
          .update({
            text_answer: textAnswer,
            audio_path: audioUrl,
            transcript_text: transcriptText,
            answer_time_seconds: answerTime,
          })
          .eq("id", latestAnswer.id)
          .select()
          .single();

        if (error) throw error;

        return { answer: data, success: true };
      }

      const { data, error } = await supabase
        .from("practice_answers")
        .insert({
          session_id: sessionId,
          question_id: questionId,
          text_answer: textAnswer,
          audio_path: audioUrl,
          transcript_text: transcriptText,
          answer_time_seconds: answerTime,
        })
        .select()
        .single();

      if (error) throw error;

      return { answer: data, success: true };
    } catch (error) {
      console.error("Error saving practice answer:", error);
      return { error, success: false };
    }
  },

  async uploadPracticeAudio(file: File, path: string) {
    try {
      const { data, error } = await supabase.storage
        .from(PRACTICE_AUDIO_BUCKET)
        .upload(path, file, {
          contentType: file.type,
          upsert: true,
        });

      if (error) throw error;

      return { path: data.path, success: true };
    } catch (error) {
      console.error("Error uploading practice audio:", error);
      return { error, success: false };
    }
  },

  async transcribePracticeAudio({
    path,
    mimeType,
    fileName,
  }: {
    path: string;
    mimeType?: string;
    fileName?: string;
  }) {
    try {
      const response = await supabase.functions.invoke("practice-audio-transcribe", {
        body: { path, mimeType, fileName },
      });

      if (response.error) throw new Error(response.error.message);

      return {
        transcript: response.data?.transcript ?? "",
        success: true,
      };
    } catch (error) {
      console.error("Error transcribing practice audio:", error);
      return { error, success: false };
    }
  },

  async getResume(userId: string) {
    try {
      const { data, error } = await supabase
        .from("resumes")
        .select("*")
        .eq("user_id", userId)
        .is("search_id", null)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      const resume = data && data.length > 0 ? data[0] : null;

      return { resume, success: true };
    } catch (error) {
      console.error("Error getting resume:", error);
      return { error, success: false };
    }
  },

  async analyzeCV(cvText: string) {
    try {
      const user = await getCurrentUser();
      
      const response = await supabase.functions.invoke("cv-analysis", {
        body: {
          cvText,
          userId: user.id
        }
      });

      if (response.error) throw new Error(response.error.message);

      return {
        success: true,
        parsedData: response.data.parsedData,
        aiAnalysis: response.data.aiAnalysis
      };
    } catch (error) {
      console.error("Error analyzing CV:", error);
      return { error, success: false };
    }
  },

  async uploadResumeFile(file: File, path: string) {
    try {
      const { data, error } = await supabase.storage
        .from(RESUME_FILES_BUCKET)
        .upload(path, file, {
          contentType: file.type,
          upsert: true,
        });

      if (error) throw error;

      return { path: data.path, success: true };
    } catch (error) {
      console.error("Error uploading resume file:", error);
      return { error, success: false };
    }
  },

  async deleteResumeFiles(paths: string[]) {
    const uniquePaths = Array.from(new Set(paths.filter(Boolean)));

    if (uniquePaths.length === 0) {
      return { success: true };
    }

    try {
      const { error } = await supabase.storage
        .from(RESUME_FILES_BUCKET)
        .remove(uniquePaths);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error("Error deleting resume files:", error);
      return { error, success: false };
    }
  },

  async saveResume({
    content,
    parsedData,
    file,
    source,
  }: {
    content: string;
    parsedData?: Record<string, unknown>;
    file?: ResumeFileInput;
    source?: ResumeSource;
  }) {
    try {
      if (typeof supabase.rpc !== "function") {
        const user = await getCurrentUser();
        const nextSource = source ?? (file ? "upload" : "manual");

        const { data: activeResumes, error: existingError } = await supabase
          .from("resumes")
          .select("id, file_name, file_path, file_size_bytes, mime_type, parsed_data")
          .eq("user_id", user.id)
          .is("search_id", null)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1);

        if (existingError) throw existingError;

        const currentResume = activeResumes?.[0] ?? null;
        const nextFile =
          file ??
          (nextSource === "upload" && currentResume?.file_path
            ? {
                name: currentResume.file_name,
                path: currentResume.file_path,
                size: currentResume.file_size_bytes,
                mimeType: currentResume.mime_type,
              }
            : null);
        const nextParsedData =
          parsedData === undefined
            ? (buildResumeParsedDataFallback(content) as Json)
            : ((parsedData as Json) ?? null);

        const { data, error } = await supabase
          .from("resumes")
          .insert({
            content,
            parsed_data: nextParsedData,
            user_id: user.id,
            file_name: nextFile?.name ?? null,
            file_path: nextFile?.path ?? null,
            file_size_bytes: nextFile?.size ?? null,
            mime_type: nextFile?.mimeType ?? null,
            source: nextSource,
            is_active: currentResume ? false : true,
            superseded_at: null,
          })
          .select()
          .single();

        if (error) throw error;

        if (!currentResume) {
          return { resume: data, success: true };
        }

        const supersededAt = new Date().toISOString();
        const { error: deactivateError } = await supabase
          .from("resumes")
          .update({
            is_active: false,
            superseded_at: supersededAt,
          })
          .eq("id", currentResume.id);

        if (deactivateError) {
          await supabase.from("resumes").delete().eq("id", data.id);
          throw deactivateError;
        }

        const { data: activatedResume, error: activateError } = await supabase
          .from("resumes")
          .update({
            is_active: true,
            superseded_at: null,
          })
          .eq("id", data.id)
          .select()
          .single();

        if (activateError) {
          await Promise.all([
            supabase.from("resumes").delete().eq("id", data.id),
            supabase
              .from("resumes")
              .update({
                is_active: true,
                superseded_at: null,
              })
              .eq("id", currentResume.id),
          ]);
          throw activateError;
        }

        return { resume: activatedResume, success: true };
      }

      const nextSource = source ?? (file ? "upload" : "manual");
      const nextParsedData =
        parsedData === undefined
          ? (buildResumeParsedDataFallback(content) as Json)
          : ((parsedData as Json) ?? null);

      const { data, error } = await supabase.rpc("save_resume_version", {
        p_content: content,
        p_parsed_data: nextParsedData as never,
        p_file_name: file?.name ?? null,
        p_file_path: file?.path ?? null,
        p_file_size_bytes: file?.size ?? null,
        p_mime_type: file?.mimeType ?? null,
        p_source: nextSource,
      });

      if (error) throw error;

      return { resume: Array.isArray(data) ? data[0] : data, success: true };
    } catch (error) {
      console.error("Error saving resume:", error);
      return { error, success: false };
    }
  },

  async deleteResume() {
    try {
      const user = await getCurrentUser();

      const { data: resumes, error: fetchError } = await supabase
        .from("resumes")
        .select("id, file_path")
        .eq("user_id", user.id)
        .is("search_id", null);

      if (fetchError) throw fetchError;

      if (!resumes || resumes.length === 0) {
        return { success: true };
      }

      const paths = resumes
        .map((resume) => resume.file_path)
        .filter((path): path is string => Boolean(path));

      if (paths.length > 0) {
        const fileDeleteResult = await this.deleteResumeFiles(paths);
        if (!fileDeleteResult.success) {
          throw fileDeleteResult.error ?? new Error("Failed to delete stored resume files");
        }
      }

      const { error: deleteError } = await supabase
        .from("resumes")
        .delete()
        .in("id", resumes.map((resume) => resume.id));

      if (deleteError) throw deleteError;

      const { error: importDeleteError } = await supabase
        .from("profile_imports")
        .delete()
        .eq("user_id", user.id);

      if (importDeleteError) throw importDeleteError;

      await supabase
        .from("candidate_profiles")
        .update({ last_resume_id: null })
        .eq("user_id", user.id);

      return { success: true };
    } catch (error) {
      console.error("Error deleting resume:", error);
      return { error, success: false };
    }
  },

  async listResumeVersions() {
    try {
      const user = await getCurrentUser();

      const { data, error } = await supabase
        .from("resumes")
        .select("*")
        .eq("user_id", user.id)
        .is("search_id", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return {
        resumes: (data || []) as ResumeRecord[],
        success: true,
      };
    } catch (error) {
      console.error("Error listing resume versions:", error);
      return { error, success: false };
    }
  },

  async getProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, level, created_at, updated_at")
        .eq("id", userId)
        .single();

      if (error) throw error;

      return { profile: data, success: true };
    } catch (error) {
      console.error("Error getting profile:", error);
      return { error, success: false };
    }
  },

  async getCandidateProfile() {
    try {
      const user = await getCurrentUser();

      const { data, error } = await supabase
        .from("candidate_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      return {
        profile: normalizeCandidateProfileRecord(data, user.id),
        success: true,
      };
    } catch (error) {
      console.error("Error getting candidate profile:", error);
      return { error, success: false };
    }
  },

  async saveCandidateProfile(patch: Partial<CandidateProfile>) {
    try {
      const user = await getCurrentUser();
      const { data: existing, error: existingError } = await supabase
        .from("candidate_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingError) throw existingError;

      const currentProfile =
        normalizeCandidateProfileRecord(existing, user.id) ?? createEmptyCandidateProfile(user.id);
      const nextProfile = normalizeCandidateProfile(
        {
          ...currentProfile,
          ...patch,
          userId: user.id,
          preferences: {
            ...currentProfile.preferences,
            ...patch.preferences,
          },
          lastResumeId:
            patch.lastResumeId === undefined ? currentProfile.lastResumeId : patch.lastResumeId,
        },
        user.id,
      );

      const { data, error } = await supabase
        .from("candidate_profiles")
        .upsert(toCandidateProfileRow(nextProfile), { onConflict: "user_id" })
        .select()
        .single();

      if (error) throw error;

      return {
        profile: normalizeCandidateProfileRecord(data, user.id),
        success: true,
      };
    } catch (error) {
      console.error("Error saving candidate profile:", error);
      return { error, success: false };
    }
  },

  async getLatestProfileImport(status: "pending" | "applied" | "dismissed" | "failed" = "pending") {
    try {
      const user = await getCurrentUser();
      const { data, error } = await supabase
        .from("profile_imports")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      return {
        profileImport: normalizeProfileImportRecord(data?.[0] ?? null, user.id),
        success: true,
      };
    } catch (error) {
      console.error("Error loading latest profile import:", error);
      return { error, success: false };
    }
  },

  async createProfileImport({
    resumeText,
    resumeId,
    source,
    existingProfile,
  }: {
    resumeText: string;
    resumeId?: string | null;
    source?: ResumeSource;
    existingProfile?: CandidateProfile | null;
  }) {
    try {
      const user = await getCurrentUser();
      const response = await supabase.functions.invoke("profile-import", {
        body: {
          resumeText,
          userId: user.id,
          resumeId: resumeId ?? null,
          source: source ?? "manual",
          existingProfile: existingProfile ?? undefined,
        },
      });

      if (response.error) throw new Error(response.error.message);

      return {
        profileImport: normalizeProfileImportRecord(response.data.profileImport, user.id),
        draftProfile: normalizeCandidateProfile(response.data.draftProfile, user.id),
        mergeSuggestions: (response.data.mergeSuggestions || []) as ProfileImportSuggestion[],
        importSummary: response.data.importSummary,
        success: true,
      };
    } catch (error) {
      console.error("Error creating profile import:", error);
      return { error, success: false };
    }
  },

  async applyProfileImport(importId: string, decisions: ProfileMergeDecision[]) {
    try {
      const user = await getCurrentUser();
      const [{ data: importRow, error: importError }, { data: profileRow, error: profileError }] =
        await Promise.all([
          supabase
            .from("profile_imports")
            .select("*")
            .eq("id", importId)
            .eq("user_id", user.id)
            .eq("status", "pending")
            .maybeSingle(),
          supabase
            .from("candidate_profiles")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

      if (importError) throw importError;
      if (profileError) throw profileError;

      const profileImport = normalizeProfileImportRecord(importRow, user.id);
      if (!profileImport) {
        throw new Error("Profile import not found or is no longer pending");
      }

      const currentProfile =
        normalizeCandidateProfileRecord(profileRow, user.id) ?? createEmptyCandidateProfile(user.id);
      const mergedProfile = mergeImportedProfile(
        currentProfile,
        profileImport.draftProfile,
        profileImport.mergeSuggestions,
        decisions,
      );
      const saveResult = await this.saveCandidateProfile({
        ...mergedProfile,
        lastResumeId: profileImport.resumeId ?? mergedProfile.lastResumeId,
      });

      if (!saveResult.success || !saveResult.profile) {
        throw saveResult.error ?? new Error("Failed to save merged profile");
      }

      const { data: updatedImport, error: updateError } = await supabase
        .from("profile_imports")
        .update({
          status: "applied",
          applied_at: new Date().toISOString(),
        })
        .eq("id", importId)
        .eq("status", "pending")
        .select()
        .single();

      if (updateError) throw updateError;

      return {
        profile: saveResult.profile,
        profileImport: normalizeProfileImportRecord(updatedImport, user.id),
        success: true,
      };
    } catch (error) {
      console.error("Error applying profile import:", error);
      return { error, success: false };
    }
  },

  async updateProfile({ level }: { level?: 'junior' | 'mid' | 'senior_ic' | 'people_manager' }) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error("No authenticated user");
      }
      
      const { data, error } = await supabase
        .from("profiles")
        .update({ level })
        .eq("id", user.id)
        .select()
        .single();

      if (error) throw error;

      return { profile: data, success: true };
    } catch (error) {
      console.error("Error updating profile:", error);
      return { error, success: false };
    }
  },

  // Question Flag Methods (Epic 1.3)
  async setQuestionFlag(questionId: string, flagType: 'favorite' | 'needs_work' | 'skipped') {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error("No authenticated user");
      }

      // Upsert flag (insert or update if exists)
      const { data, error } = await supabase
        .from("user_question_flags")
        .upsert({
          user_id: user.id,
          question_id: questionId,
          flag_type: flagType,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,question_id'
        })
        .select()
        .single();

      if (error) throw error;

      return { flag: data, success: true };
    } catch (error) {
      console.error("Error setting question flag:", error);
      return { error, success: false };
    }
  },

  async removeQuestionFlag(questionId: string) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error("No authenticated user");
      }

      const { error } = await supabase
        .from("user_question_flags")
        .delete()
        .eq("user_id", user.id)
        .eq("question_id", questionId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error("Error removing question flag:", error);
      return { error, success: false };
    }
  },

  async getQuestionFlags(questionIds: string[]) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error("No authenticated user");
      }

      const { data, error } = await supabase
        .from("user_question_flags")
        .select("*")
        .eq("user_id", user.id)
        .in("question_id", questionIds);

      if (error) throw error;

      // Convert to map for easy lookup
      const flagsMap: PracticeQuestionFlagMap = {};
      (data || []).forEach(flag => {
        flagsMap[flag.question_id] = {
          flag_type: flag.flag_type,
          id: flag.id
        };
      });

      return { flags: flagsMap, success: true };
    } catch (error) {
      console.error("Error getting question flags:", error);
      return { error, success: false };
    }
  },

  async savePracticeSessionNotes(sessionId: string, sessionNotes?: string) {
    try {
      const { data, error } = await supabase
        .from("practice_sessions")
        .update({
          session_notes: sessionNotes?.trim() ? sessionNotes.trim() : null,
        })
        .eq("id", sessionId)
        .select()
        .single();

      if (error) throw error;

      return { session: data, success: true };
    } catch (error) {
      console.error("Error saving practice session notes:", error);
      return { error, success: false };
    }
  },

  // Epic 2.4: Complete practice session and save notes
  async completePracticeSession(sessionId: string) {
    try {
      const { data: existingSession, error: existingSessionError } = await supabase
        .from("practice_sessions")
        .select("*")
        .eq("id", sessionId)
        .single();

      if (existingSessionError) throw existingSessionError;

      if (existingSession.completed_at) {
        return { session: existingSession, success: true };
      }

      const { data, error } = await supabase
        .from("practice_sessions")
        .update({
          completed_at: new Date().toISOString(),
        })
        .eq("id", sessionId)
        .is("completed_at", null)
        .select()
        .single();

      if (error) {
        const { data: currentSession, error: currentSessionError } = await supabase
          .from("practice_sessions")
          .select("*")
          .eq("id", sessionId)
          .single();

        if (!currentSessionError && currentSession.completed_at) {
          return { session: currentSession, success: true };
        }

        throw error;
      }

      return { session: data, success: true };
    } catch (error) {
      console.error("Error completing practice session:", error);
      return { error, success: false };
    }
  },
};
