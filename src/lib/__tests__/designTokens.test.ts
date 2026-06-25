import { describe, expect, it } from "vitest";

import {
  accentLabelClassName,
  badgeToneClassName,
  sectionLabelClassName,
  surfaceRadiusClassName,
} from "../designTokens";

describe("design token constraints", () => {
  it("keeps product surfaces on the documented two-step radius scale", () => {
    expect(Object.values(surfaceRadiusClassName)).toEqual(["rounded-xl", "rounded-[20px]"]);
  });

  it("keeps badge tones to neutral metadata and primary accent", () => {
    expect(Object.keys(badgeToneClassName)).toEqual(["neutral", "accent"]);
    expect(badgeToneClassName.neutral).toContain("text-muted-foreground");
    expect(badgeToneClassName.accent).toContain("text-primary");
  });

  it("uses sentence-case micro-labels by default", () => {
    expect(sectionLabelClassName).not.toContain("uppercase");
    expect(sectionLabelClassName).not.toContain("tracking-");
    expect(accentLabelClassName).not.toContain("uppercase");
    expect(accentLabelClassName).not.toContain("tracking-");
  });
});

