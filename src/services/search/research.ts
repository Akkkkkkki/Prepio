import { supabase, type CreateSearchParams } from "./shared";

export const researchService = {
  async createSearchRecord({
    company,
    role,
    country,
    roleLinks,
    cv,
    targetSeniority,
  }: CreateSearchParams) {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("No authenticated user");
      }

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
        } as never)
        .select()
        .single();

      if (searchError) throw searchError;

      return { searchId: searchData.id, success: true };
    } catch (error) {
      console.error("Error creating search record:", error);
      return { error, success: false };
    }
  },

  async startProcessing(
    searchId: string,
    { company, role, country, roleLinks, cv, targetSeniority }: CreateSearchParams,
  ) {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("No authenticated user");
      }

      await supabase.from("searches").update({ status: "processing" } as never).eq("id", searchId);

      supabase.functions
        .invoke("interview-research", {
          body: {
            company,
            role,
            country,
            roleLinks: roleLinks ? roleLinks.split("\n").filter((link) => link.trim()) : [],
            cv,
            targetSeniority,
            userId: user.id,
            searchId,
          },
        })
        .then((response) => {
          if (response.error) {
            console.error("Edge function error:", response.error);
            supabase.from("searches").update({ status: "failed" } as never).eq("id", searchId);
          }
        })
        .catch((error) => {
          console.error("Error calling edge function:", error);
          supabase.from("searches").update({ status: "failed" } as never).eq("id", searchId);
        });

      return { success: true };
    } catch (error) {
      console.error("Error starting processing:", error);
      await supabase.from("searches").update({ status: "failed" } as never).eq("id", searchId);
      return { error, success: false };
    }
  },

  async createSearch(params: CreateSearchParams) {
    const recordResult = await this.createSearchRecord(params);
    if (!recordResult.success) return recordResult;

    const processResult = await this.startProcessing(recordResult.searchId!, params);
    return {
      searchId: recordResult.searchId,
      success: processResult.success,
      error: processResult.error,
    };
  },

  async getSearchStatus(searchId: string) {
    try {
      const { data, error } = await supabase
        .from("searches")
        .select("id, status, progress_pct, progress_step, error_message")
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

      const { data: stages, error: stagesError } = await supabase
        .from("interview_stages")
        .select("*")
        .eq("search_id", searchId)
        .order("order_index");

      if (stagesError) throw stagesError;

      const stagesWithQuestions = await Promise.all(
        (stages || []).map(async (stage) => {
          const { data: questions, error: questionsError } = await supabase
            .from("interview_questions")
            .select("*")
            .eq("stage_id", stage.id);

          if (questionsError) throw questionsError;

          return {
            ...stage,
            questions: (questions || []).map((question) => ({
              ...question,
              type: (question as Record<string, unknown>).question_type ?? null,
              answered: false,
            })),
          };
        }),
      );

      const { data: artifact, error: artifactError } = await supabase
        .from("search_artifacts")
        .select("comparison_analysis, preparation_guidance")
        .eq("search_id", searchId)
        .maybeSingle();

      if (artifactError && artifactError.code !== "PGRST116") {
        console.warn("Search artifacts query error:", artifactError.message || artifactError);
      }

      const { data: prepPlan, error: prepPlanError } = await supabase
        .from("prep_plans")
        .select("*")
        .eq("search_id", searchId)
        .maybeSingle();

      if (prepPlanError && prepPlanError.code !== "PGRST116") {
        console.warn("Prep plan query error:", prepPlanError.message || prepPlanError);
      }

      return {
        search,
        stages: stagesWithQuestions,
        cvJobComparison: artifact?.comparison_analysis || null,
        preparationGuidance: artifact?.preparation_guidance || null,
        prepPlan: prepPlan || null,
        success: true,
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
        .update({ banner_dismissed: true } as never)
        .eq("id", searchId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error("Error dismissing banner:", error);
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
};
