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
# 19 pre-existing errors on main, measured by CI in PR #294 — across
# _shared/tavily-client.ts, _shared/url-deduplication.ts,
# interview-question-generator, job-analysis, and profile-import, mostly
# TS18046 (`unknown` in catch) and TS2339. None had ever been surfaced by CI,
# because nothing type-checked this directory.
#
# Confirmed against the full 38-source set: widening from the 12 `*/index.ts`
# entrypoints to every non-test source found no additional errors, so the
# previously entrypoint-only 19 is the true count, not a floor.
#
# Adding the 14 `*.test.ts` files is expected to hold at 19 as well: their only
# diagnostics resolve to modules already inside the counted set (the four
# TS2339s reached via duckduckgo-fallback.test.ts all land in tavily-client.ts),
# and deno dedupes modules across a batch. CI is the arbiter — if it reports a
# different number, set that number here rather than reasoning about it.
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
  echo "deno not found." >&2
  echo "Run 'npm install' to get the pinned devDependency." >&2
  # Same fail-closed rule as the network skip below: deno is a declared
  # devDependency, so on a runner its absence means `npm ci` did not deliver it
  # and nothing was checked. Silently passing would disable the gate outright.
  if [ -n "${CI:-}" ]; then
    echo "Running in CI (\$CI set) — a missing deno is a FAILURE here, not a pass." >&2
    exit 1
  fi
  echo "Edge-function typecheck SKIPPED — this is not a pass." >&2
  exit 0
fi

# Every `.ts` file under supabase/functions, with no exclusions.
#
# Checking only the `*/index.ts` handlers and relying on transitive imports left
# standalone modules unchecked — `_shared/duckduckgo-fallback.ts` is imported
# solely by its test, and `_shared/config.example.ts` by nothing at all. Since
# no tsconfig covers this directory, "unreachable from an entrypoint" meant
# "never type-checked at all".
#
# The tests are included too. An earlier version of this script excluded
# `*.test.ts` on the stated grounds that vitest type-checks them — that was
# simply wrong: vitest's `typecheck` option defaults to false and is not enabled
# in this repo's config, and `npm test` runs a plain `vitest run`. So the
# exclusion left them checked by nothing at all, same as the standalone modules.
# Deno resolves their bare `"vitest"` import from node_modules without trouble,
# so there was never a reason to skip them.
mapfile -t SOURCES < <(find supabase/functions -name '*.ts' | sort)

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
  head -5 <<< "$output" >&2

  # Fail closed on a runner. The skip exists so a sandbox without egress can run
  # the rest of the suite, but CI advertises this as a blocking gate — and a
  # transient DNS or connection failure there would otherwise mark it green with
  # zero edge functions verified, which is the precise false pass this script
  # exists to prevent. On a runner an outage is an infrastructure failure to
  # retry, not a condition to tolerate.
  if [ -n "${CI:-}" ]; then
    echo "Running in CI (\$CI set) — a network skip is a FAILURE here, not a pass." >&2
    echo "Nothing was type-checked. Re-run the job once connectivity recovers." >&2
    exit 1
  fi

  echo "Edge-function typecheck SKIPPED — this is not a pass." >&2
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

# A completed `deno check` always ends with a `Found N errors.` summary (or, at
# zero errors, exits 0 with no diagnostics at all). So a nonzero exit with no
# summary line means the check did not run to completion — a syntax error, a
# corrupt lockfile, a missing local module, or a non-connection import failure
# that slipped past the network-skip classifier above. That run is untrustworthy
# even when deno emitted a handful of `TS.. [ERROR]` lines before dying, so
# counting those and comparing to the baseline would mask the hard failure as
# "at/below baseline". Reject any such unclassified nonzero exit — not only the
# count == 0 case the earlier version caught, which let a hard failure that
# happened to surface 1–19 diagnostics fall through to a false pass (PREPIO-169).
if (( deno_status != 0 )) && [ -z "$summary" ]; then
  echo "deno check failed (exit $deno_status) without a 'Found N errors.' completion summary." >&2
  echo "This is not a pass — the check did not run to completion. Inspect the output below." >&2
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
  # Below baseline is not a silent green. With the completion-summary guard
  # above, a sub-baseline count from a clean run is a genuine improvement — but
  # the count-only ratchet cannot prove *which* errors went away, so treat it as
  # a signal to inspect and lock in rather than an automatic pass. It stays
  # non-fatal (exit 0) to mirror scripts/check-typecheck-baseline.sh and to avoid
  # failing CI on a legitimate reduction, but the message goes to stderr so it is
  # not lost in a green log. Left unlocked, the baseline silently re-admits
  # regressions all the way back up to the old ceiling (PREPIO-169).
  echo "supabase/functions: $count type errors, BELOW the baseline of $BASELINE — inspect, do not treat as a clean pass." >&2
  echo "Confirm the drop is real, then lower BASELINE in scripts/check-deno-baseline.sh (or set DENO_ERROR_BASELINE=$count) to lock it in." >&2
else
  echo "supabase/functions: $count type errors (at baseline)."
fi
