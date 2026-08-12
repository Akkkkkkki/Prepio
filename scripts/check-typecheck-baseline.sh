#!/usr/bin/env bash
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

# Error-count ratchet for pre-existing type errors (PREPIO-119).
# tsconfig.app.json carries a legacy backlog; new code must not add to it.
# Lower APP_BASELINE as the backlog burns down. Never raise a baseline
# without a written justification in the PR.
APP_BASELINE=64
NODE_BASELINE=0

count_errors() {
  local project=$1
  local output
  # tsc exits non-zero on type errors; capture output without tripping set -e.
  output=$(npx tsc -p "$project" --noEmit --pretty false 2>&1 || true)
  printf '%s\n' "$output" | { grep -cE 'error TS[0-9]+' || true; }
}

check_project() {
  local project=$1
  local baseline=$2
  local count
  count=$(count_errors "$project")

  if (( count > baseline )); then
    echo "$project: $count type errors exceed the baseline of $baseline — this change introduces new type errors." >&2
    echo "Run 'npx tsc -p $project --noEmit' to see them. Fix the new errors rather than raising the baseline." >&2
    return 1
  fi

  if (( count < baseline )); then
    echo "$project: $count type errors, below the baseline of $baseline. Lower the baseline in scripts/check-typecheck-baseline.sh to lock in the improvement."
  else
    echo "$project: $count type errors (at baseline)."
  fi
}

status=0
check_project tsconfig.app.json "$APP_BASELINE" || status=1
check_project tsconfig.node.json "$NODE_BASELINE" || status=1
exit "$status"
