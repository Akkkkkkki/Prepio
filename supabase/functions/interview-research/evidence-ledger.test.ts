import { describe, expect, it } from "vitest";
import {
  buildEvidenceLedger,
  formatEvidenceLedgerForPrompt,
  sanitizePlanEvidenceCitations,
  validateEvidenceIds,
} from "./evidence-ledger.ts";

describe("buildEvidenceLedger", () => {
  it("builds stable rows from user inputs and retrieved sources", () => {
    const input = {
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
                raw_content: "",
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
                title: "Unsafe source",
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
            url: "https://boards.greenhouse.io/acme/jobs/4012",
            raw_content: "The role requires API design, debugging, and mentoring.",
          },
        ],
      },
    };

    const ledger = buildEvidenceLedger(input);
    const repeated = buildEvidenceLedger(input);

    expect(ledger.map((entry) => entry.id)).toEqual([
      "ev-1",
      "ev-2",
      "ev-3",
      "ev-4",
      "ev-5",
      "ev-6",
    ]);
    expect(repeated).toEqual(ledger);
    expect(ledger[0]).toMatchObject({
      sourceType: "user_note",
      sourceLabel: "User note",
      url: null,
      trustWeight: "high",
    });
    expect(ledger[1]).toMatchObject({
      sourceType: "official_job",
      sourceLabel: "Pasted job description",
      platform: "user",
      trustWeight: "high",
    });
    expect(ledger[3]).toMatchObject({
      sourceType: "official_company",
      platform: "careers.acme.com",
      publishedDate: "2026-01-10",
      trustWeight: "high",
    });
    expect(ledger[4]).toMatchObject({
      sourceType: "public_report",
      platform: "glassdoor.com",
      trustWeight: "medium",
    });
    expect(ledger[5]).toMatchObject({
      sourceType: "official_job",
      platform: "boards.greenhouse.io",
      trustWeight: "high",
    });
    expect(ledger.some((entry) => entry.url?.startsWith("javascript:"))).toBe(false);
  });

  it("grants official_job only to known ATS hosts, not caller-shaped URLs", () => {
    const ledger = buildEvidenceLedger({
      company: "Acme",
      jobRawData: {
        results: [
          // A real posting on a known ATS host resolves to official_job.
          {
            title: "Staff Engineer posting",
            url: "https://boards.greenhouse.io/acme/jobs/4012",
            raw_content: "The role requires API design and mentoring.",
          },
          // An unrelated URL pasted as a roleLink must not inherit official_job
          // high trust just because it arrived through the job pipeline.
          {
            title: "Random blog post",
            url: "https://random-blog.example.net/opinions/hiring",
            content: "An unrelated article that is neither a posting nor Acme.",
          },
          // A caller-controlled `/jobs/` path on an unrelated host must not be
          // enough on its own — job origin is decided by hostname, not path.
          {
            title: "Careers hot takes",
            url: "https://unrelated.example/jobs/opinion",
            content: "An opinion column that merely has a jobs-shaped path.",
          },
          // A `jobs.` subdomain is caller-controllable too — an attacker can
          // serve a posting from jobs.attacker.example, so it stays low trust.
          {
            title: "Lookalike posting",
            url: "https://jobs.attacker.example/acme/staff-engineer",
            content: "A posting-shaped page on an attacker-controlled subdomain.",
          },
        ],
      },
    });

    expect(ledger).toHaveLength(4);
    expect(ledger[0]).toMatchObject({
      sourceType: "official_job",
      platform: "boards.greenhouse.io",
      trustWeight: "high",
    });
    expect(ledger[1]).toMatchObject({
      sourceType: "market_heuristic",
      platform: "random-blog.example.net",
      trustWeight: "low",
    });
    expect(ledger[2]).toMatchObject({
      sourceType: "market_heuristic",
      platform: "unrelated.example",
      trustWeight: "low",
    });
    expect(ledger[3]).toMatchObject({
      sourceType: "market_heuristic",
      platform: "jobs.attacker.example",
      trustWeight: "low",
    });
  });

  it("keeps employer trust for short company names on their own domain", () => {
    const ledger = buildEvidenceLedger({
      company: "BP",
      jobRawData: {
        results: [
          // Root-domain posting for a short name the >=3-char token heuristic
          // can't match — an exact second-level-label match keeps employer trust.
          {
            title: "Refinery Engineer",
            url: "https://bp.com/careers/refinery-engineer",
            raw_content: "Own refinery reliability and process safety.",
          },
          // The same short name on a multi-label public suffix (bp.co.uk) must
          // resolve to the registrable label `bp`, not the suffix `co`.
          {
            title: "UK Refinery Engineer",
            url: "https://bp.co.uk/careers/uk-refinery-engineer",
            content: "Own UK refinery reliability and process safety.",
          },
          // A short name must not match as an attacker-controlled subdomain:
          // the registrable label of bp.evil.example is `evil`, not `bp`.
          {
            title: "Not really BP",
            url: "https://bp.evil.example/careers/refinery-engineer",
            content: "A lookalike host that is not the employer's domain.",
          },
          // Nor as a subdomain on a country domain: the registrable label of
          // bp.attacker.co.uk is `attacker`, not `bp`.
          {
            title: "Also not BP",
            url: "https://bp.attacker.co.uk/careers/refinery-engineer",
            content: "Another lookalike host that is not the employer's domain.",
          },
        ],
      },
    });

    expect(ledger).toHaveLength(4);
    expect(ledger[0]).toMatchObject({
      sourceType: "official_company",
      platform: "bp.com",
      trustWeight: "high",
    });
    expect(ledger[1]).toMatchObject({
      sourceType: "official_company",
      platform: "bp.co.uk",
      trustWeight: "high",
    });
    expect(ledger[2]).toMatchObject({
      sourceType: "market_heuristic",
      platform: "bp.evil.example",
      trustWeight: "low",
    });
    expect(ledger[3]).toMatchObject({
      sourceType: "market_heuristic",
      platform: "bp.attacker.co.uk",
      trustWeight: "low",
    });
  });

  it("deduplicates URLs and keeps the richest retrieved snippet", () => {
    const ledger = buildEvidenceLedger({
      company: "Acme",
      companyResearchData: {
        search_results: [
          {
            results: [
              {
                title: "Short report",
                url: "https://reddit.com/r/jobs/comments/1#comments",
                content: "Short snippet.",
              },
            ],
          },
        ],
        extracted_content: [
          {
            title: "Deep report",
            url: "https://reddit.com/r/jobs/comments/1",
            raw_content: "A longer extracted report describing the recruiter and onsite rounds.",
          },
        ],
      },
    });

    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      id: "ev-1",
      sourceType: "public_report",
      sourceLabel: "Deep report",
      snippet: "A longer extracted report describing the recruiter and onsite rounds.",
    });
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

  it("sanitizes every citation and replaces model-authored evidence rows", () => {
    const ledger = buildEvidenceLedger({
      company: "Acme",
      userNote: "Known phone screen.",
      jobDescription: "Build data products.",
    });
    // `evidenceIds` is optional on the way in — a model may omit it entirely,
    // and the sanitizer's job is to normalize that to []. Without the explicit
    // annotation TypeScript narrows `likelyFollowUps[0]` to `{ question: string }`
    // and the assertion below fails to compile.
    const plan: {
      summary: Record<string, unknown>;
      stageRoadmap: Array<{ stageName: string; evidenceIds?: string[] }>;
      questionPlan: {
        coreMustPractice: Array<{ question: string; evidenceIds?: string[] }>;
        likelyFollowUps: Array<{ question: string; evidenceIds?: string[] }>;
        extraDepth: Array<{ question: string; evidenceIds?: string[] }>;
      };
      internalEvidenceLog: unknown[];
    } = {
      summary: { weakSignalCase: false, overallConfidence: "high" },
      stageRoadmap: [{ stageName: "Phone Screen", evidenceIds: ["ev-1", "ev-404"] }],
      questionPlan: {
        coreMustPractice: [{ question: "Why Acme?", evidenceIds: ["ev-2", "made-up"] }],
        likelyFollowUps: [{ question: "Tell me more" }],
        extraDepth: [],
      },
      internalEvidenceLog: [{ id: "model-row", url: "https://invented.example" }],
    };

    const result = sanitizePlanEvidenceCitations(plan, ledger);

    expect(result).toEqual({
      droppedCitationIds: ["ev-404", "made-up"],
      downgradedStageNames: [],
      ledgerCount: 2,
    });
    expect(plan.stageRoadmap[0].evidenceIds).toEqual(["ev-1"]);
    expect(plan.questionPlan.coreMustPractice[0].evidenceIds).toEqual(["ev-2"]);
    expect(plan.questionPlan.likelyFollowUps[0].evidenceIds).toEqual([]);
    expect(plan.internalEvidenceLog).toEqual(ledger);
  });

  it("forces an honest weak-signal plan when no ledger exists", () => {
    const plan = {
      summary: { weakSignalCase: false, overallConfidence: "high" },
      stageRoadmap: [],
      questionPlan: {},
      internalEvidenceLog: [{ id: "model-row", url: "https://invented.example" }],
    };

    const result = sanitizePlanEvidenceCitations(plan, []);

    expect(result).toEqual({
      droppedCitationIds: [],
      downgradedStageNames: [],
      ledgerCount: 0,
    });
    expect(plan.summary).toMatchObject({
      weakSignalCase: true,
      overallConfidence: "low",
    });
    expect(plan.internalEvidenceLog).toEqual([]);
  });

  it("downgrades stages left with no verified citation", () => {
    const ledger = buildEvidenceLedger({
      company: "Acme",
      userNote: "Known phone screen.",
      jobDescription: "Build data products.",
    });
    const plan = {
      summary: { weakSignalCase: false, overallConfidence: "high" },
      stageRoadmap: [
        // Cites only an ID that does not exist — nothing verified survives.
        {
          stageName: "Onsite Loop",
          evidenceIds: ["ev-999"],
          confidence: "high",
          lowConfidenceGuidance: null,
        },
        // Never cited anything at all.
        { stageName: "Take-home", confidence: "medium", lowConfidenceGuidance: null },
        // Genuinely supported: must keep the model's grade untouched.
        { stageName: "Phone Screen", evidenceIds: ["ev-1"], confidence: "high" },
      ],
      questionPlan: {},
      internalEvidenceLog: [],
    };

    const result = sanitizePlanEvidenceCitations(plan, ledger);

    expect(result.downgradedStageNames).toEqual(["Onsite Loop", "Take-home"]);
    expect(plan.stageRoadmap[0].confidence).toBe("low");
    expect(plan.stageRoadmap[0].lowConfidenceGuidance).toContain("No verified source");
    expect(plan.stageRoadmap[1].confidence).toBe("low");
    expect(plan.stageRoadmap[2].confidence).toBe("high");
    expect(plan.stageRoadmap[2].evidenceIds).toEqual(["ev-1"]);
  });

  it("keeps guidance the model already wrote for an unsupported stage", () => {
    const plan = {
      summary: {},
      stageRoadmap: [
        {
          stageName: "Onsite Loop",
          evidenceIds: [],
          confidence: "high",
          lowConfidenceGuidance: "Ask your recruiter how the loop is structured.",
        },
      ],
      questionPlan: {},
      internalEvidenceLog: [],
    };

    sanitizePlanEvidenceCitations(plan, []);

    expect(plan.stageRoadmap[0].confidence).toBe("low");
    expect(plan.stageRoadmap[0].lowConfidenceGuidance).toBe(
      "Ask your recruiter how the loop is structured.",
    );
  });
});

describe("formatEvidenceLedgerForPrompt", () => {
  it("uses stable IDs and exposes no invented zero-ledger source", () => {
    expect(formatEvidenceLedgerForPrompt([])).toContain(
      "No verified evidence ledger entries",
    );

    const ledger = buildEvidenceLedger({
      company: "Acme",
      userNote: "Known recruiter screen.",
    });
    const promptBlock = formatEvidenceLedgerForPrompt(ledger);

    expect(promptBlock).toContain("ev-1 | user_note");
    expect(promptBlock).toContain("Snippet passed to model: Known recruiter screen.");
  });
});
