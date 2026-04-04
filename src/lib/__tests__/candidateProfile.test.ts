import { describe, expect, it } from "vitest";

import {
  buildProfileImportReview,
  candidateProfileFromLegacyParsedData,
  computeCandidateProfileCompletion,
  createEmptyCandidateProfile,
  createEmptyExperience,
  createEmptyProject,
  createEmptySkillGroup,
  getDefaultMergeAction,
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
});
