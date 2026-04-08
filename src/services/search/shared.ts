import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export { supabase };
export type { Json };

export interface CreateSearchParams {
  company: string;
  role?: string;
  country?: string;
  roleLinks?: string;
  cv?: string;
  targetSeniority?: "junior" | "mid" | "senior";
}

export interface ResumeFileInput {
  name: string;
  path: string;
  size: number;
  mimeType: string;
}

export type ResumeSource = "manual" | "upload" | "search_snapshot";

export const RESUME_FILES_BUCKET = "resume-files";
export const PRACTICE_AUDIO_BUCKET = "practice-audio";

export const getCurrentUser = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("No authenticated user");
  }

  return user;
};

export const dedupePaths = (paths: string[]) => Array.from(new Set(paths.filter(Boolean)));
