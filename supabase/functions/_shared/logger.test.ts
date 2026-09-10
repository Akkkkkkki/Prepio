import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchLogger } from "./logger.ts";

// PREPIO-179 (follow-up to PREPIO-141): the per-search Tavily logs must not
// carry the raw query string, which can embed interviewer/team names parsed
// from the user's free-text note. logTavilySearch takes the query's source
// label and forwards the request payload, so both paths need to stay clean.

/** The note-derived signal that would leak if a raw query reached the logger. */
const SENSITIVE_SIGNAL = "Jane Interviewer";
const RAW_QUERY = `"Acme" Staff Engineer "${SENSITIVE_SIGNAL}" interview site:linkedin.com`;

function serializeCalls(spy: ReturnType<typeof vi.spyOn>): string {
  return spy.mock.calls
    .map((args) => args.map((arg) => JSON.stringify(arg)).join(" "))
    .join("\n");
}

describe("SearchLogger.logTavilySearch redaction", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("never writes the raw query — not as a field nor inside requestPayload", () => {
    const logger = new SearchLogger("search-1", "company-research", "user-1");
    const request = {
      query: RAW_QUERY,
      searchDepth: "basic",
      maxResults: 3,
      includeDomains: ["linkedin.com"],
    };

    logger.logTavilySearch("user-note-linkedin", "DISCOVERY_SUCCESS", request, {
      results: [{ url: "https://example.com/a" }],
      answer: "ok",
    });

    const output = serializeCalls(logSpy) + "\n" + serializeCalls(errorSpy);
    expect(output).not.toContain(RAW_QUERY);
    expect(output).not.toContain(SENSITIVE_SIGNAL);
    // The safe descriptor is still logged so Tavily debugging stays tractable.
    expect(output).toContain("user-note-linkedin");
  });

  it("keeps redacting the query on the error path", () => {
    const logger = new SearchLogger("search-2", "company-research", "user-1");
    const request = { query: RAW_QUERY, searchDepth: "basic", maxResults: 3 };

    logger.logTavilySearch(
      "user-note-blog",
      "DISCOVERY_ERROR",
      request,
      undefined,
      "network error",
    );

    const output = serializeCalls(logSpy) + "\n" + serializeCalls(errorSpy);
    expect(output).not.toContain(RAW_QUERY);
    expect(output).not.toContain(SENSITIVE_SIGNAL);
    expect(output).toContain("user-note-blog");
  });

  it("does not mutate the caller's request payload", () => {
    const logger = new SearchLogger("search-3", "company-research", "user-1");
    const request = { query: RAW_QUERY, searchDepth: "basic", maxResults: 3 };

    logger.logTavilySearch("linkedin", "DISCOVERY_SUCCESS", request, undefined);

    // The real Tavily call still needs the full request, so redaction must be
    // a copy, not an in-place delete.
    expect(request.query).toBe(RAW_QUERY);
  });
});
