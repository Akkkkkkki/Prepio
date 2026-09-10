#!/usr/bin/env bash
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

# Radius values docs/DESIGN_PRINCIPLES.md forbids by name ("Avoid rounded-3xl and
# rounded-[24px] on new work"). The documented product scale is rounded-xl for normal
# cards and rounded-[20px] for prominent panels. This guard keeps the forbidden values
# from creeping back into product surfaces; it does not police the broader radius
# consolidation still open in PREPIO-175.
if grep -RInE 'rounded-3xl|rounded-\[24px\]' src; then
  echo "Forbidden radius token found. docs/DESIGN_PRINCIPLES.md bars rounded-3xl and rounded-[24px]; use rounded-xl (normal cards) or rounded-[20px] (prominent panels)." >&2
  exit 1
fi
