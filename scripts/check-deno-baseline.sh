#!/usr/bin/env bash
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

# Error-count ratchet for the Supabase Edge Functions, mirroring
# scripts/check-typecheck-baseline.sh.
#
# Why this exists: `supabase/functions/**` is in NO tsconfig `include`
# (tsconfig.app.json covers `src`, tsconfig.node.json covers `vite.config.ts`),
# so before this script the edge functions were type-checked by nothing in CI.
# Every "deno check — passed" line in a PR body was a local, manual step CI
# never enforced, and an edge-function type error shipped green.
#
# Deno resolves remote imports (deno.land, esm.sh) over the network, so this
# needs egress to those hosts. In restricted sandboxes it will fail to resolve;
# that is reported as a skip rather than a failure, because a sandbox without
# egress must not be mistaken for a type-clean tree.
#
# Lower BASELINE as the backlog burns down. Never raise it without a written
# justification in the PR.
BASELINE=${DENO_ERROR_BASELINE:-0}

# Prefer the lockfile-pinned devDependency so CI and a local checkout agree;
# fall back to a system deno for anyone who has one.
if [ -n "${DENO_BIN:-}" ]; then
  :
elif [ -x node_modules/.bin/deno ]; then
  DENO_BIN=node_modules/.bin/deno
else
  DENO_BIN=deno
fi

if ! command -v "$DENO_BIN" >/dev/null 2>&1 && [ ! -x "$DENO_BIN" ]; then
  echo "deno not found — skipping edge-function typecheck." >&2
  echo "Run 'npm install' to get the pinned devDependency." >&2
  exit 0
fi

# Entrypoints only: each pulls in its own local module graph, so checking the
# handlers transitively covers _shared and the per-function helpers.
mapfile -t ENTRYPOINTS < <(find supabase/functions -mindepth 2 -maxdepth 2 -name 'index.ts' | sort)

if (( ${#ENTRYPOINTS[@]} == 0 )); then
  echo "No edge-function entrypoints found under supabase/functions." >&2
  exit 1
fi

output=$("$DENO_BIN" check "${ENTRYPOINTS[@]}" 2>&1 || true)

# Strip ANSI colour codes; deno colourises even when piped, and the escape
# sequences sit between the token and the bracket in `TS2322 [ERROR]:`.
output=$(printf '%s\n' "$output" | sed -E 's/\x1b\[[0-9;]*m//g')

# A network failure resolving remote imports is an environment problem, not a
# type error. Report it and skip rather than reporting a misleading zero.
if printf '%s\n' "$output" | grep -qE 'unsuccessful tunnel|error sending request for url|failed to fetch|Import .* failed'; then
  echo "deno could not resolve remote imports (deno.land / esm.sh unreachable)." >&2
  echo "Edge-function typecheck SKIPPED — this is not a pass." >&2
  printf '%s\n' "$output" | head -5 >&2
  exit 0
fi

# Deno 2.x prints a `Found N errors.` summary and one `TS<code> [ERROR]:` line
# per diagnostic. Prefer the summary; fall back to counting diagnostics.
# NB: the format is `TS2322 [ERROR]`, NOT `error TS2322` as tsc emits — a
# tsc-shaped pattern silently counts zero and turns this gate into a false pass.
summary=$(printf '%s\n' "$output" | sed -nE 's/^Found ([0-9]+) errors?\.$/\1/p' | tail -1)
if [ -n "$summary" ]; then
  count=$summary
else
  count=$(printf '%s\n' "$output" | { grep -cE 'TS[0-9]+ \[ERROR\]' || true; })
fi

if (( count > BASELINE )); then
  echo "supabase/functions: $count type errors exceed the baseline of $BASELINE — this change introduces new type errors." >&2
  printf '%s\n' "$output" >&2
  echo "Fix the new errors rather than raising the baseline." >&2
  exit 1
fi

if (( count < BASELINE )); then
  echo "supabase/functions: $count type errors, below the baseline of $BASELINE. Lower BASELINE in scripts/check-deno-baseline.sh to lock in the improvement."
else
  echo "supabase/functions: $count type errors (at baseline)."
fi
