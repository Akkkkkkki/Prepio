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
});
