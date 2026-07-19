import { describe, expect, it } from "vitest";
import { getCompanyAnalysisSystemPrompt } from "./analysis-prompt.ts";

describe("getCompanyAnalysisSystemPrompt", () => {
  it("requires non-English evidence to be translated without losing specificity", () => {
    const prompt = getCompanyAnalysisSystemPrompt();

    expect(prompt).toContain("Chinese interview reports from 1point3acres");
    expect(prompt).toContain("Return all explanatory fields and questions in clear English");
    expect(prompt).toContain("preserve company names, technology names, numbers");
    expect(prompt).toContain("问了");
  });
});
