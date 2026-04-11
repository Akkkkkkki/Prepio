#!/usr/bin/env bash
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

PATHS=(
  src
  tests
  supabase/functions
)

if grep -RInE '\b(search_artifacts|cv_job_comparisons|audio_url|target_seniority)\b' "${PATHS[@]}"; then
  echo "Legacy schema references found. Remove old schema names before shipping." >&2
  exit 1
fi

if grep -RInE '\btargetSeniority\b|\.update\(\{\s*seniority\b' src tests; then
  echo "Legacy app field references found. Remove targetSeniority/seniority before shipping." >&2
  exit 1
fi
