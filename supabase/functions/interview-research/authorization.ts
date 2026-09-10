import type { AuthorizedRequestContext } from "../_shared/auth.ts";

export interface SearchOwnershipClient {
  from(table: "searches"): {
    select(columns: "id"): {
      eq(column: "id", value: string): {
        eq(column: "user_id", value: string): {
          maybeSingle(): Promise<{
            data: { id: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
}

export type SearchAuthorizationResult =
  | { ok: true }
  | { ok: false; status: 403 | 404 | 500; error: string };

/**
 * Authorize the caller-supplied search before any research progress or data
 * writes begin. Service callers are trusted internal callers; JWT users must
 * own both the body userId and the persisted search row.
 */
export async function authorizeSearch(
  supabase: SearchOwnershipClient,
  authContext: AuthorizedRequestContext,
  userId: string,
  searchId: string,
): Promise<SearchAuthorizationResult> {
  if (authContext.kind === "service") {
    return { ok: true };
  }

  if (authContext.userId !== userId) {
    return { ok: false, status: 403, error: "User ID does not match authenticated user" };
  }

  const { data, error } = await supabase
    .from("searches")
    .select("id")
    .eq("id", searchId)
    .eq("user_id", authContext.userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to verify search ownership:", error.message);
    return { ok: false, status: 500, error: "Unable to verify search ownership" };
  }

  if (!data) {
    // Deliberately identical for an absent row and a row owned by another user.
    return { ok: false, status: 404, error: "Search not found" };
  }

  return { ok: true };
}
