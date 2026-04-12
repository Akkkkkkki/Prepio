#!/usr/bin/env -S deno test --allow-read

import { assertEquals } from "https://deno.land/std@0.192.0/testing/asserts.ts";

import {
  resolveExperienceLevel,
  type CanonicalLevel,
} from "../../../supabase/functions/interview-question-generator/experience-level.ts";

Deno.test("resolveExperienceLevel treats unknown as missing and falls back to CV inference", () => {
  assertEquals(
    resolveExperienceLevel("unknown", { experience_years: 1 }),
    {
      experienceLevel: "junior",
      experienceYears: 1,
      source: "cv",
    },
  );

  assertEquals(
    resolveExperienceLevel("unknown", { experience_years: 6 }),
    {
      experienceLevel: "mid",
      experienceYears: 6,
      source: "cv",
    },
  );

  assertEquals(
    resolveExperienceLevel("unknown", { experience_years: 10 }),
    {
      experienceLevel: "senior",
      experienceYears: 10,
      source: "cv",
    },
  );
});

Deno.test("resolveExperienceLevel defaults unknown with no CV to mid", () => {
  assertEquals(
    resolveExperienceLevel("unknown", null),
    {
      experienceLevel: "mid",
      experienceYears: 0,
      source: "default",
    },
  );
});

Deno.test("resolveExperienceLevel preserves explicit canonical levels", () => {
  const explicitLevels: Array<[CanonicalLevel, "junior" | "mid" | "senior"]> = [
    ["junior", "junior"],
    ["mid", "mid"],
    ["senior_ic", "senior"],
    ["people_manager", "senior"],
  ];

  for (const [level, expected] of explicitLevels) {
    assertEquals(
      resolveExperienceLevel(level, { experience_years: 1 }),
      {
        experienceLevel: expected,
        experienceYears: 0,
        source: "explicit",
      },
    );
  }
});
