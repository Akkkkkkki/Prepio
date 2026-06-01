#!/bin/bash
# SessionStart hook for Claude Code on the web.
#
# Ensures dependencies and the Playwright Chromium browser are installed so
# `npm test` and `npm run test:e2e` are runnable without manual setup.
#
# IMPORTANT: the Playwright browser download fetches from cdn.playwright.dev.
# That host must be in the environment's network allowlist, otherwise the
# download returns "403 Host not in allowlist" and e2e will be skipped.
# Configure the allowlist when creating/editing the environment:
#   https://code.claude.com/docs/en/claude-code-on-the-web
set -euo pipefail

# Only run in the remote (web) environment.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

echo "[session-start] Installing npm dependencies..."
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
  echo "[session-start] If you saw '403 Host not in allowlist', add" >&2
  echo "[session-start] cdn.playwright.dev to the environment network allowlist." >&2
  echo "[session-start] npm tests still work; only e2e (test:e2e) is affected." >&2
fi
