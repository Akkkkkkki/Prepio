# Major Dependency Migration Plan

This plan tracks migration-sized dependency updates that should not be folded
into routine lockfile maintenance. It is based on the installed versions in
`package-lock.json` on 2026-07-10 and the registry candidates captured in
PREPIO-98 on 2026-06-21. Recheck the target version and release notes when each
PR starts; this document is an ordering and test contract, not a version pin.

React 19, ESLint 10, jsdom 29, the Radix batch, and `vaul` 1 have already
landed. Vite 8 remains tracked by PREPIO-62/PREPIO-84 and is intentionally not
part of the waves below.

## Sequence

Each row is a separate PR unless a row explicitly groups a package family.
Later waves may begin independently when they do not share files, but the
order within a wave is deliberate.

| Order | Migration | Installed | Candidate snapshot | Scope and exit criteria |
| --- | --- | --- | --- | --- |
| 1 | TypeScript | 5.9.3 | 6.0.3 | Upgrade the compiler and resolve frontend/config diagnostics. First make `npm run typecheck` check the referenced app and Node projects; the current `tsc --noEmit` invocation does not provide that assurance. |
| 2 | Node CI/runtime | 20 | 22 | Update both GitHub Actions workflows and document the supported local runtime. Keep build and test output stable. This is the prerequisite for the Supabase package family described below. |
| 3 | Tailwind CSS | 3.4.19 | 4.3.1 | Dedicated build/plugin/config migration. Preserve tokens in `tailwind.config.ts` and verify representative public, authenticated, dialog, and practice screens at mobile and desktop widths. |
| 4 | React Router DOM | 6.30.4 | 7.18.0 | Migrate router APIs and future flags. Cover guest `/`, signed-in `/`, protected-route redirects, saved `/search/:searchId`, not-found, auth redirect context, and `/billing/return`. |
| 5 | Zod + form resolvers | 3.25.76 / 3.10.0 | 4.4.3 / 5.4.0 | Treat as one validation family after confirming each package still has a live consumer. Exercise form errors and shared/Edge schemas; update frozen Deno resolution if an Edge import changes. Remove a package instead of upgrading it if the consumer audit proves it unused. |
| 6 | Recharts | 2.15.4 | 3.8.1 | Migrate the history/statistics chart and add a focused render test for empty and populated data before visual checks. |
| 7 | `react-day-picker` | 9.14.0 | 10.0.1 | Migrate the calendar wrapper API and styling in isolation. Check selection, keyboard navigation, disabled dates, and narrow layouts. |
| 8 | `react-resizable-panels` | 2.1.9 | 4.11.2 | Migrate the resizable wrapper API. Check pointer and keyboard resizing plus persisted layout behavior where used. |
| 9 | Remaining UI utilities | see lockfile | issue snapshot | Use one focused PR per package: `sonner` 2, `tailwind-merge` 3, `lucide-react` 1, then `pdfjs-dist` 6. Prioritize the PDF parser because resume upload is a core flow; do not combine its worker/runtime changes with cosmetic utilities. |

## Node and Supabase gate

`@supabase/supabase-js` is installed and pinned in Edge imports at 2.108.2.
The 2.110.0 package family identified in the 2026-07-05 PREPIO-98 update
declared Node `>=22`, while both CI workflows use Node 20. After the Node 22 PR
lands, update the npm package and every live/test CDN import together, refresh
`package-lock.json` and `deno.lock`, and run frozen Deno dependency resolution.
Do not deploy functions or push database changes as part of that PR.

## Test contract for every migration

Every focused PR must run:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Also lint changed files and confirm the repository lint command retains its
intended exit-code behavior. Add focused unit or browser coverage for the
affected consumer rather than relying only on the broad suite. For visual
migrations, capture mobile and desktop comparisons. For shared schemas or Edge
imports, include targeted Deno checks with frozen dependency resolution.

## Boundaries

- Do not combine these migrations with React, Vite, or Radix upgrades.
- Do not mix routine patch/minor drift into a migration PR unless required by
  peer dependencies.
- Do not change production Supabase or Stripe state to validate a migration.
- If a new major release appears before a wave starts, update its focused issue
  with the new compatibility evidence rather than silently widening the PR.
