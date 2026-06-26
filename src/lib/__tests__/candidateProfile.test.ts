import { describe, expect, it } from "vitest";

import {
  buildProfileImportReview,
  candidateProfileFromLegacyParsedData,
  computeCandidateProfileCompletion,
  createEmptyCandidateProfile,
  createEmptyExperience,
  createEmptyProject,
  createEmptySkillGroup,
  getCandidateProfileUnlock,
  getDefaultMergeAction,
  prepareProfileImportAutoApply,
  mergeImportedProfile,
  normalizeCandidateProfile,
} from "../candidateProfile";

describe("candidateProfile helpers", () => {
  it("converts legacy parsed resume data into a structured profile", () => {
    const profile = candidateProfileFromLegacyParsedData(
      {
        personalInfo: {
          location: "London",
          linkedin: "https://linkedin.com/in/jane",
        },
        professional: {
          currentRole: "Staff Product Manager",
          summary: "Built and launched growth products.",
          workHistory: [
            {
              title: "Product Manager",
              company: "Acme",
              duration: "2022-2025",
              description: "Led roadmap. Improved retention. Shipped pricing tests.",
            },
          ],
        },
        projects: [
          {
            name: "Marketplace Launch",
            description: "Created launch plan. Coordinated GTM.",
            technologies: ["SQL", "Looker"],
          },
        ],
        skills: {
          categories: [{ name: "Product", skills: ["Roadmapping", "Experimentation"] }],
        },
      },
      "user-1",
    );

    expect(profile.userId).toBe("user-1");
    expect(profile.headline).toBe("Staff Product Manager");
    expect(profile.experiences[0].bullets).toHaveLength(3);
    expect(profile.projects[0].technologies).toEqual(["SQL", "Looker"]);
    expect(profile.links[0].label).toBe("LinkedIn");
  });

  it("builds merge suggestions and keeps existing content by default on conflicts", () => {
    const current = normalizeCandidateProfile({
      userId: "user-1",
      headline: "Staff Engineer",
      experiences: [
        createEmptyExperience({
          id: "exp-current",
          company: "Acme",
          title: "Staff Engineer",
          startDate: "2022",
          summary: "Existing summary",
          bullets: [{ id: "bullet-1", text: "Mentored engineers" }],
        }),
      ],
      skills: [createEmptySkillGroup({ id: "skills-1", name: "Core", skills: ["React"] })],
    });

    const draft = normalizeCandidateProfile({
      userId: "user-1",
      headline: "Principal Engineer",
      experiences: [
        createEmptyExperience({
          id: "exp-import",
          company: "Acme",
          title: "Staff Engineer",
          startDate: "2022",
          summary: "Imported summary with more detail",
          bullets: [{ id: "bullet-2", text: "Scaled onboarding workflow" }],
        }),
      ],
      skills: [createEmptySkillGroup({ id: "skills-2", name: "Core", skills: ["TypeScript"] })],
    });

    const review = buildProfileImportReview(current, draft);
    const headlineSuggestion = review.mergeSuggestions.find((item) => item.section === "headline");
    const experienceSuggestion = review.mergeSuggestions.find(
      (item) => item.section === "experiences" && item.kind === "conflicts_existing",
    );

    expect(review.importSummary.conflictingCount).toBeGreaterThanOrEqual(2);
    expect(headlineSuggestion && getDefaultMergeAction(headlineSuggestion)).toBe("keep_existing");
    expect(experienceSuggestion && getDefaultMergeAction(experienceSuggestion)).toBe(
      "append_incoming",
    );
  });

  it("applies import decisions by appending new bullets and preserving richer profile content", () => {
    const current = normalizeCandidateProfile({
      userId: "user-1",
      headline: "Staff Engineer",
      summary: "Built the platform team.",
      experiences: [
        createEmptyExperience({
          id: "exp-current",
          company: "Acme",
          title: "Staff Engineer",
          startDate: "2022",
          summary: "Existing summary is longer",
          bullets: [{ id: "bullet-1", text: "Mentored engineers" }],
        }),
      ],
    });

    const draft = normalizeCandidateProfile({
      userId: "user-1",
      headline: "Principal Engineer",
      experiences: [
        createEmptyExperience({
          id: "exp-import",
          company: "Acme",
          title: "Staff Engineer",
          startDate: "2022",
          summary: "Short import summary",
          bullets: [{ id: "bullet-2", text: "Scaled onboarding workflow" }],
        }),
      ],
      projects: [
        createEmptyProject({
          id: "project-1",
          title: "Migration",
          context: "Moved a monolith to services.",
        }),
      ],
    });

    const review = buildProfileImportReview(current, draft);
    const merged = mergeImportedProfile(current, draft, review.mergeSuggestions, []);

    expect(merged.headline).toBe("Staff Engineer");
    expect(merged.experiences[0].summary).toBe("Existing summary is longer");
    expect(merged.experiences[0].bullets.map((item) => item.text)).toEqual([
      "Mentored engineers",
      "Scaled onboarding workflow",
    ]);
    expect(merged.projects).toHaveLength(1);
  });

  it("computes completion based on populated profile areas", () => {
    const empty = createEmptyCandidateProfile("user-1");
    const complete = normalizeCandidateProfile({
      userId: "user-1",
      headline: "Staff Engineer",
      summary: "Built core systems",
      location: "London",
      links: [{ id: "link-1", label: "LinkedIn", url: "https://linkedin.com/in/test" }],
      experiences: [
        createEmptyExperience({
          company: "Acme",
          title: "Staff Engineer",
          bullets: [{ text: "Shipped platform work" }, { text: "Led interviews" }],
        }),
      ],
      projects: [createEmptyProject({ title: "Migration", bullets: [{ text: "Moved services" }] })],
      skills: [createEmptySkillGroup({ name: "Core", skills: ["React", "TypeScript", "SQL", "AWS", "Leadership"] })],
      education: [{ id: "edu-1", degree: "BSc", institution: "UCL", year: "2018", description: "" }],
      preferences: { targetRoles: ["Staff"], targetIndustries: [], locations: [], workModes: [], notes: "" },
    });

    expect(computeCandidateProfileCompletion(empty)).toBe(0);
    expect(computeCandidateProfileCompletion(complete)).toBe(100);
  });

  it("returns the highest-value missing profile unlock without changing completion math", () => {
    const profile = normalizeCandidateProfile({
      userId: "user-1",
      headline: "Staff Engineer",
      summary: "Built core systems",
      location: "London",
      experiences: [
        createEmptyExperience({
          company: "Acme",
          title: "Staff Engineer",
          bullets: [
            { text: "Shipped platform work" },
            { text: "Led interviews", starStory: true },
          ],
        }),
      ],
      projects: [createEmptyProject({ title: "Migration", bullets: [{ text: "Moved services" }] })],
      skills: [createEmptySkillGroup({ name: "Core", skills: ["React", "TypeScript", "SQL", "AWS", "Leadership"] })],
      education: [{ id: "edu-1", degree: "BSc", institution: "UCL", year: "2018", description: "" }],
      certifications: [{ id: "cert-1", name: "AWS", issuer: "Amazon", year: "2024" }],
      links: [{ id: "link-1", label: "LinkedIn", url: "https://linkedin.com/in/test" }],
    });

    expect(profile.completionScore).toBe(100);
    expect(getCandidateProfileUnlock(profile)).toMatchObject({
      key: "star_stories",
      copy: "Flag 2 STAR stories to get them matched to your practice questions",
    });
  });

  it("falls through profile unlocks from metrics to target roles", () => {
    const profile = normalizeCandidateProfile({
      userId: "user-1",
      experiences: [
        createEmptyExperience({
          company: "Acme",
          title: "Staff Engineer",
          bullets: [
            { text: "Shipped platform work", starStory: true },
            { text: "Led interviews", starStory: true },
          ],
        }),
      ],
    });

    expect(getCandidateProfileUnlock(profile)?.key).toBe("quantified_bullets");

    const quantified = normalizeCandidateProfile({
      ...profile,
      experiences: [
        createEmptyExperience({
          company: "Acme",
          title: "Staff Engineer",
          bullets: [
            { text: "Reduced latency by 35%", starStory: true },
            { text: "Led 8 interviewers", starStory: true },
          ],
        }),
      ],
    });

    expect(getCandidateProfileUnlock(quantified)).toMatchObject({
      key: "target_roles",
      to: "/profile/preferences",
    });

    const ready = normalizeCandidateProfile({
      ...quantified,
      preferences: { ...quantified.preferences, targetRoles: ["Staff Engineer"] },
    });
    expect(getCandidateProfileUnlock(ready)).toBeNull();
  });

  it("auto-applies new imported content into an empty profile", () => {
    const current = createEmptyCandidateProfile("user-1");
    const draft = normalizeCandidateProfile({
      userId: "user-1",
      headline: "Staff Engineer",
      summary: "Built platform systems.",
      experiences: [createEmptyExperience({ id: "exp-1", company: "Acme", title: "Staff Engineer" })],
      skills: [createEmptySkillGroup({ id: "skills-1", name: "Core", skills: ["React", "TypeScript"] })],
      lastResumeId: "resume-1",
    });
    const review = buildProfileImportReview(current, draft);

    const result = prepareProfileImportAutoApply(current, {
      id: "import-1",
      userId: "user-1",
      resumeId: "resume-1",
      source: "manual",
      draftProfile: draft,
      mergeSuggestions: review.mergeSuggestions,
      importSummary: review.importSummary,
      status: "pending",
      createdAt: "2026-04-04T10:10:00.000Z",
      appliedAt: null,
    });

    expect(result.nextProfile.headline).toBe("Staff Engineer");
    expect(result.nextProfile.summary).toBe("Built platform systems.");
    expect(result.nextProfile.experiences).toHaveLength(1);
    expect(result.nextProfile.skills[0].skills).toEqual(["React", "TypeScript"]);
    expect(result.appliedCount).toBe(4);
    expect(result.conflictCount).toBe(0);
    expect(result.unresolvedSuggestions).toEqual([]);
    expect(result.importSummary).toEqual({
      newCount: 0,
      duplicateCount: 0,
      conflictingCount: 0,
      missingCount: 0,
    });
  });

  it("auto-applies a new role while leaving conflicting summary unresolved", () => {
    const current = normalizeCandidateProfile({
      userId: "user-1",
      summary: "Existing interview profile summary.",
      experiences: [
        createEmptyExperience({ id: "exp-current", company: "Acme", title: "Engineering Manager" }),
      ],
    });
    const draft = normalizeCandidateProfile({
      userId: "user-1",
      summary: "CV summary.",
      experiences: [
        createEmptyExperience({ id: "exp-new", company: "Beta", title: "Staff Engineer" }),
      ],
      lastResumeId: "resume-1",
    });
    const review = buildProfileImportReview(current, draft);

    const result = prepareProfileImportAutoApply(current, {
      id: "import-1",
      userId: "user-1",
      resumeId: "resume-1",
      source: "manual",
      draftProfile: draft,
      mergeSuggestions: review.mergeSuggestions,
      importSummary: review.importSummary,
      status: "pending",
      createdAt: "2026-04-04T10:10:00.000Z",
      appliedAt: null,
    });

    expect(result.nextProfile.summary).toBe("Existing interview profile summary.");
    expect(result.nextProfile.experiences.map((item) => item.company)).toEqual(["Acme", "Beta"]);
    expect(result.unresolvedSuggestions).toHaveLength(1);
    expect(result.unresolvedSuggestions[0]).toMatchObject({
      kind: "conflicts_existing",
      section: "summary",
    });
    expect(result.appliedCount).toBe(1);
    expect(result.conflictCount).toBe(1);
    expect(result.importSummary.conflictingCount).toBe(1);
  });

  it("does not surface duplicate or missing import suggestions after auto-apply", () => {
    const current = normalizeCandidateProfile({
      userId: "user-1",
      headline: "Staff Engineer",
      experiences: [
        createEmptyExperience({ id: "exp-current", company: "Acme", title: "Staff Engineer" }),
        createEmptyExperience({ id: "exp-missing", company: "OldCo", title: "Engineer" }),
      ],
    });
    const draft = normalizeCandidateProfile({
      userId: "user-1",
      headline: "Staff Engineer",
      experiences: [createEmptyExperience({ id: "exp-draft", company: "Acme", title: "Staff Engineer" })],
      lastResumeId: "resume-1",
    });
    const review = buildProfileImportReview(current, draft);

    const result = prepareProfileImportAutoApply(current, {
      id: "import-1",
      userId: "user-1",
      resumeId: "resume-1",
      source: "manual",
      draftProfile: draft,
      mergeSuggestions: review.mergeSuggestions,
      importSummary: review.importSummary,
      status: "pending",
      createdAt: "2026-04-04T10:10:00.000Z",
      appliedAt: null,
    });

    expect(review.mergeSuggestions.some((item) => item.kind === "possible_duplicate")).toBe(true);
    expect(review.mergeSuggestions.some((item) => item.kind === "missing_from_import")).toBe(true);
    expect(result.unresolvedSuggestions).toEqual([]);
    expect(result.importSummary.duplicateCount).toBe(0);
    expect(result.importSummary.missingCount).toBe(0);
  });
});
