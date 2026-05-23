# Audits

Point-in-time snapshots of UX, design, security, or architecture reviews. Audits are **dated and frozen** — they reflect the product at the time of writing, not the current state. When findings are addressed they should be folded into the living docs ([`DESIGN_PRINCIPLES.md`](../DESIGN_PRINCIPLES.md), [`ROADMAP.md`](../ROADMAP.md), etc.).

| Audit | Date | Notes |
|-------|------|-------|
| [2026-04-19 Design audit](./2026-04-19-design-audit.html) | 2026-04-19 | UX/UI review across Home (guest + auth), Dashboard, Practice setup/session, Profile, global navigation. Self-contained React HTML; open in a browser. |
| [2026-05-23 Recurring hygiene review](./2026-05-23-recurring-hygiene.md) | 2026-05-23 | First recurring codebase hygiene & security review. Findings on unauthenticated paid edge functions, dependency advisories, missing CI; added `typecheck` script and a baseline GitHub Actions workflow. |
