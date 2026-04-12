


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "ops";


ALTER SCHEMA "ops" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = now();

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_search_progress"("search_uuid" "uuid", "new_status" "text" DEFAULT NULL::"text", "new_step" "text" DEFAULT NULL::"text", "new_percentage" smallint DEFAULT NULL::smallint, "error_msg" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE searches SET
    status         = COALESCE(new_status, status),
    progress_step  = COALESCE(new_step, progress_step),
    progress_pct   = COALESCE(new_percentage, progress_pct),
    error_message  = COALESCE(error_msg, error_message),
    started_at     = CASE WHEN new_status = 'processing' AND started_at IS NULL
                     THEN now() ELSE started_at END,
    completed_at   = CASE WHEN new_status IN ('completed','failed')
                     THEN now() ELSE completed_at END,
    updated_at     = now()
  WHERE id = search_uuid;
END;
$$;


ALTER FUNCTION "public"."update_search_progress"("search_uuid" "uuid", "new_status" "text", "new_step" "text", "new_percentage" smallint, "error_msg" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "ops"."scraped_urls" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "url" "text" NOT NULL,
    "url_hash" "text" NOT NULL,
    "company_name" "text" NOT NULL,
    "role_title" "text",
    "domain" "text",
    "title" "text",
    "full_content" "text",
    "ai_summary" "text",
    "content_quality_score" double precision DEFAULT 0.0,
    "times_reused" integer DEFAULT 0,
    "first_scraped_at" timestamp with time zone DEFAULT "now"(),
    "last_reused_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "ops"."scraped_urls" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "ops"."tavily_searches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "search_id" "uuid",
    "api_type" "text" NOT NULL,
    "query_text" "text" NOT NULL,
    "response_status" integer NOT NULL,
    "results_count" integer DEFAULT 0,
    "request_duration_ms" integer,
    "credits_used" integer DEFAULT 1,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tavily_searches_api_type_check" CHECK (("api_type" = ANY (ARRAY['search'::"text", 'extract'::"text"])))
);


ALTER TABLE "ops"."tavily_searches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."candidate_profiles" (
    "user_id" "uuid" NOT NULL,
    "headline" "text" DEFAULT ''::"text" NOT NULL,
    "summary" "text" DEFAULT ''::"text" NOT NULL,
    "location" "text" DEFAULT ''::"text" NOT NULL,
    "links" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "experiences" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "projects" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "skills" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "education" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "certifications" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "languages" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "preferences" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "completion_score" integer DEFAULT 0 NOT NULL,
    "last_resume_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "candidate_profiles_completion_score_check" CHECK ((("completion_score" >= 0) AND ("completion_score" <= 100)))
);


ALTER TABLE "public"."candidate_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."interview_questions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "search_id" "uuid" NOT NULL,
    "stage_id" "uuid",
    "question" "text" NOT NULL,
    "category" "text" NOT NULL,
    "difficulty" "text" NOT NULL,
    "rationale" "text",
    "suggested_answer_approach" "text",
    "evaluation_criteria" "text"[],
    "follow_up_questions" "text"[],
    "company_context" "text",
    "star_story_fit" boolean DEFAULT false,
    "depth_label" "text",
    "good_answer_signals" "text"[],
    "weak_answer_signals" "text"[],
    "seniority_expectation" "text",
    "sample_answer_outline" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tier" "text",
    "linked_priority" "text",
    "reason" "text",
    "answer_guidance_status" "text" DEFAULT 'pending'::"text",
    CONSTRAINT "interview_questions_answer_guidance_status_check" CHECK (("answer_guidance_status" = ANY (ARRAY['pending'::"text", 'generated'::"text"]))),
    CONSTRAINT "interview_questions_category_check" CHECK (("category" = ANY (ARRAY['behavioral'::"text", 'technical'::"text", 'situational'::"text", 'company_specific'::"text", 'role_specific'::"text", 'experience_based'::"text", 'cultural_fit'::"text", 'case'::"text", 'analytical'::"text", 'leadership'::"text", 'communication'::"text"]))),
    CONSTRAINT "interview_questions_difficulty_check" CHECK (("difficulty" = ANY (ARRAY['Easy'::"text", 'Medium'::"text", 'Hard'::"text"]))),
    CONSTRAINT "interview_questions_tier_check" CHECK (("tier" = ANY (ARRAY['core_must_practice'::"text", 'likely_follow_ups'::"text", 'extra_depth'::"text"])))
);


