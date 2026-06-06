# Audits

Point-in-time snapshots of UX, design, security, or architecture reviews. Audits are **dated and frozen** — they reflect the product at the time of writing, not the current state. When findings are addressed they should be folded into the living docs ([`DESIGN_PRINCIPLES.md`](../DESIGN_PRINCIPLES.md), [`ROADMAP.md`](../ROADMAP.md), etc.).

| Audit | Date | Notes |
|-------|------|-------|
| [2026-04-19 Design audit](./2026-04-19-design-audit.html) | 2026-04-19 | UX/UI review across Home (guest + auth), Dashboard, Practice setup/session, Profile, global navigation. Self-contained React HTML; open in a browser. |
| [2026-05-23 Recurring hygiene review](./2026-05-23-recurring-hygiene.md) | 2026-05-23 | First recurring codebase hygiene & security review. Findings on unauthenticated paid edge functions, dependency advisories, missing CI; added `typecheck` script and a baseline GitHub Actions workflow. |
| [2026-05-30 Recurring hygiene review](./2026-05-30-recurring-hygiene.md) | 2026-05-30 | Second recurring hygiene review. Fixed a silent `npm run lint` regression by bumping `typescript-eslint` to `^8.60.0`. Re-flagged the unauthenticated paid edge functions and CORS-wildcard findings; recommended adding Dependabot. |
| [2026-06-03 Recurring hygiene review](./2026-06-03-recurring-hygiene.md) | 2026-06-03 | Third recurring hygiene review. Confirmed PRs #106 and #107 closed the unauthenticated-paid-edge-function finding flagged in every prior review. Re-flagged partial CORS-helper adoption (4 of 11 edge functions), env-var enumeration in logs, and stale README / CLAUDE.md docs (fixed this run). |
| [2026-06-06 Recurring hygiene review](./2026-06-06-recurring-hygiene.md) | 2026-06-06 | Fourth recurring hygiene review. Patched react-router open-redirect advisory (GHSA-2j2x-hqr9-3h42) via 6.30.3 → 6.30.4 lockfile bump. Audited edge-function logging surface — clean. Re-flagged CORS-helper adoption, env-var enumeration, missing Dependabot, and `interview-question-generator` dead code (fourth recurrence). |
