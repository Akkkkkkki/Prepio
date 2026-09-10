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
});
