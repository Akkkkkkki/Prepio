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
# PROVISIONAL — needs one more CI run before this gate can block.
#
# The first CI run of this script (PR #294) measured 19 pre-existing errors
# across _shared/tavily-client.ts, _shared/url-deduplication.ts,
# interview-question-generator, job-analysis, and profile-import — mostly
# TS18046 (`unknown` in catch) and TS2339. None had ever been surfaced by CI.
#
# That 19 was measured while this script checked only the 12 `*/index.ts`
# entrypoints. The file set has since widened to all 38 non-test sources (see
# below), which can only find the same errors or more, so 19 is a floor and not
# necessarily the true count. Read the real number off the next CI run, set it
# here, then drop continue-on-error in .github/workflows/ci.yml.
#
# Lower BASELINE as the backlog burns down. Never raise it without a written
# justification in the PR.
BASELINE=${DENO_ERROR_BASELINE:-19}

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

# Every non-test source, not just the `*/index.ts` handlers. Checking only
# entrypoints and relying on transitive imports leaves standalone modules
# unchecked — `_shared/duckduckgo-fallback.ts` is imported solely by its test,
# and `_shared/config.example.ts` by nothing at all, so both would merge
# unreported. Since no tsconfig covers this directory, "unreachable from an
# entrypoint" would have meant "never type-checked at all".
#
# `*.test.ts` is the one deliberate exclusion: the tests import from "vitest"
# and run under vitest/node, so deno cannot resolve them. They are type-checked
# by the vitest run instead.
mapfile -t SOURCES < <(find supabase/functions -name '*.ts' ! -name '*.test.ts' | sort)

if (( ${#SOURCES[@]} == 0 )); then
  echo "No edge-function sources found under supabase/functions." >&2
  exit 1
fi

# Keep deno's exit status: a failure that produces neither a `Found N errors.`
# summary nor any `TS... [ERROR]` diagnostic (syntax error, corrupt lockfile,
# missing local module) must not fall through to count=0 and report a pass.
set +e
output=$("$DENO_BIN" check "${SOURCES[@]}" 2>&1)
deno_status=$?
set -e

# Strip ANSI colour codes; deno colourises even when piped, and the escape
# sequences sit between the token and the bracket in `TS2322 [ERROR]:`.
#
# Every match below reads from a here-string rather than a `printf ... |`
# pipeline. Under `set -o pipefail` an early-closing consumer (`grep -q` stops
# at the first match, `head` after N lines) sends SIGPIPE to the producer, and
# the pipeline then reports 141 — which would flip a matched condition to false
# or abort the script outright on verbose output. A here-string has no producer
# process, so there is nothing to signal.
output=$(sed -E 's/\x1b\[[0-9;]*m//g' <<< "$output")

# A network failure resolving remote imports is an environment problem, not a
# type error. Report it and skip rather than reporting a misleading zero.
#
# Deno reports an unresolvable import as a top-level `error: Import '...'
# failed.` followed by indented, numbered cause lines. Require BOTH, each
# anchored to the start of a line:
#
#   - Unanchored matching let a *source excerpt* trip this branch. Deno quotes
#     the offending source line inside each diagnostic, so a file containing
#     `const x: number = "failed to fetch"` would be misread as a network
#     outage and skipped — hiding the very type error the gate exists to catch.
#   - Requiring a transport-level cause also keeps permanent failures (a 404 or
#     403 from a bad version pin) out of the skip path. Those are real breakage
#     to fix, not an unreachable environment to tolerate.
network_head=0
network_cause=0
if grep -qE "^error: Import '[^']*' failed" <<< "$output"; then
  network_head=1
fi
if grep -qE '^[[:space:]]*[0-9]+: .*(unsuccessful tunnel|client error \(Connect\)|error trying to connect|dns error|[Cc]onnection (refused|reset))' <<< "$output"; then
  network_cause=1
fi

if (( network_head == 1 && network_cause == 1 )); then
  echo "deno could not resolve remote imports (deno.land / esm.sh unreachable)." >&2
  echo "Edge-function typecheck SKIPPED — this is not a pass." >&2
  head -5 <<< "$output" >&2
  exit 0
fi

# Deno 2.x prints a `Found N errors.` summary and one `TS<code> [ERROR]:` line
# per diagnostic. Prefer the summary; fall back to counting diagnostics.
# NB: the format is `TS2322 [ERROR]`, NOT `error TS2322` as tsc emits — a
# tsc-shaped pattern silently counts zero and turns this gate into a false pass.
summary=$(sed -nE 's/^Found ([0-9]+) errors?\.$/\1/p' <<< "$output" | tail -1)
if [ -n "$summary" ]; then
  count=$summary
else
  count=$(grep -cE 'TS[0-9]+ \[ERROR\]' <<< "$output" || true)
fi

# deno failed, but nothing was classified as a network skip or counted as a type
# diagnostic. Something else broke; surface it instead of reporting "at baseline".
if (( deno_status != 0 )) && (( count == 0 )); then
  echo "deno check failed (exit $deno_status) without any countable type diagnostic." >&2
  echo "This is not a pass — inspect the output below." >&2
  printf '%s\n' "$output" >&2
  exit 1
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
