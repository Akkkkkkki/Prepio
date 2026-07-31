import { describe, expect, it } from "vitest";
import { buildResearchQueryPlan, classifyRoleFamily } from "./query-planner.ts";

describe("classifyRoleFamily", () => {
  it("classifies consulting and finance before the generic tech fallback", () => {
    expect(classifyRoleFamily("Associate Consultant")).toBe("consulting");
    expect(classifyRoleFamily("Investment Banking Analyst")).toBe("finance");
    expect(classifyRoleFamily("Machine Learning Engineer")).toBe("tech");
    expect(classifyRoleFamily("Operations Lead")).toBe("other");
  });

  it("uses the user note when the role title is ambiguous", () => {
    expect(classifyRoleFamily("Associate", "Preparing for a case interview with Bain")).toBe("consulting");
    expect(classifyRoleFamily("Associate", "Need valuation and LBO modeling practice")).toBe("finance");
  });

  it("does not treat non-finance analyst roles as finance", () => {
    expect(classifyRoleFamily("Data Analyst")).toBe("other");
    expect(classifyRoleFamily("Security Analyst")).toBe("tech");
    expect(classifyRoleFamily("Product Analyst")).toBe("other");
  });

  it("still classifies qualified finance analyst roles as finance", () => {
    expect(classifyRoleFamily("Equity Research Analyst")).toBe("finance");
    expect(classifyRoleFamily("Credit Risk Analyst")).toBe("finance");
    expect(classifyRoleFamily("Investment Banking Analyst")).toBe("finance");
  });
});

