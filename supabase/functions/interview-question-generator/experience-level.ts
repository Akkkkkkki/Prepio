export type CanonicalLevel =
  | "junior"
  | "mid"
  | "senior_ic"
  | "people_manager"
  | "unknown";

type ExperienceLevel = "junior" | "mid" | "senior";

type ExperienceLevelSource = "explicit" | "cv" | "default";

export function resolveExperienceLevel(
  level: CanonicalLevel | undefined,
  cvAnalysis: { experience_years?: number } | null | undefined,
): {
  experienceLevel: ExperienceLevel;
  experienceYears: number;
  source: ExperienceLevelSource;
} {
  const explicitLevel = level && level !== "unknown" ? level : undefined;

  if (explicitLevel) {
    return {
      experienceLevel:
        explicitLevel === "senior_ic" || explicitLevel === "people_manager"
          ? "senior"
          : explicitLevel,
      experienceYears: 0,
      source: "explicit",
    };
  }

  const experienceYears = Number(cvAnalysis?.experience_years) || 0;
  if (cvAnalysis) {
    if (experienceYears >= 8) {
      return { experienceLevel: "senior", experienceYears, source: "cv" };
    }

    if (experienceYears >= 3) {
      return { experienceLevel: "mid", experienceYears, source: "cv" };
    }

    return { experienceLevel: "junior", experienceYears, source: "cv" };
  }

  return { experienceLevel: "mid", experienceYears: 0, source: "default" };
}
