// Schema + content validation for synthesized PrepPlans (PREPIO-79).
//
// `synthesizePrepPlan` produces the summary, stage roadmap, positioning, and
// ≥40 tiered questions in one model call. Historically the only check was that
// `summary` and `stageRoadmap` existed, so truncated/thin output — too few
// questions, questions pointing at stages that don't exist — persisted silently
// as a `completed` search and orphaned questions from the practice flow.
//
// This module is intentionally pure (no Deno / network) so the rules are unit
// tested and reused for both the initial validation pass and the bounded repair
// pass. It never throws; malformed input yields errors, not exceptions.

export const QUESTION_MINIMUMS = {
  coreMustPractice: 15,
  likelyFollowUps: 15,
  extraDepth: 10,
} as const;

export const PRIORITY_VALUES = ["high", "medium", "low"] as const;
export const CONFIDENCE_VALUES = ["high", "medium", "low"] as const;
export const DIFFICULTY_VALUES = ["Easy", "Medium", "Hard"] as const;

export interface QuestionCounts {
  coreMustPractice: number;
  likelyFollowUps: number;
  extraDepth: number;
  total: number;
}

export interface PrepPlanValidationResult {
  valid: boolean;
  errors: string[];
  counts: QuestionCounts;
  /** Question `stageName` values that don't resolve to a roadmap stage. */
  unresolvedStageLinks: string[];
}

const TIER_LABELS: Record<keyof typeof QUESTION_MINIMUMS, string> = {
  coreMustPractice: "coreMustPractice",
  likelyFollowUps: "likelyFollowUps",
  extraDepth: "extraDepth",
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

/** Normalizes a stage name for tolerant matching (trim + lowercase). */
function normalizeStageName(name: unknown): string {
  return typeof name === "string" ? name.trim().toLowerCase() : "";
}

export function countQuestions(plan: any): QuestionCounts {
  const qp = plan?.questionPlan ?? {};
  const coreMustPractice = asArray(qp.coreMustPractice).length;
  const likelyFollowUps = asArray(qp.likelyFollowUps).length;
  const extraDepth = asArray(qp.extraDepth).length;
  return {
    coreMustPractice,
    likelyFollowUps,
    extraDepth,
    total: coreMustPractice + likelyFollowUps + extraDepth,
  };
}

export function validatePrepPlan(plan: any): PrepPlanValidationResult {
  const errors: string[] = [];
  const counts = countQuestions(plan);
  const unresolvedStageLinks: string[] = [];

  // ── Top-level structure ──
  if (!plan || typeof plan !== "object") {
    return {
      valid: false,
      errors: ["Plan is missing or not an object."],
      counts,
      unresolvedStageLinks,
    };
  }
  if (!plan.summary || typeof plan.summary !== "object") {
    errors.push("summary is missing.");
  }

  // ── Stage roadmap ──
  const roadmap = asArray(plan.stageRoadmap);
  if (roadmap.length === 0) {
    errors.push("stageRoadmap must contain at least one stage.");
  }
  const roadmapNames = new Set<string>();
  roadmap.forEach((stage: any, i: number) => {
    if (!isNonEmptyString(stage?.stageName)) {
      errors.push(`stageRoadmap[${i}].stageName is empty.`);
    } else {
      roadmapNames.add(normalizeStageName(stage.stageName));
    }
    if (stage?.confidence && !CONFIDENCE_VALUES.includes(stage.confidence)) {
      errors.push(
        `stageRoadmap[${i}].confidence "${stage.confidence}" is not one of ${CONFIDENCE_VALUES.join("/")}.`,
      );
    }
    if (stage?.prepPriority && !PRIORITY_VALUES.includes(stage.prepPriority)) {
      errors.push(
        `stageRoadmap[${i}].prepPriority "${stage.prepPriority}" is not one of ${PRIORITY_VALUES.join("/")}.`,
      );
    }
  });

  // ── Question minimums ──
  (Object.keys(QUESTION_MINIMUMS) as Array<keyof typeof QUESTION_MINIMUMS>).forEach((tier) => {
    const min = QUESTION_MINIMUMS[tier];
    const actual = counts[tier];
    if (actual < min) {
      errors.push(
        `questionPlan.${TIER_LABELS[tier]} has ${actual} questions; minimum is ${min}.`,
      );
    }
  });

  // ── Per-question integrity ──
  (Object.keys(QUESTION_MINIMUMS) as Array<keyof typeof QUESTION_MINIMUMS>).forEach((tier) => {
    const items = asArray(plan?.questionPlan?.[tier]);
    items.forEach((q: any, i: number) => {
      const where = `questionPlan.${TIER_LABELS[tier]}[${i}]`;
      if (!isNonEmptyString(q?.question)) {
        errors.push(`${where}.question is empty.`);
      }
      if (q?.linkedPriority && !PRIORITY_VALUES.includes(q.linkedPriority)) {
        errors.push(
          `${where}.linkedPriority "${q.linkedPriority}" is not one of ${PRIORITY_VALUES.join("/")}.`,
        );
      }
      // Difficulty must be assigned per question (not inferred from tier) and
      // must be a valid enum value.
      if (!q?.difficulty) {
        errors.push(`${where}.difficulty is missing.`);
      } else if (!DIFFICULTY_VALUES.includes(q.difficulty)) {
        errors.push(
          `${where}.difficulty "${q.difficulty}" is not one of ${DIFFICULTY_VALUES.join("/")}.`,
        );
      }
      // Stage links: null/empty means "not stage-specific" and is allowed. A
      // non-empty stageName must resolve to a generated roadmap stage, or the
      // question is orphaned from the practice flow once persisted.
      if (isNonEmptyString(q?.stageName)) {
        if (!roadmapNames.has(normalizeStageName(q.stageName))) {
          unresolvedStageLinks.push(q.stageName);
          errors.push(
            `${where}.stageName "${q.stageName}" does not match any stageRoadmap stage.`,
          );
        }
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    counts,
    unresolvedStageLinks,
  };
}

/**
 * Builds the instruction block for the single bounded repair call. Lists the
 * exact validation errors and the available stage names so the model can
 * top-up questions to the minimums and re-link stage references precisely.
 */
export function buildRepairInstructions(
  validation: PrepPlanValidationResult,
  roadmapStageNames: string[],
): string {
  const lines: string[] = [];
  lines.push("=== REPAIR REQUEST ===");
  lines.push(
    "Your previous PrepPlan JSON failed validation. Return the COMPLETE corrected " +
      "JSON using the same schema. Keep all valid content; ADD questions to meet " +
      "the minimums and fix every listed problem. Do not add commentary.",
  );
  lines.push("");
  lines.push("VALID STAGE NAMES (a question's stageName must be one of these or null):");
  roadmapStageNames.forEach((name) => lines.push(`  - ${name}`));
  lines.push("");
  lines.push("VALIDATION ERRORS TO FIX:");
  validation.errors.forEach((err) => lines.push(`  - ${err}`));
  return lines.join("\n");
}
