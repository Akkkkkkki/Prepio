export interface SupabaseError {
  message?: string;
}

type QueryResult<T> = Promise<{ data: T[] | null; error: SupabaseError | null }>;

interface EqChain<T> {
  eq: (column: string, value: string) => QueryResult<T>;
}

interface InChain<T> {
  in: (column: string, values: string[]) => QueryResult<T>;
}

interface SelectTable<T> {
  select: (columns: string) => EqChain<T> & InChain<T>;
}

interface StorageBucket {
  remove: (paths: string[]) => Promise<{ data?: unknown; error: SupabaseError | null }>;
}

export interface SupabaseLike {
  from(table: "resumes"): SelectTable<{ file_path: string | null }>;
  from(table: "practice_sessions"): SelectTable<{ id: string }>;
  from(table: "practice_answers"): SelectTable<{ audio_path: string | null }>;
  storage: {
    from(bucket: "resume-files" | "practice-audio"): StorageBucket;
  };
  auth: {
    admin: {
      deleteUser: (userId: string) => Promise<{ data?: unknown; error: SupabaseError | null }>;
    };
  };
}

export interface Deps {
  supabase: SupabaseLike;
  log: (event: string, fields?: Record<string, unknown>) => void;
}

export interface DeleteAccountRequest {
  confirmation: string;
  userId: string;
}

export type DeleteAccountResult =
  | {
      ok: true;
      deleted: {
        resumeFiles: number;
        practiceAudioFiles: number;
      };
    }
  | { ok: false; status: number; error: string };

const unique = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value))));

export async function deleteAccount(
  deps: Deps,
  req: DeleteAccountRequest,
): Promise<DeleteAccountResult> {
  if (req.confirmation !== "DELETE") {
    return { ok: false, status: 400, error: "confirmation_required" };
  }

  const { data: resumes, error: resumeReadError } = await deps.supabase
    .from("resumes")
    .select("file_path")
    .eq("user_id", req.userId);

  if (resumeReadError) {
    deps.log("delete_account_resume_read_failed", {
      userId: req.userId,
      message: resumeReadError.message,
    });
    return { ok: false, status: 500, error: "internal_error" };
  }

  const { data: sessions, error: sessionReadError } = await deps.supabase
    .from("practice_sessions")
    .select("id")
    .eq("user_id", req.userId);

  if (sessionReadError) {
    deps.log("delete_account_session_read_failed", {
      userId: req.userId,
      message: sessionReadError.message,
    });
    return { ok: false, status: 500, error: "internal_error" };
  }

  const sessionIds = unique((sessions ?? []).map((session) => session.id));
  let audioPaths: string[] = [];

  if (sessionIds.length > 0) {
    const { data: answers, error: answerReadError } = await deps.supabase
      .from("practice_answers")
      .select("audio_path")
      .in("session_id", sessionIds);

    if (answerReadError) {
      deps.log("delete_account_answer_read_failed", {
        userId: req.userId,
        message: answerReadError.message,
      });
      return { ok: false, status: 500, error: "internal_error" };
    }

    audioPaths = unique((answers ?? []).map((answer) => answer.audio_path));
  }

  const resumePaths = unique((resumes ?? []).map((resume) => resume.file_path));

  if (resumePaths.length > 0) {
    const { error } = await deps.supabase.storage.from("resume-files").remove(resumePaths);
    if (error) {
      deps.log("delete_account_resume_storage_failed", {
        userId: req.userId,
        message: error.message,
      });
      return { ok: false, status: 500, error: "storage_delete_failed" };
    }
  }

  if (audioPaths.length > 0) {
    const { error } = await deps.supabase.storage.from("practice-audio").remove(audioPaths);
    if (error) {
      deps.log("delete_account_audio_storage_failed", {
        userId: req.userId,
        message: error.message,
      });
      return { ok: false, status: 500, error: "storage_delete_failed" };
    }
  }

  const { error: deleteUserError } = await deps.supabase.auth.admin.deleteUser(req.userId);
  if (deleteUserError) {
    deps.log("delete_account_auth_delete_failed", {
      userId: req.userId,
      message: deleteUserError.message,
    });
    return { ok: false, status: 500, error: "auth_delete_failed" };
  }

  deps.log("delete_account_completed", {
    userId: req.userId,
    resumeFiles: resumePaths.length,
    practiceAudioFiles: audioPaths.length,
  });

  return {
    ok: true,
    deleted: {
      resumeFiles: resumePaths.length,
      practiceAudioFiles: audioPaths.length,
    },
  };
}
