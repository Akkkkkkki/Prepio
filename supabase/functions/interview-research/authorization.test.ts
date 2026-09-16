import { describe, expect, it, vi } from "vitest";
import type { AuthorizedRequestContext } from "../_shared/auth.ts";
import { authorizeSearch, type SearchOwnershipClient } from "./authorization.ts";

const USER_ID = "user-owner";
const SEARCH_ID = "search-123";
const userContext: AuthorizedRequestContext = {
  kind: "user",
  token: "jwt",
  userId: USER_ID,
};

function buildClient(result: {
  data: { id: string } | null;
  error: { message: string } | null;
}) {
  const filters: Array<[string, string]> = [];
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const secondEq = vi.fn((column: string, value: string) => {
    filters.push([column, value]);
    return { maybeSingle };
  });
  const firstEq = vi.fn((column: string, value: string) => {
    filters.push([column, value]);
    return { eq: secondEq };
  });
  const from = vi.fn(() => ({
    select: vi.fn(() => ({ eq: firstEq })),
  }));

  return {
    client: { from } as unknown as SearchOwnershipClient,
    filters,
    from,
  };
}

describe("authorizeSearch", () => {
  it("accepts a search owned by the authenticated user", async () => {
    const { client, filters } = buildClient({ data: { id: SEARCH_ID }, error: null });

    await expect(authorizeSearch(client, userContext, USER_ID, SEARCH_ID))
      .resolves.toEqual({ ok: true });
    expect(filters).toEqual([["id", SEARCH_ID], ["user_id", USER_ID]]);
  });

  it("returns the same not-found response for a missing or foreign search", async () => {
    const { client } = buildClient({ data: null, error: null });

    await expect(authorizeSearch(client, userContext, USER_ID, SEARCH_ID))
      .resolves.toEqual({ ok: false, status: 404, error: "Search not found" });
  });

  it("rejects a mismatched body userId without querying the search", async () => {
    const { client, from } = buildClient({ data: { id: SEARCH_ID }, error: null });

    await expect(authorizeSearch(client, userContext, "foreign-user", SEARCH_ID))
      .resolves.toEqual({
        ok: false,
        status: 403,
        error: "User ID does not match authenticated user",
      });
    expect(from).not.toHaveBeenCalled();
  });

  it("fails closed when ownership cannot be verified", async () => {
    const { client } = buildClient({ data: null, error: { message: "database unavailable" } });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(authorizeSearch(client, userContext, USER_ID, SEARCH_ID))
      .resolves.toEqual({
        ok: false,
        status: 500,
        error: "Unable to verify search ownership",
      });
    consoleError.mockRestore();
  });

  it("preserves trusted service callers without an ownership query", async () => {
    const { client, from } = buildClient({ data: null, error: null });
    const serviceContext: AuthorizedRequestContext = {
      kind: "service",
      token: "service-role",
      userId: null,
    };

    await expect(authorizeSearch(client, serviceContext, USER_ID, SEARCH_ID))
      .resolves.toEqual({ ok: true });
    expect(from).not.toHaveBeenCalled();
  });
});
