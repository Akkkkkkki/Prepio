import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";

interface CreateSearchParams {
  company: string;
  role?: string;
  country?: string;
  roleLinks?: string;
  cv?: string;
  targetSeniority?: 'junior' | 'mid' | 'senior';
}

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

const EMPTY_PRACTICE_OVERVIEW_STATS: PracticeHistoryOverviewStats = {
  totalSessions: 0,
  totalQuestionsAnswered: 0,
  totalTimeSeconds: 0,
  needsWorkCount: 0,
};

const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("No authenticated user");
  }

  return user;
};

export const searchService = {
  // Step 1: Create search record only (fast, synchronous)
  async createSearchRecord({ company, role, country, roleLinks, cv, targetSeniority }: CreateSearchParams) {
    try {
      // Get the current user first
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error("No authenticated user");
      }

      // Create a search record with user_id (status: pending)
      const { data: searchData, error: searchError } = await supabase
        .from("searches")
        .insert({
          user_id: user.id,
          company,
          role,
          country,
          role_links: roleLinks,
          target_seniority: targetSeniority,
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
  async startProcessing(searchId: string, { company, role, country, roleLinks, cv, targetSeniority }: CreateSearchParams) {
    try {
      // Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("No authenticated user");
      }

      // Update search status to processing
      await supabase
        .from("searches")
        .update({ status: "processing" })
        .eq("id", searchId);

      // Call the edge function to process the search (async, no await)
      supabase.functions.invoke("interview-research", {
        body: {
          company,
          role,
          country,
          roleLinks: roleLinks ? roleLinks.split("\n").filter(link => link.trim()) : [],
          cv,
          targetSeniority,
          userId: user.id,
          searchId,
        }
      }).then(response => {
        if (response.error) {
          console.error("Edge function error:", response.error);
          // Update status to failed if edge function fails
          supabase
            .from("searches")
            .update({ status: "failed" })
            .eq("id", searchId);
        }
        // If successful, the edge function will update status to "completed"
      }).catch(error => {
        console.error("Error calling edge function:", error);
        // Update status to failed if call fails
        supabase
          .from("searches")
          .update({ status: "failed" })
          .eq("id", searchId);
      });

      return { success: true };
    } catch (error) {
      console.error("Error starting processing:", error);
      
      // Update status to failed
      await supabase
        .from("searches")
        .update({ status: "failed" })
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
      // Get the search record with enhanced data
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

      // Get comparison analysis from search_artifacts (consolidated after Option B redesign)
      const { data: artifact, error: artifactError } = await supabase
        .from("search_artifacts")
        .select("comparison_analysis, preparation_guidance")
        .eq("search_id", searchId)
        .single();

      // Handle missing artifact data gracefully
      // PGRST116 = not found (record doesn't exist)
      if (artifactError && artifactError.code !== 'PGRST116') {
        console.warn("Search artifacts query error:", artifactError.message || artifactError);
      }

      // Extract comparison analysis and preparation guidance from artifact
      const cvJobComparison = artifact?.comparison_analysis || null;
      const preparationGuidance = artifact?.preparation_guidance || null;

      return {
        search,
        stages: stagesWithQuestions,
        cvJobComparison,
        preparationGuidance,
        success: true
      };
    } catch (error) {
      console.error("Error getting search results:", error);
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

      const sessions: PracticeHistorySession[] = (data ?? []).map((session) => ({
        id: session.id,
        search_id: session.search_id,
        started_at: session.started_at,
        completed_at: session.completed_at,
        session_notes: session.session_notes,
        searches: Array.isArray(session.searches)
          ? session.searches[0] ?? null
          : session.searches ?? null,
        practice_answers: (session.practice_answers ?? []).map((answer) => ({
          id: answer.id,
          question_id: answer.question_id,
          answer_time_seconds: answer.answer_time_seconds,
          created_at: answer.created_at,
        })),
      }));

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

      const answers: PracticeHistoryAnswerDetail[] = (answersResult.data ?? []).map((answer) => ({
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
      }));

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
        .select("session_id, question_id, answer_time_seconds")
        .in("session_id", sessionIds);

      if (answersError) throw answersError;

      const questionIds = Array.from(new Set((answers ?? []).map((answer) => answer.question_id)));
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
        totalQuestionsAnswered: answers?.length ?? 0,
        totalTimeSeconds: (answers ?? []).reduce(
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

  async savePracticeAnswer({ sessionId, questionId, textAnswer, audioUrl, answerTime }: {
    sessionId: string;
    questionId: string;
    textAnswer?: string;
    audioUrl?: string;
    answerTime?: number;
  }) {
    try {
      const { data, error } = await supabase
        .from("practice_answers")
        .insert({
          session_id: sessionId,
          question_id: questionId,
          text_answer: textAnswer,
          audio_url: audioUrl,
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

  async getResume(userId: string) {
    try {
      const { data, error } = await supabase
        .from("resumes")
        .select("*")
        .eq("user_id", userId)
        .is("search_id", null)
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
      const user = await getCurrentUser();

      const { data: existingResumes, error: existingError } = await supabase
        .from("resumes")
        .select("id, file_name, file_path, file_size_bytes, mime_type")
        .eq("user_id", user.id)
        .is("search_id", null)
        .order("created_at", { ascending: false });

      if (existingError) throw existingError;

      const currentResume = existingResumes?.[0] ?? null;
      const nextFile = file ?? (currentResume?.file_path
        ? {
            name: currentResume.file_name,
            path: currentResume.file_path,
            size: currentResume.file_size_bytes,
            mimeType: currentResume.mime_type,
          }
        : null);

      const { data, error } = await supabase
        .from("resumes")
        .insert({
          content,
          parsed_data: (parsedData as Json) || null,
          user_id: user.id,
          file_name: nextFile?.name ?? null,
          file_path: nextFile?.path ?? null,
          file_size_bytes: nextFile?.size ?? null,
          mime_type: nextFile?.mimeType ?? null,
          source: source ?? (nextFile ? "upload" : "manual"),
        })
        .select()
        .single();

      if (error) throw error;

      if (existingResumes && existingResumes.length > 0) {
        const idsToDelete = existingResumes.map((resume) => resume.id);
        const pathsToDelete = existingResumes
          .map((resume) => resume.file_path)
          .filter((path): path is string => Boolean(path && path !== nextFile?.path));

        if (pathsToDelete.length > 0) {
          const cleanupFiles = await this.deleteResumeFiles(pathsToDelete);
          if (!cleanupFiles.success) {
            console.warn("Failed to clean up previous resume files:", cleanupFiles.error);
          }
        }

        const { error: deleteError } = await supabase
          .from("resumes")
          .delete()
          .in("id", idsToDelete);

        if (deleteError) {
          console.warn("Failed to clean up previous resume rows:", deleteError);
        }
      }

      return { resume: data, success: true };
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
          console.warn("Failed to delete stored resume files:", fileDeleteResult.error);
        }
      }

      const { error: deleteError } = await supabase
        .from("resumes")
        .delete()
        .in("id", resumes.map((resume) => resume.id));

      if (deleteError) throw deleteError;

      return { success: true };
    } catch (error) {
      console.error("Error deleting resume:", error);
      return { error, success: false };
    }
  },

  async getProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;

      return { profile: data, success: true };
    } catch (error) {
      console.error("Error getting profile:", error);
      return { error, success: false };
    }
  },

  async updateProfile({ seniority }: { seniority?: 'junior' | 'mid' | 'senior' }) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error("No authenticated user");
      }
      
      const { data, error } = await supabase
        .from("profiles")
        .update({ seniority })
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

  // Epic 2.4: Complete practice session and save notes
  async completePracticeSession(sessionId: string, sessionNotes?: string) {
    try {
      const { data, error } = await supabase
        .from("practice_sessions")
        .update({
          completed_at: new Date().toISOString(),
          session_notes: sessionNotes || null,
        })
        .eq("id", sessionId)
        .select()
        .single();

      if (error) throw error;

      return { session: data, success: true };
    } catch (error) {
      console.error("Error completing practice session:", error);
      return { error, success: false };
    }
  },
};
