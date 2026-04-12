import {
  dedupePaths,
  getCurrentUser,
  type Json,
  RESUME_FILES_BUCKET,
  type ResumeFileInput,
  type ResumeSource,
  supabase,
} from "./shared";

export const profileService = {
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
          userId: user.id,
        },
      });

      if (response.error) throw new Error(response.error.message);

      return {
        success: true,
        parsedData: response.data.parsedData,
        aiAnalysis: response.data.aiAnalysis,
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
    const uniquePaths = dedupePaths(paths);
    if (uniquePaths.length === 0) return { success: true };

    try {
      const { error } = await supabase.storage.from(RESUME_FILES_BUCKET).remove(uniquePaths);
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

      const nextSource = source ?? (file ? "upload" : "manual");
      const nextFile = file ?? null;

      const { data, error } = await supabase.rpc("save_resume_version", {
        p_content: content,
        p_parsed_data: ((parsedData as Json) ?? null) as never,
        p_file_name: nextFile?.name ?? null,
        p_file_path: nextFile?.path ?? null,
        p_file_size_bytes: nextFile?.size ?? null,
        p_mime_type: nextFile?.mimeType ?? null,
        p_source: nextSource,
      });

      if (error) throw error;

      return {
        resume: Array.isArray(data) ? data[0] : data,
        success: true,
      };
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
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
      if (error) throw error;
      return { profile: data, success: true };
    } catch (error) {
      console.error("Error getting profile:", error);
      return { error, success: false };
    }
  },

  async updateProfile({
    level,
  }: {
    level?: "junior" | "mid" | "senior_ic" | "people_manager";
  }) {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("No authenticated user");
      }

      const { data, error } = await supabase
        .from("profiles")
        .update({ level } as never)
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
};
