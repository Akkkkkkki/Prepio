#!/usr/bin/env bash
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

MIGRATION=$(grep -RIl "CREATE TABLE answer_feedback" supabase/migrations || true)

if [[ -z "$MIGRATION" ]]; then
  echo "answer_feedback migration not found." >&2
  exit 1
fi

required_patterns=(
  "strengths[[:space:]]+JSONB[[:space:]]+NOT NULL"
  "improvements[[:space:]]+JSONB[[:space:]]+NOT NULL"
  "star_breakdown[[:space:]]+JSONB[[:space:]]+NOT NULL"
  "next_action[[:space:]]+JSONB[[:space:]]+NOT NULL"
  "superseded_by[[:space:]]+UUID[[:space:]]+REFERENCES answer_feedback\\(id\\)"
  "CREATE INDEX idx_answer_feedback_user"
  "CREATE INDEX idx_answer_feedback_session"
  "CREATE INDEX idx_answer_feedback_question"
  "CREATE (UNIQUE )?INDEX idx_answer_feedback_current"
  "ALTER TABLE answer_feedback ENABLE ROW LEVEL SECURITY"
  "CREATE POLICY answer_feedback_own_read"
  "CREATE POLICY answer_feedback_service"
)

for pattern in "${required_patterns[@]}"; do
  if ! grep -Eq "$pattern" "$MIGRATION"; then
    echo "answer_feedback schema missing required pattern: $pattern" >&2
    exit 1
  fi
done
