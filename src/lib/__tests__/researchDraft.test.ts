import { describe, expect, it } from "vitest";

import {
  normalizeResearchDraft,
  getAuthIntentFromPath,
  getAuthResumeLabel,
  createAuthReturnState,
  type ResearchDraft,
} from "../researchDraft";

describe("normalizeResearchDraft", () => {
  const validDraft: ResearchDraft = {
    company: "Acme",
    role: "Engineer",
    country: "UK",
    level: "senior_ic",
    userNote: "Focus on system design",
    jobDescription: "Build scalable APIs",
    cv: "My resume",
    roleLinks: "https://example.com",
    step: "details",
    savedAt: "2026-04-07T00:00:00Z",
  };

  it("returns a valid draft unchanged", () => {
    const result = normalizeResearchDraft(validDraft);
    expect(result).toEqual(validDraft);
  });

  it("returns null for non-object input", () => {
    expect(normalizeResearchDraft(null)).toBeNull();
    expect(normalizeResearchDraft(undefined)).toBeNull();
    expect(normalizeResearchDraft("string")).toBeNull();
    expect(normalizeResearchDraft(42)).toBeNull();
  });

  it("returns null when step is missing or invalid", () => {
    expect(normalizeResearchDraft({ ...validDraft, step: undefined })).toBeNull();
    expect(normalizeResearchDraft({ ...validDraft, step: "invalid" })).toBeNull();
  });

  it("accepts all valid step values", () => {
    for (const step of ["company", "details", "tailoring"] as const) {
      const result = normalizeResearchDraft({ ...validDraft, step });
      expect(result?.step).toBe(step);
    }
  });

  it("accepts all valid level values", () => {
    for (const level of ["junior", "mid", "senior_ic", "people_manager"] as const) {
      const result = normalizeResearchDraft({ ...validDraft, level });
      expect(result?.level).toBe(level);
    }
  });

  it("sets level to undefined for invalid level", () => {
    const result = normalizeResearchDraft({ ...validDraft, level: "invalid" });
    expect(result?.level).toBeUndefined();
  });

  it("normalizes non-string fields to empty strings", () => {
    const result = normalizeResearchDraft({
      step: "company",
      company: 123,
      role: null,
      country: undefined,
      userNote: false,
      jobDescription: { obj: true },
    });
    expect(result?.company).toBe("");
    expect(result?.role).toBe("");
    expect(result?.country).toBe("");
    expect(result?.userNote).toBe("");
    expect(result?.jobDescription).toBe("");
  });

  it("generates savedAt when missing", () => {
    const result = normalizeResearchDraft({ ...validDraft, savedAt: undefined });
    expect(result?.savedAt).toBeTruthy();
    expect(() => new Date(result!.savedAt)).not.toThrow();
  });

  it("preserves legacy targetSeniority when valid", () => {
    const result = normalizeResearchDraft({ ...validDraft, targetSeniority: "senior" });
    expect(result?.targetSeniority).toBe("senior");
  });

  it("drops invalid targetSeniority", () => {
    const result = normalizeResearchDraft({ ...validDraft, targetSeniority: "director" });
    expect(result?.targetSeniority).toBeUndefined();
  });
});

describe("getAuthIntentFromPath", () => {
  it("maps known paths to intents", () => {
    expect(getAuthIntentFromPath("/")).toBe("research");
    expect(getAuthIntentFromPath("/practice")).toBe("practice");
    expect(getAuthIntentFromPath("/dashboard")).toBe("dashboard");
    expect(getAuthIntentFromPath("/profile")).toBe("profile");
    expect(getAuthIntentFromPath("/profile/import")).toBe("profile");
  });

  it("maps /search/:id paths to dashboard", () => {
    expect(getAuthIntentFromPath("/search/abc-123")).toBe("dashboard");
  });

  it("returns undefined for unknown paths", () => {
    expect(getAuthIntentFromPath("/unknown")).toBeUndefined();
  });
});

describe("getAuthResumeLabel", () => {
  it("returns resumeLabel when provided", () => {
    expect(getAuthResumeLabel({ resumeLabel: "Custom" })).toBe("Custom");
  });

  it("returns label from intent", () => {
    expect(getAuthResumeLabel({ intent: "research" })).toBe("Research");
    expect(getAuthResumeLabel({ intent: "practice" })).toBe("Practice");
  });

  it("derives label from pathname", () => {
    expect(getAuthResumeLabel({ from: { pathname: "/dashboard" } })).toBe("Dashboard");
  });

  it("returns null when no info available", () => {
    expect(getAuthResumeLabel(null)).toBeNull();
    expect(getAuthResumeLabel({})).toBeNull();
  });
});

describe("createAuthReturnState", () => {
  it("splits query string from pathname", () => {
    const state = createAuthReturnState({
      pathname: "/dashboard?searchId=abc",
    });
    expect(state.from.pathname).toBe("/dashboard");
    expect(state.from.search).toBe("?searchId=abc");
    expect(state.intent).toBe("dashboard");
    expect(state.resumeLabel).toBe("Dashboard");
  });

  it("preserves explicit intent and source", () => {
    const state = createAuthReturnState({
      pathname: "/",
      intent: "research",
      source: "research_home",
      draftStorageKey: "draft-key",
    });
    expect(state.intent).toBe("research");
    expect(state.source).toBe("research_home");
    expect(state.draftStorageKey).toBe("draft-key");
  });
});
