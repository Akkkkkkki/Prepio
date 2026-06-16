import { describe, expect, it } from "vitest";
import { formatJobRequirementsBlock } from "./job-requirements-prompt.ts";

const SAMPLE_REQUIREMENTS = {
  technical_skills: ["TypeScript", "React"],
  soft_skills: ["Communication"],
  responsibilities: ["Ship features end-to-end"],
  qualifications: ["3+ years building web apps"],
  interview_process_hints: ["Two technical rounds + behavioral"],
};

describe("formatJobRequirementsBlock", () => {
  it("renders the JOB REQUIREMENTS block when source is 'extracted'", () => {
    const block = formatJobRequirementsBlock(SAMPLE_REQUIREMENTS, "extracted");
    expect(block).toContain("=== JOB REQUIREMENTS (from link analysis) ===");
    expect(block).toContain("Technical: TypeScript, React");
    expect(block).toContain("Soft: Communication");
    expect(block).toContain("- Ship features end-to-end");
    expect(block).toContain("- 3+ years building web apps");
    expect(block).toContain("Process hints: Two technical rounds + behavioral");
  });

  it("suppresses the block when source is 'stub' so the model can't treat fabricated requirements as evidence", () => {
    const block = formatJobRequirementsBlock(SAMPLE_REQUIREMENTS, "stub");
    expect(block).toBe("");
  });

  it("returns empty string when requirements are null/undefined regardless of source", () => {
    expect(formatJobRequirementsBlock(null, "extracted")).toBe("");
    expect(formatJobRequirementsBlock(undefined, "extracted")).toBe("");
  });

  it("returns empty string when source is null/undefined (older deployments default to suppress)", () => {
    expect(formatJobRequirementsBlock(SAMPLE_REQUIREMENTS, null)).toBe("");
    expect(formatJobRequirementsBlock(SAMPLE_REQUIREMENTS, undefined)).toBe("");
  });

  it("omits empty sub-fields without producing dangling labels", () => {
    const block = formatJobRequirementsBlock(
      { technical_skills: ["Go"], soft_skills: [], responsibilities: [] },
      "extracted",
    );
    expect(block).toContain("Technical: Go");
    expect(block).not.toContain("Soft:");
    expect(block).not.toContain("Responsibilities:");
    expect(block).not.toContain("Process hints:");
  });
});
