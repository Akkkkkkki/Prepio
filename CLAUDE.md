# CLAUDE.md

Developer and agent reference for Prepio. Read this first before making changes.

## Project Summary

Prepio is an authenticated interview-prep app. Users research a company/role, review AI-generated interview stages and questions, and practice against them.

Primary user flow:
1. Land on your interviews — [`src/pages/Interviews.tsx`](./src/pages/Interviews.tsx) at `/interviews` (signed-in users hitting `/` are redirected here; guests get the public research entry)
2. Create a research run — [`src/pages/Home.tsx`](./src/pages/Home.tsx) at `/new-interview` when signed in, or `/` as a guest
3. Review generated stages — [`src/pages/Dashboard.tsx`](./src/pages/Dashboard.tsx)
4. Practice questions — [`src/pages/Practice.tsx`](./src/pages/Practice.tsx)
5. Manage CV and preferences — [`src/pages/Profile.tsx`](./src/pages/Profile.tsx)

## Current Product Truth

These points override anything in older docs or code comments:

- **Resume upload**: PDF and DOCX supported. Signed-in users upload from Home and Profile. Home can parse files locally before sign-in.
- **Resume deletion**: Server-backed. Deleting a profile resume removes the saved row and stored files together.
- **Voice recording**: Recordings are uploaded to the `practice-audio` storage bucket and transcribed via the `practice-audio-transcribe` edge function; `audio_path` and `transcript_text` are saved on the answer row. A failed transcribe call raises a non-blocking "Transcription unavailable. / Your answer was still saved." notice; a successful-but-empty transcript stays silent.
- **Search history**: Available in authenticated navigation.
- **Practice gestures**: Mobile swipe (60px threshold, 12px vertical suppression) plus explicit button controls.
- **Auth**: Redirect context shown when bounced to sign-in. Sign-in and sign-up fields are stored separately.

> **Production is not `main`.** The backend has been frozen since 2026-05-15: 8 migrations
> are unapplied and 7 edge functions (`research-preview`, `create-checkout-session`,
> `create-portal-session`, `stripe-webhook`, `answer-feedback`, `profile-import`,
> `practice-audio-transcribe`) are undeployed. Guest preview, paid answer feedback, CV import,
> voice transcription, and the billing purchase flow are therefore dead in production even
> though they are shipped in this repo. Check what each missing function actually gates
> before assuming a whole feature is dark: the billing tables and frontend *are* live, so
> `/pricing`, `/billing/return`, and the entitlement read work and simply always resolve
> free (see [`docs/BILLING.md`](./docs/BILLING.md)); likewise recording and saving a voice
> answer works, and only the transcript is missing. Tracked as PREPIO-124 (Urgent). Read
> "shipped" in this file and in `docs/` as "merged to `main`", not "live".

## Commands

### Frontend

```bash
npm install          # Install dependencies
npm run dev          # Dev server on port 5173
npm run build        # Production build
npm run lint         # ESLint (informational in CI; has pre-existing failures, don't assume yours caused them)
npm test             # Vitest + schema checks — 427 tests / 49 files green on main
npm run typecheck    # CI gate: tsc error-count ratchet (app baseline 62, node 0)
npm run typecheck:functions  # CI gate: deno check over supabase/functions (needs egress)
npm run test:e2e     # Playwright smoke — NOT wired into CI (PREPIO-135)
npm run preview      # Preview production build
```

The blocking CI steps are `typecheck`, `typecheck:functions`, `build`, and `test`. Run
`npm run typecheck` alongside `npm run build` before pushing — the build alone will not
catch a ratchet break.

### Supabase

```bash
npm run functions:serve          # Serve edge functions locally
npm run functions:serve-debug    # Serve with debug logging
npm run functions:deploy         # Deploy all edge functions
npm run functions:deploy-single FUNCTION_NAME
npm run db:push                  # Push migrations
npm run db:pull                  # Pull remote schema
npm run supabase:start           # Start local Supabase
npm run supabase:stop
npm run supabase:status
```

### After database changes

The local and production migration histories diverge: two already-applied migrations were
re-timestamped in the repo (`billing_v1` is `20260514000000` locally vs `20260515131539` in
production; `security_hardening_and_resume_rpc` is `20260515150000` vs `20260515171733`). A
blind `db:push` can stop on the unmatched remote version or re-run the local security
migration as if it were new, so reconcile the histories first:

```bash
supabase migration list   # confirm the divergence below still matches the live history
supabase migration repair --status reverted 20260515131539 20260515171733
supabase migration repair --status applied  20260514000000 20260515150000
npm run db:push
npm run db:pull
```

