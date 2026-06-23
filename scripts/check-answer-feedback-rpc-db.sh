#!/usr/bin/env bash
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL not set; skipping answer-feedback RPC DB integration check."
  exit 0
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found; skipping answer-feedback RPC DB integration check."
  exit 0
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/sql/answer_feedback_atomic_rpc.sql
