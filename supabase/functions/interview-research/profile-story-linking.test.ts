import { describe, expect, it } from "vitest";
import {
  matchStoryForQuestion,
  resolveOrMatchStoryForQuestion,
  resolveStoryAlias,
  serializeProfileForPrompt,
  type CandidateProfileForStoryLinking,
} from "./profile-story-linking.ts";

const profile: CandidateProfileForStoryLinking = {
  headline: "Senior product manager",
  summary: "Builds B2B platforms and leads ambiguous launches.",
  experiences: [
    {
      title: "Senior PM",
      company: "Acme",
      summary: "Owned platform strategy.",
      bullets: [
        {
          id: "exp-short-star",
          text: "Aligned sales, engineering, and design on a billing launch.",
          competencyTags: ["stakeholder alignment"],
          interviewThemes: ["collaboration", "launch leadership"],
          focusAreas: ["execution"],
          starStory: true,
        },
        {
          id: "exp-long",
          text: "Led a multi-quarter migration that cut enterprise onboarding time by 40 percent while preserving support SLAs.",
          competencyTags: ["execution quality", "migration"],
          interviewThemes: ["program leadership"],
          focusAreas: ["platform"],
          starStory: false,
        },
        {
          id: "exp-short",
          text: "Maintained roadmap hygiene.",
          competencyTags: ["roadmap"],
          interviewThemes: ["planning"],
          focusAreas: ["product"],
          starStory: false,
        },
      ],
    },
  ],
  projects: [
    {
      title: "Pricing Revamp",
      context: "Subscription packaging project.",
      technologies: ["Stripe"],
      tags: ["monetization"],
      bullets: [
        {
          id: "project-pricing",
          text: "Validated pricing tiers with finance and customer success before launch.",
          competencyTags: ["pricing strategy"],
          interviewThemes: ["monetization", "stakeholder alignment"],
          focusAreas: ["finance"],
          starStory: false,
        },
      ],
    },
  ],
  skills: [{ name: "Product", skills: ["Roadmapping", "Pricing", "Research"] }],
};

describe("profile story linking helpers", () => {
  it("serializes a bounded profile prompt with stable aliases and STAR priority", () => {
    const context = serializeProfileForPrompt(profile, {
      charBudget: 1000,
      maxExperienceBullets: 2,
      maxProjectBullets: 1,
    });

    expect(context).not.toBeNull();
    expect(context?.aliasToBulletId).toEqual({
      S1: "exp-short-star",
      S2: "exp-long",
      S3: "project-pricing",
    });
    expect(context?.promptBlock).toContain("STAR-FLAGGED STORIES AVAILABLE TO CITE: S1");
    expect(context?.promptBlock).toContain("Skills: Roadmapping, Pricing, Research");
    expect(context?.promptBlock.length).toBeLessThanOrEqual(1000);
    expect(context?.promptBlock).not.toContain("Maintained roadmap hygiene");
  });

  it("resolves cited aliases defensively", () => {
    const context = serializeProfileForPrompt(profile);

    expect(resolveStoryAlias("S1", context)?.realBulletId).toBe("exp-short-star");
    expect(resolveStoryAlias("S999", context)).toBeNull();
    expect(resolveStoryAlias(null, context)).toBeNull();
  });

  it("matches by deterministic tag overlap with STAR and order tie-breaks", () => {
    const context = serializeProfileForPrompt(profile);

    expect(
      matchStoryForQuestion(
        {
          question: "Tell me about stakeholder alignment during a launch.",
          reason: "Tests collaboration and execution.",
        },
        context,
      )?.realBulletId,
    ).toBe("exp-short-star");

    expect(
      matchStoryForQuestion(
        {
          question: "How would you analyze an unrelated market sizing case?",
          reason: "No profile tags overlap.",
        },
        context,
      ),
    ).toBeNull();
  });

  it("falls back to deterministic matching after a hallucinated alias", () => {
    const context = serializeProfileForPrompt(profile);

    expect(
      resolveOrMatchStoryForQuestion(
        {
          question: "How did you lead pricing strategy with finance?",
          reason: "Tests monetization and pricing strategy.",
          leveragesStoryId: "S42",
        },
        context,
      )?.realBulletId,
    ).toBe("project-pricing");
  });
});
