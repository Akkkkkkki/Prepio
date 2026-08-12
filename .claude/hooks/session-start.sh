#!/bin/bash
# SessionStart hook for Claude Code on the web.
#
# Ensures dependencies and the Playwright Chromium browser are installed so
# `npm test` and `npm run test:e2e` are runnable without manual setup.
#
# IMPORTANT: the Playwright browser download fetches from cdn.playwright.dev.
# That host must be reachable from the environment, otherwise the download can
# fail with "403 Host not in allowlist", a gateway denial, or a generic
# Playwright download failure. When Chromium is not ready, e2e and live
# UI/UX review screenshots are not available.
# Configure the allowlist when creating/editing the environment:
#   https://code.claude.com/docs/en/claude-code-on-the-web
set -euo pipefail

# Only run in the remote (web) environment.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

echo "[session-start] Installing npm dependencies..."
# This also installs the pinned `deno` devDependency, so `npm run
# typecheck:functions` can type-check the Supabase Edge Functions.
#
# NOTE: `deno check` resolves the functions' remote imports over the network
# (deno.land, esm.sh). Those hosts must be on the environment allowlist or the
# check reports SKIPPED rather than passing. Nothing else in the repo covers
# edge-function types — no tsconfig includes supabase/functions — so a skip
# means those files are unverified, not clean.
npm install

echo "[session-start] Installing Playwright Chromium..."
# Prefer installing OS deps too, but fall back to the browser binary alone:
# `--with-deps` runs apt, which can fail independently of the browser download
# in restricted environments. The plain install still yields a usable browser
# when the required system libraries are already present in the base image.
if npx playwright install --with-deps chromium || npx playwright install chromium; then
  echo "[session-start] Playwright Chromium ready."
else
  echo "[session-start] WARNING: Playwright Chromium install failed." >&2
  echo "[session-start] Ensure cdn.playwright.dev is reachable from this environment" >&2
  echo "[session-start] or bake Chromium into the base image." >&2
  echo "[session-start] npm tests still work; e2e and live UI/UX screenshots are unavailable." >&2
fi
