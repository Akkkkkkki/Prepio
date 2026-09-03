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

  it("returns the fallback and logs only a bounded raw-response preview", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fallback = { status: "fallback" };
    const sensitiveTail = "candidate@example.test private interview answer";
    const invalidResponse = `${"x".repeat(500)}${sensitiveTail}`;

    const result = parseJsonResponse(invalidResponse, fallback);

    expect(result).toBe(fallback);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy.mock.calls[1][0]).toBe("Raw response (preview):");
    expect(consoleErrorSpy.mock.calls[1][1]).toContain("x".repeat(500));
    expect(consoleErrorSpy.mock.calls[1][1]).toContain(
      `[truncated, ${invalidResponse.length} chars total]`,
    );
    expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain(sensitiveTail);
  });

  it("still returns the fallback when the model content is missing", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fallback = { stages: [] };

    const result = parseJsonResponse(undefined as unknown as string, fallback);

    expect(result).toBe(fallback);
    expect(consoleErrorSpy).toHaveBeenCalledWith("Raw response (preview):", "undefined");
  });
});