ALTER TABLE "public"."interview_questions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."interview_stages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "search_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "order_index" integer NOT NULL,
    "duration" "text",
    "interviewer" "text",
    "content" "text",
    "guidance" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "confidence" "text",
    "what_it_tests" "text"[],
    "why_likely" "text",
    "prep_priority" "text",
    "question_themes" "text"[],
    "prep_actions" "text"[],
    "low_confidence_guidance" "text",
    CONSTRAINT "interview_stages_confidence_check" CHECK (("confidence" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"]))),
    CONSTRAINT "interview_stages_prep_priority_check" CHECK (("prep_priority" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"])))
);


ALTER TABLE "public"."interview_stages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."practice_answers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "text_answer" "text",
    "answer_time_seconds" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "self_rating" smallint,
    "audio_path" "text",
    "transcript_text" "text",
    CONSTRAINT "practice_answers_self_rating_check" CHECK ((("self_rating" >= 1) AND ("self_rating" <= 5)))
);


ALTER TABLE "public"."practice_answers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."practice_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "search_id" "uuid" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "session_notes" "text"
);


ALTER TABLE "public"."practice_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prep_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "search_id" "uuid" NOT NULL,
    "summary" "jsonb" NOT NULL,
    "assessment_signals" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "stage_roadmap" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "prep_priorities" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "candidate_positioning" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "practice_sequence" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "question_plan" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "internal_evidence_log" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."prep_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_imports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "resume_id" "uuid",
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "draft_profile" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "merge_suggestions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "import_summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_at" timestamp with time zone,
    CONSTRAINT "profile_imports_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'upload'::"text", 'search_snapshot'::"text"]))),
    CONSTRAINT "profile_imports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'applied'::"text", 'dismissed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."profile_imports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "level" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_level_check" CHECK ((("level" IS NULL) OR ("level" = ANY (ARRAY['junior'::"text", 'mid'::"text", 'senior_ic'::"text", 'people_manager'::"text"]))))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."resumes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "parsed_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "search_id" "uuid",
    "file_name" "text",
    "file_path" "text",
    "file_size_bytes" integer,
    "mime_type" "text",
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "superseded_at" timestamp with time zone,
    CONSTRAINT "resumes_profile_or_snapshot_source_check" CHECK (((("search_id" IS NULL) AND ("source" = ANY (ARRAY['manual'::"text", 'upload'::"text"]))) OR (("search_id" IS NOT NULL) AND ("source" = 'search_snapshot'::"text")))),
    CONSTRAINT "resumes_snapshot_inactive_check" CHECK ((("search_id" IS NULL) OR ("is_active" = false))),
    CONSTRAINT "resumes_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'upload'::"text", 'search_snapshot'::"text"])))
);


