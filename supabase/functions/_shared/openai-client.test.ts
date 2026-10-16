import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// `_shared/openai-client.ts` imports `_shared/config.ts`, which reads `Deno.env`
// at module load. Stub just enough for Node-side Vitest.
type OpenAiClient = typeof import("./openai-client.ts");

let parseJsonResponse: OpenAiClient["parseJsonResponse"];

beforeAll(async () => {
  (globalThis as unknown as { Deno: { env: { get: () => undefined } } }).Deno =
    { env: { get: () => undefined } };

  const mod = await import("./openai-client.ts");
  parseJsonResponse = mod.parseJsonResponse;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseJsonResponse", () => {
  it("parses plain JSON responses", () => {
    expect(parseJsonResponse('{"status":"ok","count":2}', { status: "fallback" })).toEqual({
      status: "ok",
      count: 2,
    });
  });

  it("strips markdown JSON fences before parsing", () => {
    expect(
      parseJsonResponse('```json\n{"items":["system design","behavioral"]}\n```', { items: [] }),
    ).toEqual({
      items: ["system design", "behavioral"],
    });
  });

  it.each([
    "candidate@example.test private interview answer",
    `${"x".repeat(500)}candidate@example.test private interview answer`,
    '{"email":"candidate@example.test", broken}',
  ])("returns the fallback without logging model content or parser excerpts", (invalidResponse) => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fallback = { status: "fallback" };

    expect(parseJsonResponse(invalidResponse, fallback)).toBe(fallback);
    expect(consoleErrorSpy).toHaveBeenCalledExactlyOnceWith(
      "Failed to parse OpenAI JSON response",
      { contentType: "string", contentLength: invalidResponse.length },
    );
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain("candidate@example.test");
  });

  it("still returns the fallback when the model content is missing", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fallback = { stages: [] };

    expect(parseJsonResponse(undefined as unknown as string, fallback)).toBe(fallback);
    expect(consoleErrorSpy).toHaveBeenCalledExactlyOnceWith(
      "Failed to parse OpenAI JSON response",
      { contentType: "undefined", contentLength: 0 },
    );
  });

  // PREPIO-132 Part 1: treat the model as a hostile input source. These are
  // malformed/edge response shapes a real model can emit; each must fall back
  // safely rather than crash or silently hand a caller a non-object.
  describe("hostile model response shapes", () => {
    it("coalesces a literal JSON null to the fallback", () => {
      // `null` parses successfully, so it bypasses the catch; without the
      // coalesce it would reach an object-expecting caller (job-analysis,
      // answer-feedback, …) and crash on the first property access.
      const fallback = { technical_skills: [] as string[] };
      expect(parseJsonResponse("null", fallback)).toBe(fallback);
    });

    it("coalesces a null wrapped in markdown fences to the fallback", () => {
      const fallback = { items: [] as string[] };
      expect(parseJsonResponse("```json\nnull\n```", fallback)).toBe(fallback);
    });

    it("preserves a null fallback for a null response (interview-research contract)", () => {
      // interview-research passes `null` as its fallback and handles null
      // downstream, so the coalesce must not change that path.
      expect(parseJsonResponse<null>("null", null)).toBeNull();
    });

    it.each([
      ['truncated mid-object (token limit)', '{"stages":[{"title":"Phone screen"'],
      ['prose wrapper around the JSON', 'Here is your plan: {"stages":[]}'],
      ['markdown fence with no JSON body', '```'],
      ['empty string', ''],
    ])("returns the fallback for %s", (_label, response) => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const fallback = { stages: [] as unknown[] };
      expect(parseJsonResponse(response, fallback)).toBe(fallback);
      expect(consoleErrorSpy).toHaveBeenCalledOnce();
    });

    it("passes a well-formed object through even with absurdly large values", () => {
      const huge = "x".repeat(50_000);
      expect(parseJsonResponse(`{"summary":"${huge}"}`, { summary: "" })).toEqual({
        summary: huge,
      });
    });
  });
});
