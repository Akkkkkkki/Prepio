import { describe, expect, it, vi } from "vitest";

import {
  deleteAccount,
  type Deps,
  type SupabaseError,
  type SupabaseLike,
} from "./handler.ts";

const USER_ID = "user_123";

interface FakeSupabaseOptions {
  resumes?: Array<{ file_path: string | null }>;
  sessions?: Array<{ id: string }>;
  answers?: Array<{ audio_path: string | null }>;
  resumeReadError?: SupabaseError;
  sessionReadError?: SupabaseError;
  answerReadError?: SupabaseError;
  resumeStorageError?: SupabaseError;
  audioStorageError?: SupabaseError;
  deleteUserError?: SupabaseError;
}

function createSelectChain<T>(
  rows: T[] | null,
  error: SupabaseError | undefined,
  calls: Array<{ op: "eq" | "in"; column: string; value: string | string[] }>,
) {
  return {
    eq: vi.fn(async (column: string, value: string) => {
      calls.push({ op: "eq", column, value });
      return { data: rows, error: error ?? null };
    }),
    in: vi.fn(async (column: string, value: string[]) => {
      calls.push({ op: "in", column, value });
      return { data: rows, error: error ?? null };
    }),
  };
}

function buildDeps(options: FakeSupabaseOptions = {}) {
  const queryCalls: Array<{ op: "eq" | "in"; column: string; value: string | string[] }> = [];
  const removed: Record<string, string[][]> = {};
  const logs: Array<{ event: string; fields?: Record<string, unknown> }> = [];
  const deleteUser = vi.fn(async (_userId: string) => ({
    data: {},
    error: options.deleteUserError ?? null,
  }));

  const supabase = {
    from(table: "resumes" | "practice_sessions" | "practice_answers") {
      return {
        select(_columns: string) {
          if (table === "resumes") {
            return createSelectChain(options.resumes ?? [], options.resumeReadError, queryCalls);
          }
          if (table === "practice_sessions") {
            return createSelectChain(options.sessions ?? [], options.sessionReadError, queryCalls);
          }
          return createSelectChain(options.answers ?? [], options.answerReadError, queryCalls);
        },
      };
    },
    storage: {
      from(bucket: "resume-files" | "practice-audio") {
        return {
          async remove(paths: string[]) {
            removed[bucket] = [...(removed[bucket] ?? []), paths];
            return {
              data: null,
              error:
                bucket === "resume-files"
                  ? options.resumeStorageError ?? null
                  : options.audioStorageError ?? null,
            };
          },
        };
      },
    },
    auth: {
      admin: {
        deleteUser,
      },
    },
  };

  const deps: Deps = {
    supabase: supabase as SupabaseLike,
    log: (event, fields) => logs.push({ event, fields }),
  };

  return { deps, queryCalls, removed, deleteUser, logs };
}

describe("deleteAccount", () => {
  it("requires explicit confirmation", async () => {
    const { deps, deleteUser } = buildDeps();

    const result = await deleteAccount(deps, { userId: USER_ID, confirmation: "delete" });

    expect(result).toEqual({ ok: false, status: 400, error: "confirmation_required" });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("removes stored files before deleting the auth user", async () => {
    const { deps, queryCalls, removed, deleteUser } = buildDeps({
      resumes: [
        { file_path: `${USER_ID}/resume.pdf` },
        { file_path: `${USER_ID}/resume.pdf` },
        { file_path: null },
      ],
      sessions: [{ id: "session-1" }, { id: "session-2" }],
      answers: [
        { audio_path: `${USER_ID}/session-1/a.webm` },
        { audio_path: `${USER_ID}/session-1/a.webm` },
        { audio_path: null },
      ],
    });

    const result = await deleteAccount(deps, { userId: USER_ID, confirmation: "DELETE" });

    expect(result).toEqual({
      ok: true,
      deleted: {
        resumeFiles: 1,
        practiceAudioFiles: 1,
      },
    });
    expect(queryCalls).toEqual([
      { op: "eq", column: "user_id", value: USER_ID },
      { op: "eq", column: "user_id", value: USER_ID },
      { op: "in", column: "session_id", value: ["session-1", "session-2"] },
    ]);
    expect(removed["resume-files"]).toEqual([[`${USER_ID}/resume.pdf`]]);
    expect(removed["practice-audio"]).toEqual([[`${USER_ID}/session-1/a.webm`]]);
    expect(deleteUser).toHaveBeenCalledWith(USER_ID);
  });

  it("does not delete the auth user when storage cleanup fails", async () => {
    const { deps, deleteUser, logs } = buildDeps({
      resumes: [{ file_path: `${USER_ID}/resume.pdf` }],
      resumeStorageError: { message: "storage down" },
    });

    const result = await deleteAccount(deps, { userId: USER_ID, confirmation: "DELETE" });

    expect(result).toEqual({ ok: false, status: 500, error: "storage_delete_failed" });
    expect(deleteUser).not.toHaveBeenCalled();
    expect(logs.map((entry) => entry.event)).toContain("delete_account_resume_storage_failed");
  });

  it("returns auth_delete_failed when the admin delete fails", async () => {
    const { deps, logs } = buildDeps({
      deleteUserError: { message: "auth down" },
    });

    const result = await deleteAccount(deps, { userId: USER_ID, confirmation: "DELETE" });

    expect(result).toEqual({ ok: false, status: 500, error: "auth_delete_failed" });
    expect(logs.map((entry) => entry.event)).toContain("delete_account_auth_delete_failed");
  });
});
