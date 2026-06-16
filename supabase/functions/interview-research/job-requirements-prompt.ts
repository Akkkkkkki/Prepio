// PREPIO-82: when the job-analysis call fell back to its generic stub
// (no Tavily key, extraction returned nothing, OpenAI failure), the
// synthesis model must not see those invented "requirements" framed as
// signal from the user's job posting. Returning an empty block is the
// safest choice — the model still has company insights, CV, and user
// note to anchor on, and stage/question generation stops citing
// fabricated `interview_process_hints` like "Expect a technical screen
// focused on fundamentals."

export type JobRequirementsSource = "extracted" | "stub";

export interface JobRequirementsBlob {
  technical_skills?: string[];
  soft_skills?: string[];
  responsibilities?: string[];
  qualifications?: string[];
  interview_process_hints?: string[];
}

export function formatJobRequirementsBlock(
  requirements: JobRequirementsBlob | null | undefined,
  source: JobRequirementsSource | null | undefined,
): string {
  if (!requirements || source !== "extracted") return "";

  let block = `=== JOB REQUIREMENTS (from link analysis) ===\n`;
  if (requirements.technical_skills?.length) {
    block += `Technical: ${requirements.technical_skills.join(", ")}\n`;
  }
  if (requirements.soft_skills?.length) {
    block += `Soft: ${requirements.soft_skills.join(", ")}\n`;
  }
  if (requirements.responsibilities?.length) {
    block += `Responsibilities:\n`;
    requirements.responsibilities.forEach((r) => {
      block += `  - ${r}\n`;
    });
  }
  if (requirements.qualifications?.length) {
    block += `Qualifications:\n`;
    requirements.qualifications.forEach((q) => {
      block += `  - ${q}\n`;
    });
  }
  if (requirements.interview_process_hints?.length) {
    block += `Process hints: ${requirements.interview_process_hints.join("; ")}\n`;
  }
  block += `\n`;
  return block;
}
