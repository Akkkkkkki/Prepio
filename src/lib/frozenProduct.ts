// Release boundary, deliberately not overridable by a browser or environment flag.
// Restoring any of these features requires a reviewed release and backend smoke test.
export const FROZEN_PRODUCT = {
  billing: false,
  answerFeedback: false,
  voice: false,
  profile: false,
  resumeUpload: false,
} as const;