ALTER TABLE "public"."resumes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."searches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "company" "text" NOT NULL,
    "role" "text",
    "country" "text",
    "role_links" "text"[] DEFAULT '{}'::"text"[],
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "progress_step" "text" DEFAULT 'Initializing...'::"text",
    "progress_pct" smallint DEFAULT 0,
    "error_message" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "level" "text",
    "user_note" "text",
    "job_description" "text",
    "banner_dismissed" boolean DEFAULT false,
    CONSTRAINT "searches_level_check" CHECK (("level" = ANY (ARRAY['junior'::"text", 'mid'::"text", 'senior_ic'::"text", 'people_manager'::"text", 'unknown'::"text"]))),
    CONSTRAINT "searches_progress_pct_check" CHECK ((("progress_pct" >= 0) AND ("progress_pct" <= 100))),
    CONSTRAINT "searches_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."searches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_question_flags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "question_id" "uuid" NOT NULL,
    "flag_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_question_flags_flag_type_check" CHECK (("flag_type" = ANY (ARRAY['favorite'::"text", 'needs_work'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."user_question_flags" OWNER TO "postgres";


ALTER TABLE ONLY "ops"."scraped_urls"
    ADD CONSTRAINT "scraped_urls_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "ops"."scraped_urls"
    ADD CONSTRAINT "scraped_urls_url_hash_company_name_key" UNIQUE ("url_hash", "company_name");



ALTER TABLE ONLY "ops"."tavily_searches"
    ADD CONSTRAINT "tavily_searches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidate_profiles"
    ADD CONSTRAINT "candidate_profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."interview_questions"
    ADD CONSTRAINT "interview_questions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."interview_stages"
    ADD CONSTRAINT "interview_stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."practice_answers"
    ADD CONSTRAINT "practice_answers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."practice_sessions"
    ADD CONSTRAINT "practice_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prep_plans"
    ADD CONSTRAINT "prep_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prep_plans"
    ADD CONSTRAINT "prep_plans_search_id_key" UNIQUE ("search_id");



ALTER TABLE ONLY "public"."profile_imports"
    ADD CONSTRAINT "profile_imports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resumes"
    ADD CONSTRAINT "resumes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."searches"
    ADD CONSTRAINT "searches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_question_flags"
    ADD CONSTRAINT "user_question_flags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_question_flags"
    ADD CONSTRAINT "user_question_flags_user_id_question_id_key" UNIQUE ("user_id", "question_id");



CREATE INDEX "idx_scraped_company" ON "ops"."scraped_urls" USING "btree" ("company_name", "role_title");



CREATE INDEX "idx_tavily_search" ON "ops"."tavily_searches" USING "btree" ("search_id");



CREATE INDEX "candidate_profiles_last_resume_idx" ON "public"."candidate_profiles" USING "btree" ("last_resume_id");



CREATE INDEX "idx_answers_session" ON "public"."practice_answers" USING "btree" ("session_id");



CREATE INDEX "idx_prep_plans_search" ON "public"."prep_plans" USING "btree" ("search_id");



CREATE INDEX "idx_questions_filter" ON "public"."interview_questions" USING "btree" ("search_id", "category", "difficulty");



CREATE INDEX "idx_questions_search" ON "public"."interview_questions" USING "btree" ("search_id");



CREATE INDEX "idx_questions_stage" ON "public"."interview_questions" USING "btree" ("stage_id");



CREATE INDEX "idx_searches_processing" ON "public"."searches" USING "btree" ("status") WHERE ("status" = ANY (ARRAY['pending'::"text", 'processing'::"text"]));



CREATE INDEX "idx_searches_user" ON "public"."searches" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_sessions_search" ON "public"."practice_sessions" USING "btree" ("search_id", "user_id");



CREATE INDEX "idx_stages_search" ON "public"."interview_stages" USING "btree" ("search_id");



CREATE INDEX "profile_imports_user_status_idx" ON "public"."profile_imports" USING "btree" ("user_id", "status", "created_at" DESC);



CREATE INDEX "resumes_search_snapshot_idx" ON "public"."resumes" USING "btree" ("search_id", "created_at" DESC) WHERE ("search_id" IS NOT NULL);



CREATE UNIQUE INDEX "resumes_user_active_profile_idx" ON "public"."resumes" USING "btree" ("user_id") WHERE (("search_id" IS NULL) AND "is_active");



CREATE INDEX "resumes_user_profile_idx" ON "public"."resumes" USING "btree" ("user_id", "created_at" DESC) WHERE ("search_id" IS NULL);



CREATE OR REPLACE TRIGGER "candidate_profiles_updated_at" BEFORE UPDATE ON "public"."candidate_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "flags_updated_at" BEFORE UPDATE ON "public"."user_question_flags" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "searches_updated_at" BEFORE UPDATE ON "public"."searches" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



ALTER TABLE ONLY "ops"."tavily_searches"
    ADD CONSTRAINT "tavily_searches_search_id_fkey" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidate_profiles"
    ADD CONSTRAINT "candidate_profiles_last_resume_id_fkey" FOREIGN KEY ("last_resume_id") REFERENCES "public"."resumes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."candidate_profiles"
    ADD CONSTRAINT "candidate_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interview_questions"
    ADD CONSTRAINT "interview_questions_search_id_fkey" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interview_questions"
    ADD CONSTRAINT "interview_questions_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."interview_stages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interview_stages"
    ADD CONSTRAINT "interview_stages_search_id_fkey" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."practice_answers"
    ADD CONSTRAINT "practice_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."interview_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."practice_answers"
    ADD CONSTRAINT "practice_answers_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."practice_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."practice_sessions"
    ADD CONSTRAINT "practice_sessions_search_id_fkey" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."practice_sessions"
    ADD CONSTRAINT "practice_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prep_plans"
    ADD CONSTRAINT "prep_plans_search_id_fkey" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_imports"
    ADD CONSTRAINT "profile_imports_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profile_imports"
    ADD CONSTRAINT "profile_imports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resumes"
    ADD CONSTRAINT "resumes_search_id_fkey" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."resumes"
    ADD CONSTRAINT "resumes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."searches"
    ADD CONSTRAINT "searches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_question_flags"
    ADD CONSTRAINT "user_question_flags_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."interview_questions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_question_flags"
    ADD CONSTRAINT "user_question_flags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "scraped_service" ON "ops"."scraped_urls" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "ops"."scraped_urls" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tavily_read" ON "ops"."tavily_searches" FOR SELECT USING (("search_id" IN ( SELECT "searches"."id"
   FROM "public"."searches"
  WHERE ("searches"."user_id" = "auth"."uid"()))));



ALTER TABLE "ops"."tavily_searches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tavily_service" ON "ops"."tavily_searches" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "answers_own" ON "public"."practice_answers" USING (("session_id" IN ( SELECT "practice_sessions"."id"
   FROM "public"."practice_sessions"
  WHERE ("practice_sessions"."user_id" = "auth"."uid"())))) WITH CHECK (("session_id" IN ( SELECT "practice_sessions"."id"
   FROM "public"."practice_sessions"
  WHERE ("practice_sessions"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."candidate_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "candidate_profiles_own" ON "public"."candidate_profiles" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "candidate_profiles_service" ON "public"."candidate_profiles" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "flags_own" ON "public"."user_question_flags" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."interview_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."interview_stages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."practice_answers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."practice_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prep_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "prep_plans_read" ON "public"."prep_plans" FOR SELECT USING (("search_id" IN ( SELECT "searches"."id"
   FROM "public"."searches"
  WHERE ("searches"."user_id" = "auth"."uid"()))));



CREATE POLICY "prep_plans_service" ON "public"."prep_plans" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."profile_imports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profile_imports_own" ON "public"."profile_imports" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "profile_imports_service" ON "public"."profile_imports" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_own" ON "public"."profiles" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "questions_read" ON "public"."interview_questions" FOR SELECT USING (("search_id" IN ( SELECT "searches"."id"
   FROM "public"."searches"
  WHERE ("searches"."user_id" = "auth"."uid"()))));



CREATE POLICY "questions_service" ON "public"."interview_questions" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."resumes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "resumes_own" ON "public"."resumes" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "resumes_service" ON "public"."resumes" FOR SELECT TO "service_role" USING (true);



ALTER TABLE "public"."searches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "searches_own" ON "public"."searches" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "searches_service" ON "public"."searches" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "sessions_own" ON "public"."practice_sessions" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "stages_read" ON "public"."interview_stages" FOR SELECT USING (("search_id" IN ( SELECT "searches"."id"
   FROM "public"."searches"
  WHERE ("searches"."user_id" = "auth"."uid"()))));



