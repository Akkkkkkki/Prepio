import { describe, expect, it } from "vitest";

import { classifyReplay, toMarkdown } from "./audit-cross-tenant-access.mjs";

describe("cross-tenant audit reporting", () => {
  it("distinguishes protected, leaked, missing-fixture, and inconclusive reads", () => {
    expect(classifyReplay({ sourceError: null, sourceIds: ["a"], replayError: null, replayRows: [] })).toBe("protected");
    expect(classifyReplay({ sourceError: null, sourceIds: ["a"], replayError: null, replayRows: [{ id: "a" }] })).toBe("leak");
    expect(classifyReplay({ sourceError: null, sourceIds: [], replayError: null, replayRows: [] })).toBe("not_tested");
    expect(classifyReplay({ sourceError: new Error("bad setup"), sourceIds: [], replayError: null, replayRows: [] })).toBe("inconclusive");
    expect(classifyReplay({ sourceError: null, sourceIds: ["a"], replayError: new Error("network"), replayRows: [] })).toBe("inconclusive");
  });

  it("renders a comment-ready results table", () => {
    const output = toMarkdown([{ target: "table:searches", status: "protected", evidence: "B returned 0/1 A row(s)" }]);
    expect(output).toContain("| table:searches | protected | B returned 0/1 A row(s) |");
  });
});