The `reverted` calls drop the two orphan remote entries; the `applied` calls register the
local filenames as already run, so `db:push` skips them instead of re-running the security
migration. Verify the four versions against `migration list` output before repairing — do
not run these from memory. See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) and PREPIO-124.

Keep migration files in [`supabase/migrations`](./supabase/migrations).

## Environment Variables

`.env.local` for local development:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
TAVILY_API_KEY=...
```

## Routes

| Path | Access | Component |
|------|--------|-----------|
| `/` | Public | `Home` for guests; signed-in users redirect to `/interviews` |
| `/auth` | Public | `Auth` |
| `/pricing` | Public | `Pricing` |
| `/interviews` | Protected | `Interviews` |
| `/new-interview` | Protected | `Home` |
| `/dashboard` | Protected | `Dashboard` |
| `/search/:searchId` | Protected | `Dashboard` |
| `/practice` | Protected | `Practice` |
| `/history` | Protected | `History` |
| `/profile/*` | Protected | `Profile` |
| `/billing/return` | Protected | `BillingReturn` |
| `*` | Public | `NotFound` |

Protected-route and `/` redirect behavior: [`src/App.tsx`](./src/App.tsx).

## Files Worth Reading First

| File | What it does |
|------|-------------|
| [`src/pages/Interviews.tsx`](./src/pages/Interviews.tsx) | Signed-in landing surface: interview cards with state and practice CTAs |
| [`src/pages/Home.tsx`](./src/pages/Home.tsx) | Research entry form, draft persistence, resume upload |
| [`src/pages/Dashboard.tsx`](./src/pages/Dashboard.tsx) | Research results, stages, question counts |
| [`src/pages/Practice.tsx`](./src/pages/Practice.tsx) | Practice session UX, mobile layout, gestures |
| [`src/pages/Profile.tsx`](./src/pages/Profile.tsx) | CV management, seniority, structured profile |
| [`src/pages/History.tsx`](./src/pages/History.tsx) | Practice session history and stats |
| [`src/services/searchService.ts`](./src/services/searchService.ts) | All Supabase API calls from the frontend |
| [`src/components/Navigation.tsx`](./src/components/Navigation.tsx) | App nav, search selector, history |
| [`supabase/functions/interview-research/index.ts`](./supabase/functions/interview-research/index.ts) | Research pipeline orchestrator |
| [`supabase/functions/_shared/config.ts`](./supabase/functions/_shared/config.ts) | Model selection, Tavily config, feature flags |

## Conventions and Guardrails

- **Align copy to reality.** Prefer describing what works over promising what's planned.
- **Disable unwired controls.** If a button isn't connected, disable it with honest copy.
- **Practice gestures are high-risk.** Small changes to swipe thresholds or scroll suppression break trust. Test on real devices.
- **Auth + profile changes need both screen copy and route behavior checked.**
- **Resume deletion must keep file cleanup and row cleanup in sync.**
- **Model config is env-driven.** Falls back to `gpt-4o` / `gpt-4o-mini` if `OPENAI_MODEL` is not set.
- **Edge functions use service role.** All substantive DB writes from edge functions bypass RLS via `SUPABASE_SERVICE_ROLE_KEY`.
- **Re-request Codex review after pushing a fix.** Pushing commits does not re-trigger it. See [Working with Codex PR review](#working-with-codex-pr-review).

## Working with Codex PR review

Codex (`@chatgpt-codex-connector`) reviews PRs in this repo. It is configured
in the ChatGPT Codex cloud settings, **not** in this repository — there is no
workflow file to edit.

### What triggers a review

Only these three things:

1. Opening a PR that is not a draft.
2. Marking an existing draft as ready for review.
3. A PR comment that mentions Codex.

**Pushing new commits does not trigger a re-review.** This is the failure mode
worth internalizing: you can push a fix addressing a P1 finding and the thread
will simply go quiet, leaving the finding to look unaddressed.

### The convention

After pushing a fix that responds to Codex feedback, post the reply as a
**top-level PR comment that mentions `@chatgpt-codex-connector`** (or says
`@codex review`). Two things follow from that:

- Inline review-thread replies do **not** count. A reply inside a
  `discussion_r*` thread never reaches Codex, even when the fix is real and
  pushed. Compare [#287](https://github.com/Akkkkkkki/Prepio/pull/287) (inline
  reply → one review, silence after the fix) with
  [#278](https://github.com/Akkkkkkki/Prepio/pull/278) (top-level mentions →
  three passes, ending in an explicit all-clear on the new head).
- Mention it once per round, not once per finding. Codex re-reads the current
  head, so one comment covering everything you fixed is enough.

Codex answers a mention in one of two modes: a **fresh review** of the current
head, or an **agent task** that investigates and replies (the response carries
a `View task →` link). Both are useful; you do not choose between them.

### Draft PRs get no review

`.github/workflows/codex-prepio-linear-auto-pr.yml` opens its PRs with
`gh pr create --draft`, so scheduled auto-PRs sit unreviewed until someone
marks them ready. Mark them ready when you want the review.

### If this ever gets automated

The alternative is a workflow posting `@codex review` on
`pull_request: synchronize`. Deliberately **not** implemented — the mention
convention above covers the agent-driven flow at no extra cost. Two things to
carry forward if it is revisited: skip bot-authored pushes so the scheduled
auto-PR workflow does not review its own output, and verify that Codex
responds to a `github-actions[bot]` mention at all (integrations commonly
ignore bot comments to avoid loops, which would mean it needs a PAT).

## Working with Linear

Project tracking lives in the **Prepio** Linear team (issue prefix `PREPIO-`). Treat Linear as the source of truth for what's actively being worked on; treat [`docs/ROADMAP.md`](./docs/ROADMAP.md) as the source of truth for *why*.

### Project structure

Four projects mirror the Roadmap "Now" + an ongoing bucket:

- **AI Answer Feedback (Paid)** — paid-only structured coaching on practice answers.
- **Pricing & Monetization** — Stripe Billing, three cadences, `getEntitlement` resolver.
- **Landing Page Framing** — reframe `/` without moving the core flow.
- **Quality & Maintenance** — bugs, polish, infra, DX. No end date.

Don't open new projects for "Next" or "Later" Roadmap items until "Now" is shipping.

### Labels

Two dimensions, no nesting:

- **Type**: `Bug`, `Feature`, `Improvement`, `Chore`, `Docs`.
- **Area**: `area:research-pipeline`, `area:practice`, `area:profile`, `area:auth`, `area:billing`, `area:landing`, `area:infra`.

Every issue should have one Type and at least one Area. Resist adding more dimensions.

### Workflow

- Issue threshold: anything that takes >30 min or you'd lose track of overnight. Don't log every commit-sized task.
- Branches: include `PREPIO-NN` in the branch name (e.g. `claude/prepio-12-stripe-webhook-handler`) so the GitHub integration auto-links the PR.
- PR open auto-moves the issue to **In Review**; PR merge auto-moves to **Done**. Don't move issues by hand if a PR exists.
- Status types in this team: `Backlog` → `Todo` → `In Progress` → `In Review` → `Done`. Use `Canceled` for dropped work, `Duplicate` for merged-into-other-issue.
- Cycles drive cadence. Plan weekly; keep "In Progress" small.

### Recurring hygiene reviews

The recurring hygiene reviews under [`docs/audits/`](./docs/audits) produce a
list of deferred items each run. **File a Linear issue for every deferred
item that meets the >30-min threshold** (almost all of them do — security
fixes, dependency upgrades, edge-function refactors, dead-code decisions).
Don't leave deferred items as bullet points in the audit doc only — the
audit doc is for the dated trail; Linear is for the team's actionable
backlog. Each issue should:

- Land in the **Quality & Maintenance** project unless it clearly belongs
  to one of the active "Now" projects.
- Carry the `Chore` Type label plus the matching Area label.
- Cross-link back to the audit doc and the PR that introduced the
  finding, so a future maintainer can trace the history.

The audit doc's *Deferred items* section should then list the issues by
identifier rather than re-describing the work.

## Docs Map

| Document | Purpose |
|----------|---------|
| [`README.md`](./README.md) | Product overview, shipped/not-shipped status, quick start |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Stack, data model, edge functions, data flows |
| [`docs/RESEARCH_PIPELINE.md`](./docs/RESEARCH_PIPELINE.md) | Research pipeline as-shipped (v2), quality gaps, and target grounded-evidence (v3) design |
| [`docs/PRODUCT_STRATEGY.md`](./docs/PRODUCT_STRATEGY.md) | Vision, users, positioning |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md) | Shipped work, near-term, future ideas |
| [`docs/DESIGN_PRINCIPLES.md`](./docs/DESIGN_PRINCIPLES.md) | UX principles, design tokens, patterns |
| [`docs/TESTING.md`](./docs/TESTING.md) | Test coverage, priorities, how to run |
| [`docs/BILLING.md`](./docs/BILLING.md) | Stripe subscription contract (cadences, tables, webhook events, entitlement resolver) |
| [`docs/RUNBOOK.md`](./docs/RUNBOOK.md) | Observability stack and common-incident recovery steps |
