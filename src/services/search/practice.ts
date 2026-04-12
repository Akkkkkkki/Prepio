import { getCurrentUser, PRACTICE_AUDIO_BUCKET, supabase } from "./shared";

export interface PracticeSessionRow {
  id: string;
  user_id: string;
  search_id: string;
  started_at: string;
  completed_at?: string | null;
  session_notes?: string | null;
}

export interface PracticeAnswerSaveParams {
  sessionId: string;
  questionId: string;
  textAnswer?: string;
  audioUrl?: string;
  transcriptText?: string;
  answerTime?: number;
}

export const practiceService = {
  async createPracticeSession(searchId: string) {
    try {
      const user = await getCurrentUser();

      const { data: session, error } = await supabase
        .from("practice_sessions")
        .insert({
          search_id: searchId,
          user_id: user.id,
        } as never)
        .select()
        .single();

      if (error) throw error;

      return { session, success: true };
    } catch (error) {
      console.error("Error creating practice session:", error);
      return { error, success: false };
    }
  },

  async savePracticeAnswer({
    sessionId,
    questionId,
    textAnswer,
    audioUrl,
    transcriptText,
    answerTime,
  }: PracticeAnswerSaveParams) {
    try {
      const { data: existingAnswer, error: existingError } = await supabase
        .from("practice_answers")
        .select("*")
        .eq("session_id", sessionId)
        .eq("question_id", questionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existingAnswer) {
        const { data, error } = await supabase
          .from("practice_answers")
          .update({
            text_answer: textAnswer,
            audio_path: audioUrl,
            transcript_text: transcriptText,
            answer_time_seconds: answerTime,
          } as never)
          .eq("id", existingAnswer.id)
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
        } as never)
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

  async deletePracticeAudioFiles(paths: string[]) {
    try {
      const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
      if (uniquePaths.length === 0) return { success: true };

      const { error } = await supabase.storage.from(PRACTICE_AUDIO_BUCKET).remove(uniquePaths);
      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error("Error deleting practice audio files:", error);
      return { error, success: false };
    }
  },

  async createPracticeAudioSignedUrl(path: string) {
    try {
      const { data, error } = await supabase.storage
        .from(PRACTICE_AUDIO_BUCKET)
        .createSignedUrl(path, 60 * 60);

      if (error) throw error;
      return { signedUrl: data.signedUrl, success: true };
    } catch (error) {
      console.error("Error creating practice audio signed URL:", error);
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

  async setQuestionFlag(questionId: string, flagType: "favorite" | "needs_work" | "skipped") {
    try {
      const user = await getCurrentUser();
      const { data, error } = await supabase
        .from("user_question_flags")
        .upsert(
          {
            user_id: user.id,
            question_id: questionId,
            flag_type: flagType,
            updated_at: new Date().toISOString(),
          } as never,
          {
            onConflict: "user_id,question_id",
          },
        )
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
      const user = await getCurrentUser();
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
    if (questionIds.length === 0) {
      return { flags: {}, success: true };
    }

    try {
      const user = await getCurrentUser();
      const { data, error } = await supabase
        .from("user_question_flags")
        .select("*")
        .eq("user_id", user.id)
        .in("question_id", questionIds);

      if (error) throw error;

      const flagsMap: Record<string, { flag_type: string; id: string }> = {};
      (data || []).forEach((flag) => {
        flagsMap[flag.question_id] = {
          flag_type: flag.flag_type,
          id: flag.id,
        };
      });

      return { flags: flagsMap, success: true };
    } catch (error) {
      console.error("Error getting question flags:", error);
      return { error, success: false };
    }
  },

  async saveSelfRating(answerId: string, rating: number) {
    try {
      const { error } = await supabase
        .from("practice_answers")
        .update({ self_rating: rating } as never)
        .eq("id", answerId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error("Error saving self rating:", error);
      return { error, success: false };
    }
  },

  async completePracticeSession(sessionId: string, sessionNotes?: string) {
    try {
      const { data, error } = await supabase
        .from("practice_sessions")
        .update({
          completed_at: new Date().toISOString(),
          session_notes: sessionNotes || null,
        } as never)
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

  async getPracticeSessions(searchId?: string) {
    try {
      const user = await getCurrentUser();

      let query = supabase
        .from("practice_sessions")
        .select(`
          *,
          searches (
            company,
            role,
            country
          )
        `)
        .eq("user_id", user.id)
        .order("started_at", { ascending: false });

      if (searchId) {
        query = query.eq("search_id", searchId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return { sessions: data || [], success: true };
    } catch (error) {
      console.error("Error loading practice sessions:", error);
      return { error, success: false };
    }
  },
};
