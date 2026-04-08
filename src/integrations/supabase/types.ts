export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      interview_questions: {
        Row: {
          category: string
          company_context: string | null
          created_at: string
          depth_label: string | null
          difficulty: string
          evaluation_criteria: string[] | null
          follow_up_questions: string[] | null
          good_answer_signals: string[] | null
          id: string
          question: string
          rationale: string | null
          sample_answer_outline: string | null
          search_id: string
          seniority_expectation: string | null
          stage_id: string
          star_story_fit: boolean | null
          suggested_answer_approach: string | null
          weak_answer_signals: string[] | null
        }
        Insert: {
          category: string
          company_context?: string | null
          created_at?: string
          depth_label?: string | null
          difficulty: string
          evaluation_criteria?: string[] | null
          follow_up_questions?: string[] | null
          good_answer_signals?: string[] | null
          id?: string
          question: string
          rationale?: string | null
          sample_answer_outline?: string | null
          search_id: string
          seniority_expectation?: string | null
          stage_id: string
          star_story_fit?: boolean | null
          suggested_answer_approach?: string | null
          weak_answer_signals?: string[] | null
        }
        Update: {
          category?: string
          company_context?: string | null
          created_at?: string
          depth_label?: string | null
          difficulty?: string
          evaluation_criteria?: string[] | null
          follow_up_questions?: string[] | null
          good_answer_signals?: string[] | null
          id?: string
          question?: string
          rationale?: string | null
          sample_answer_outline?: string | null
          search_id?: string
          seniority_expectation?: string | null
          stage_id?: string
          star_story_fit?: boolean | null
          suggested_answer_approach?: string | null
          weak_answer_signals?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_questions_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_questions_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "interview_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_stages: {
        Row: {
          content: string | null
          created_at: string
          duration: string | null
          guidance: string | null
          id: string
          interviewer: string | null
          name: string
          order_index: number
          search_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          duration?: string | null
          guidance?: string | null
          id?: string
          interviewer?: string | null
          name: string
          order_index: number
          search_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          duration?: string | null
          guidance?: string | null
          id?: string
          interviewer?: string | null
          name?: string
          order_index?: number
          search_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_stages_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_answers: {
        Row: {
          answer_time_seconds: number | null
          created_at: string
          id: string
          question_id: string
          session_id: string
          text_answer: string | null
        }
        Insert: {
          answer_time_seconds?: number | null
          created_at?: string
          id?: string
          question_id: string
          session_id: string
          text_answer?: string | null
        }
        Update: {
          answer_time_seconds?: number | null
          created_at?: string
          id?: string
          question_id?: string
          session_id?: string
          text_answer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practice_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "interview_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practice_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "practice_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_sessions: {
        Row: {
          completed_at: string | null
          id: string
          search_id: string
          session_notes: string | null
          started_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          search_id: string
          session_notes?: string | null
          started_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          search_id?: string
          session_notes?: string | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_sessions_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_profiles: {
        Row: {
          certifications: Json
          completion_score: number
          created_at: string
          education: Json
          experiences: Json
          headline: string
          languages: Json
          last_resume_id: string | null
          links: Json
          location: string
          preferences: Json
          projects: Json
          skills: Json
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          certifications?: Json
          completion_score?: number
          created_at?: string
          education?: Json
          experiences?: Json
          headline?: string
          languages?: Json
          last_resume_id?: string | null
          links?: Json
          location?: string
          preferences?: Json
          projects?: Json
          skills?: Json
          summary?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          certifications?: Json
          completion_score?: number
          created_at?: string
          education?: Json
          experiences?: Json
          headline?: string
          languages?: Json
          last_resume_id?: string | null
          links?: Json
          location?: string
          preferences?: Json
          projects?: Json
          skills?: Json
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_profiles_last_resume_id_fkey"
            columns: ["last_resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          seniority: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          seniority?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          seniority?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profile_imports: {
        Row: {
          applied_at: string | null
          created_at: string
          draft_profile: Json
          id: string
          import_summary: Json
          merge_suggestions: Json
          resume_id: string | null
          source: string
          status: string
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          created_at?: string
          draft_profile?: Json
          id?: string
          import_summary?: Json
          merge_suggestions?: Json
          resume_id?: string | null
          source?: string
          status?: string
          user_id: string
        }
        Update: {
          applied_at?: string | null
          created_at?: string
          draft_profile?: Json
          id?: string
          import_summary?: Json
          merge_suggestions?: Json
          resume_id?: string | null
          source?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_imports_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      resumes: {
        Row: {
          content: string
          created_at: string
          file_name: string | null
          file_path: string | null
          file_size_bytes: number | null
          id: string
          is_active: boolean
          mime_type: string | null
          parsed_data: Json | null
          search_id: string | null
          source: string
          superseded_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          is_active?: boolean
          mime_type?: string | null
          parsed_data?: Json | null
          search_id?: string | null
          source?: string
          superseded_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          file_name?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          id?: string
          is_active?: boolean
          mime_type?: string | null
          parsed_data?: Json | null
          search_id?: string | null
          source?: string
          superseded_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resumes_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["id"]
          },
        ]
      }
      scraped_urls: {
        Row: {
          ai_summary: string | null
          company_name: string
          content_quality_score: number | null
          created_at: string
          domain: string | null
          first_scraped_at: string | null
          full_content: string | null
          id: string
          last_reused_at: string | null
          role_title: string | null
          times_reused: number | null
          title: string | null
          url: string
          url_hash: string
        }
        Insert: {
          ai_summary?: string | null
          company_name: string
          content_quality_score?: number | null
          created_at?: string
          domain?: string | null
          first_scraped_at?: string | null
          full_content?: string | null
          id?: string
          last_reused_at?: string | null
          role_title?: string | null
          times_reused?: number | null
          title?: string | null
          url: string
          url_hash: string
        }
        Update: {
          ai_summary?: string | null
          company_name?: string
          content_quality_score?: number | null
          created_at?: string
          domain?: string | null
          first_scraped_at?: string | null
          full_content?: string | null
          id?: string
          last_reused_at?: string | null
          role_title?: string | null
          times_reused?: number | null
          title?: string | null
          url?: string
          url_hash?: string
        }
        Relationships: []
      }
      search_artifacts: {
        Row: {
          comparison_analysis: Json | null
          created_at: string
          id: string
          preparation_guidance: Json | null
          raw_research: Json | null
          search_id: string
          user_id: string
        }
        Insert: {
          comparison_analysis?: Json | null
          created_at?: string
          id?: string
          preparation_guidance?: Json | null
          raw_research?: Json | null
          search_id: string
          user_id: string
        }
        Update: {
          comparison_analysis?: Json | null
          created_at?: string
          id?: string
          preparation_guidance?: Json | null
          raw_research?: Json | null
          search_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_artifacts_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: true
            referencedRelation: "searches"
            referencedColumns: ["id"]
          },
        ]
      }
      searches: {
        Row: {
          company: string
          completed_at: string | null
          country: string | null
          created_at: string
          error_message: string | null
          id: string
          progress_pct: number | null
          progress_step: string | null
          role: string | null
          role_links: string | null
          started_at: string | null
          status: string
          target_seniority: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company: string
          completed_at?: string | null
          country?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          progress_pct?: number | null
          progress_step?: string | null
          role?: string | null
          role_links?: string | null
          started_at?: string | null
          status?: string
          target_seniority?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string
          completed_at?: string | null
          country?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          progress_pct?: number | null
          progress_step?: string | null
          role?: string | null
          role_links?: string | null
          started_at?: string | null
          status?: string
          target_seniority?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tavily_searches: {
        Row: {
          api_type: string
          created_at: string
          credits_used: number | null
          error_message: string | null
          id: string
          query_text: string
          request_duration_ms: number | null
          response_status: number
          results_count: number | null
          search_id: string | null
        }
        Insert: {
          api_type: string
          created_at?: string
          credits_used?: number | null
          error_message?: string | null
          id?: string
          query_text: string
          request_duration_ms?: number | null
          response_status: number
          results_count?: number | null
          search_id?: string | null
        }
        Update: {
          api_type?: string
          created_at?: string
          credits_used?: number | null
          error_message?: string | null
          id?: string
          query_text?: string
          request_duration_ms?: number | null
          response_status?: number
          results_count?: number | null
          search_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tavily_searches_search_id_fkey"
            columns: ["search_id"]
            isOneToOne: false
            referencedRelation: "searches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_question_flags: {
        Row: {
          created_at: string | null
          flag_type: string
          id: string
          question_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          flag_type: string
          id?: string
          question_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          flag_type?: string
          id?: string
          question_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_question_flags_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "interview_questions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      update_search_progress: {
        Args: {
          error_msg?: string
          new_percentage?: number
          new_status?: string
          new_step?: string
          search_uuid: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