CREATE POLICY "stages_service" ON "public"."interview_stages" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."user_question_flags" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "ops" TO "service_role";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_search_progress"("search_uuid" "uuid", "new_status" "text", "new_step" "text", "new_percentage" smallint, "error_msg" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_search_progress"("search_uuid" "uuid", "new_status" "text", "new_step" "text", "new_percentage" smallint, "error_msg" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_search_progress"("search_uuid" "uuid", "new_status" "text", "new_step" "text", "new_percentage" smallint, "error_msg" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON TABLE "ops"."scraped_urls" TO "anon";
GRANT ALL ON TABLE "ops"."scraped_urls" TO "authenticated";
GRANT ALL ON TABLE "ops"."scraped_urls" TO "service_role";



GRANT ALL ON TABLE "ops"."tavily_searches" TO "anon";
GRANT ALL ON TABLE "ops"."tavily_searches" TO "authenticated";
GRANT ALL ON TABLE "ops"."tavily_searches" TO "service_role";



GRANT ALL ON TABLE "public"."candidate_profiles" TO "anon";
GRANT ALL ON TABLE "public"."candidate_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."candidate_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."interview_questions" TO "anon";
GRANT ALL ON TABLE "public"."interview_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."interview_questions" TO "service_role";



GRANT ALL ON TABLE "public"."interview_stages" TO "anon";
GRANT ALL ON TABLE "public"."interview_stages" TO "authenticated";
GRANT ALL ON TABLE "public"."interview_stages" TO "service_role";



GRANT ALL ON TABLE "public"."practice_answers" TO "anon";
GRANT ALL ON TABLE "public"."practice_answers" TO "authenticated";
GRANT ALL ON TABLE "public"."practice_answers" TO "service_role";



GRANT ALL ON TABLE "public"."practice_sessions" TO "anon";
GRANT ALL ON TABLE "public"."practice_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."practice_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."prep_plans" TO "anon";
GRANT ALL ON TABLE "public"."prep_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."prep_plans" TO "service_role";



GRANT ALL ON TABLE "public"."profile_imports" TO "anon";
GRANT ALL ON TABLE "public"."profile_imports" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_imports" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."resumes" TO "anon";
GRANT ALL ON TABLE "public"."resumes" TO "authenticated";
GRANT ALL ON TABLE "public"."resumes" TO "service_role";



GRANT ALL ON TABLE "public"."searches" TO "anon";
GRANT ALL ON TABLE "public"."searches" TO "authenticated";
GRANT ALL ON TABLE "public"."searches" TO "service_role";



GRANT ALL ON TABLE "public"."user_question_flags" TO "anon";
GRANT ALL ON TABLE "public"."user_question_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."user_question_flags" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