describe("buildResearchQueryPlan", () => {
  it("selects consulting domains and case-shaped queries", () => {
    const plan = buildResearchQueryPlan({
      company: "McKinsey",
      role: "Associate Consultant",
      country: "UK",
      level: "junior",
      userNote: "Meeting the Strategy team for a case interview",
      maxQueries: 6,
    });

    expect(plan.roleFamily).toBe("consulting");
    expect(plan.includeDomains).toEqual(
      expect.arrayContaining(["caseinterview.com", "managementconsulted.com", "preplounge.com"]),
    );
    expect(plan.includeDomains).not.toContain("leetcode.com");
    expect(plan.queries.map((q) => q.query).join("\n")).toMatch(/case interview/);
    expect(plan.queries.map((q) => q.query).join("\n")).toMatch(/UK/);
    expect(plan.signals.level).toContain("new grad");
    expect(plan.signals.userNote).toEqual(expect.arrayContaining(["Strategy team", "case interview"]));
  });

  it("selects finance domains and keeps the query count inside the requested budget", () => {
    const plan = buildResearchQueryPlan({
      company: "Goldman Sachs",
      role: "Investment Banking Analyst",
      country: "US",
      level: "senior_ic",
      userNote: "Focus on DCF and financial modeling",
      maxQueries: 4,
    });

    expect(plan.roleFamily).toBe("finance");
    expect(plan.includeDomains).toEqual(
      expect.arrayContaining(["wallstreetoasis.com", "mergersandinquisitions.com", "efinancialcareers.com"]),
    );
    expect(plan.queries).toHaveLength(4);
    expect(plan.budget).toEqual({ maxQueries: 4, plannedQueries: 4 });
    expect(plan.queries.map((q) => q.query).join("\n")).toMatch(/financial modeling|Investment Banking Analyst/);
  });

  it("keeps technical queries in the tech pack for engineering roles", () => {
    const plan = buildResearchQueryPlan({
      company: "OpenAI",
      role: "Research Engineer",
      level: "people_manager",
      maxQueries: 6,
    });

    expect(plan.roleFamily).toBe("tech");
    expect(plan.includeDomains).toEqual(
      expect.arrayContaining(["blind.teamblind.com", "levels.fyi", "leetcode.com", "interviewing.io"]),
    );
    expect(plan.queries.map((q) => q.query).join("\n")).toMatch(/manager leadership people management/);
    expect(plan.includeDomains).not.toContain("wallstreetoasis.com");
  });

  it("keeps ambiguous roles in the general research pack", () => {
    const plan = buildResearchQueryPlan({
      company: "Stripe",
      role: "Operations Lead",
      country: "Ireland",
      level: "mid",
      maxQueries: 6,
    });

    const queries = plan.queries.map((q) => q.query).join("\n");

    expect(plan.roleFamily).toBe("other");
    expect(plan.includeDomains).toEqual(
      expect.arrayContaining(["glassdoor.com", "reddit.com", "linkedin.com", "indeed.com"]),
    );
    expect(plan.includeDomains).not.toContain("leetcode.com");
    expect(plan.includeDomains).not.toContain("wallstreetoasis.com");
    expect(plan.includeDomains).not.toContain("caseinterview.com");
    expect(plan.queries.map((q) => q.source)).toEqual(expect.arrayContaining(["linkedin", "indeed", "general"]));
    expect(queries).toMatch(/Operations Lead/);
    expect(queries).toMatch(/Ireland/);
    expect(queries).toMatch(/mid level/);
    expect(plan.budget).toEqual({ maxQueries: 6, plannedQueries: 5 });
  });

  it("turns interviewer and team notes into attributed targeted searches", () => {
    const plan = buildResearchQueryPlan({
      company: "Stripe",
      role: "Product Manager",
      userNote: "Meeting Alex Chen from the Payments team; she has recent conference talks and blog posts.",
      maxQueries: 8,
    });

    const targeted = plan.queries.filter((query) => query.source.startsWith("user-note-"));
    const targetedText = targeted.map((query) => query.query).join("\n");

    expect(plan.signals.userNote).toEqual(expect.arrayContaining(["Payments team", "Alex Chen"]));
    expect(targeted.map((query) => query.source)).toEqual(
      expect.arrayContaining(["user-note-linkedin", "user-note-blog", "user-note-talk"]),
    );
    expect(targetedText).toMatch(/"Alex Chen"/);
    expect(targetedText).toMatch(/"Payments team"/);
    expect(targetedText).toMatch(/site:linkedin\.com/);
    expect(targetedText).toMatch(/blog|site:medium\.com|site:substack\.com/);
    expect(targetedText).toMatch(/talk|conference|site:youtube\.com/);
    expect(plan.includeDomains).toEqual(
      expect.arrayContaining(["linkedin.com", "medium.com", "substack.com", "youtube.com"]),
    );
  });

  it("preserves team-first note signals for targeted searches", () => {
    const plan = buildResearchQueryPlan({
      company: "Stripe",
      role: "Product Manager",
      userNote: "Interviewing with team Payments",
      maxQueries: 8,
    });

    expect(plan.signals.userNote).toContain("Payments team");
    expect(plan.queries.find((query) => query.source === "user-note-linkedin")?.query).toMatch(
      /"Payments team"/,
    );
  });

  it("uses the first team mention when notes contain both supported forms", () => {
    const plan = buildResearchQueryPlan({
      company: "Stripe",
      role: "Product Manager",
      userNote: "Interviewing with team Payments and the Platform org",
      maxQueries: 8,
    });

    expect(plan.signals.userNote).toContain("Payments team");
    expect(plan.signals.userNote).not.toContain("Platform team");
    expect(plan.queries.find((query) => query.source === "user-note-linkedin")?.query).toMatch(
      /"Payments team"/,
    );
  });

  it("uses the suffix-form team mention when it appears before a team-first note", () => {
    const plan = buildResearchQueryPlan({
      company: "Stripe",
      role: "Product Manager",
      userNote: "Interviewing with the Platform org before team Payments",
      maxQueries: 8,
    });

    expect(plan.signals.userNote).toContain("Platform team");
    expect(plan.signals.userNote).not.toContain("Payments team");
    expect(plan.queries.find((query) => query.source === "user-note-linkedin")?.query).toMatch(
      /"Platform team"/,
    );
  });

  it("skips leading articles and pronouns when naming the team", () => {
    const plan = buildResearchQueryPlan({
      company: "Stripe",
      role: "Product Manager",
      userNote: "The Payments team runs the loop",
      maxQueries: 8,
    });

    expect(plan.signals.userNote).toContain("Payments team");
    expect(plan.signals.userNote).not.toContain("The Payments team");
  });

  it("falls back to a later mention when the earliest one is only a stopword", () => {
    const plan = buildResearchQueryPlan({
      company: "Stripe",
      role: "Product Manager",
      userNote: "The org Payments team is hiring",
      maxQueries: 8,
    });

    expect(plan.signals.userNote).toContain("Payments team");
    expect(plan.signals.userNote).not.toContain("The team");
  });

  it("does not treat incidental verb usage as a team signal", () => {
    const plan = buildResearchQueryPlan({
      company: "Stripe",
      role: "Product Manager",
      userNote: "I team up with a partner for the exercise",
      maxQueries: 8,
    });

    expect(plan.signals.userNote).not.toContain("I team");
    expect(plan.queries.some((query) => query.source.startsWith("user-note-"))).toBe(false);
  });

  it("does not turn a named team lead into a team signal", () => {
    const plan = buildResearchQueryPlan({
      company: "Stripe",
      role: "Product Manager",
      userNote: "Chat with team Lead Sarah Chen",
      maxQueries: 8,
    });

    expect(plan.signals.userNote.some((signal) => signal.endsWith(" team"))).toBe(false);
  });

  it("does not also read a team name as an interviewer", () => {
    const plan = buildResearchQueryPlan({
      company: "Stripe",
      role: "Product Manager",
      userNote: "Interviewing with the Data Platform team",
      maxQueries: 8,
    });

    expect(plan.signals.userNote).toEqual(["Data Platform team"]);
    expect(plan.queries.find((query) => query.source === "user-note-linkedin")?.query).not.toMatch(
      /"Data Platform"\s/,
    );
  });

  it("does not emit a truncated interviewer from a three-word team name", () => {
    const plan = buildResearchQueryPlan({
      company: "Stripe",
      role: "Product Manager",
      userNote: "Interviewing with the Core Data Platform team",
      maxQueries: 8,
    });

    expect(plan.signals.userNote).toEqual(["Core Data Platform team"]);
    expect(plan.signals.userNote).not.toContain("Core Data");
  });

  it("still finds a named interviewer mentioned after a team", () => {
    const plan = buildResearchQueryPlan({
      company: "Stripe",
      role: "Product Manager",
      userNote: "Interviewing with the Data Platform team, meeting Priya Nair",
      maxQueries: 8,
    });

    expect(plan.signals.userNote).toEqual(
      expect.arrayContaining(["Data Platform team", "Priya Nair"]),
    );
  });

  it("preserves role-family coverage inside the production query budget", () => {
    const plan = buildResearchQueryPlan({
      company: "Stripe",
      role: "Product Manager",
      userNote: "Meeting Alex Chen from the Payments team; she has recent conference talks and blog posts.",
      maxQueries: 6,
    });

    const sources = plan.queries.map((query) => query.source);
    const targeted = plan.queries.find((query) => query.source === "user-note-linkedin");

    expect(sources).toEqual(expect.arrayContaining(["blind", "leetcode", "levels", "user-note-linkedin"]));
    expect(targeted?.query).toMatch(/"Alex Chen"/);
    expect(targeted?.query).toMatch(/"Payments team"/);
  });
});
