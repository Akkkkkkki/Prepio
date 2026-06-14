import { describe, expect, it } from "vitest";
import {
  buildEvidenceLedger,
  formatEvidenceLedgerForPrompt,
  sanitizePlanEvidenceCitations,
  validateEvidenceIds,
} from "./evidence-ledger.ts";

describe("buildEvidenceLedger", () => {
  it("builds stable ledger rows from user inputs and real retrieval payloads", () => {
    const ledger = buildEvidenceLedger({
      company: "Acme",
      userNote: "Recruiter said there will be a hiring-manager screen.",
      jobDescription: "Own payments APIs and observability for checkout.",
      cvText: "Senior engineer with payments and incident response experience.",
      companyResearchData: {
        search_results: [
          {
            query: "acme interviews",
            results: [
              {
                title: "Acme careers interview guide",
                url: "https://careers.acme.com/interview-guide",
                content: "Acme describes a values and technical interview loop.",
                score: 0.91,
                published_date: "2026-01-10",
              },
              {
                title: "Acme interview report",
                url: "https://www.glassdoor.com/Interview/acme-interview.htm",
                content: "Candidates report a technical screen and onsite loop.",
                score: 0.7,
              },
              {
                title: "Bad URL",
                url: "javascript:alert(1)",
                content: "This should never enter the ledger.",
              },
            ],
          },
        ],
      },
      jobRawData: {
        results: [
          {
            title: "Staff Engineer posting",
            url: "https://jobs.acme.com/staff-engineer",
            raw_content: "The role requires API design, debugging, and mentoring.",
          },
        ],
      },
    });

    expect(ledger.map((entry) => entry.id)).toEqual(["ev-1", "ev-2", "ev-3", "ev-4", "ev-5", "ev-6"]);
    expect(ledger[0]).toMatchObject({
      sourceType: "user_note",
      sourceLabel: "User note",
      url: null,
      trustWeight: "high",
    });
    expect(ledger[1]).toMatchObject({
      sourceType: "official_job",
      sourceLabel: "Pasted job description",
      trustWeight: "high",
    });
    expect(ledger[3]).toMatchObject({
      sourceType: "official_job",
      platform: "careers.acme.com",
      publishedDate: "2026-01-10",
      trustWeight: "high",
    });
    expect(ledger[4]).toMatchObject({
      sourceType: "public_report",
      platform: "glassdoor.com",
      trustWeight: "medium",
    });
    expect(ledger.some((entry) => entry.url?.startsWith("javascript:"))).toBe(false);
  });

  it("deduplicates retrieved URLs before assigning final evidence IDs", () => {
    const ledger = buildEvidenceLedger({
      company: "Acme",
      companyResearchData: {
        search_results: [
          {
            query: "a",
            results: [
              {
                title: "Same report",
                url: "https://reddit.com/r/jobs/comments/1",
                content: "First snippet.",
              },
            ],
          },
          {
            query: "b",
            results: [
              {
                title: "Same report duplicate",
                url: "https://reddit.com/r/jobs/comments/1",
                content: "Second snippet.",
              },
            ],
          },
        ],
      },
    });

    expect(ledger).toHaveLength(1);
    expect(ledger[0].id).toBe("ev-1");
    expect(ledger[0].excerpt).toBe("First snippet.");
  });
});

describe("evidence citation validation", () => {
  it("keeps only IDs that resolve to the ledger", () => {
    const ledger = buildEvidenceLedger({
      company: "Acme",
      userNote: "Known phone screen.",
      jobDescription: "Build data products.",
    });

    expect(validateEvidenceIds(["ev-2", "ev-999", "ev-2", 3], ledger)).toEqual({
      validIds: ["ev-2"],
      droppedIds: ["ev-999"],
    });
  });

  it("sanitizes stage and question citations and replaces model evidence rows", () => {
    const ledger = buildEvidenceLedger({
      company: "Acme",
      userNote: "Known phone screen.",
      jobDescription: "Build data products.",
    });
    const plan = {
      stageRoadmap: [{ stageName: "Phone Screen", evidenceIds: ["ev-1", "ev-404"] }],
      questionPlan: {
        coreMustPractice: [{ question: "Why Acme?", evidenceIds: ["ev-2", "made-up"] }],
        likelyFollowUps: [{ question: "Tell me more", evidenceIds: [] }],
        extraDepth: [{ question: "Deep dive" }],
      },
      internalEvidenceLog: [{ id: "model-row", url: "https://invented.example" }],
    };

    const result = sanitizePlanEvidenceCitations(plan, ledger);

    expect(result).toEqual({
      droppedCitationIds: ["ev-404", "made-up"],
      ledgerCount: 2,
    });
    expect(plan.stageRoadmap[0].evidenceIds).toEqual(["ev-1"]);
    expect(plan.questionPlan.coreMustPractice[0].evidenceIds).toEqual(["ev-2"]);
    expect(plan.internalEvidenceLog).toEqual(ledger);
  });

  it("marks zero-ledger plans as weak signal and low confidence", () => {
    const plan = {
      summary: { weakSignalCase: false, overallConfidence: "high" },
      stageRoadmap: [],
      questionPlan: {},
      internalEvidenceLog: [{ id: "model-row", url: "https://invented.example" }],
    };

    const result = sanitizePlanEvidenceCitations(plan, []);

    expect(result).toEqual({ droppedCitationIds: [], ledgerCount: 0 });
    expect(plan.summary).toMatchObject({
      weakSignalCase: true,
      overallConfidence: "low",
    });
    expect(plan.internalEvidenceLog).toEqual([]);
  });
});

describe("formatEvidenceLedgerForPrompt", () => {
  it("prints ledger IDs and snippets but has an honest zero-ledger state", () => {
    expect(formatEvidenceLedgerForPrompt([])).toContain("No verified evidence ledger entries");

    const ledger = buildEvidenceLedger({
      company: "Acme",
      userNote: "Known recruiter screen.",
    });
    const promptBlock = formatEvidenceLedgerForPrompt(ledger);

    expect(promptBlock).toContain("ev-1 | user_note");
    expect(promptBlock).toContain("Snippet passed to model: Known recruiter screen.");
  });
});
