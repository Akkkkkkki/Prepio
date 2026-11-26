# Prepio UI/UX Review — 2026-10-15 (recurring routine, run #21)

Twenty-first run of the recurring UX-review routine, and the first since the
**freeze actually shipped**. Baselines: [`2026-06-21`](./2026-06-21-ux-review-routine.md),
[`2026-08-27`](./2026-08-27-ux-review-routine.md), [`2026-08-30`](./2026-08-30-ux-review-routine.md),
and most recently [`2026-09-03` (run #20)](./2026-09-03-ux-review-routine.md).

Six weeks separate this run from run #20 — the weekly cadence lapsed, which is
consistent with the freeze's own instruction to remove repository schedules and
pause routine work. The gap is not itself a finding; it is the expected
behaviour of a product in a deliberate freeze.

## Capability check — PARTIAL (frontend live; backend unreachable from this environment)

Per the [routine contract](./UX_REVIEW_ROUTINE.md), both capability checks must
pass to claim interactive coverage. Only one passed this run:

- **Playwright Chromium: PASS.** The session's pre-installed Chromium
  (`/opt/pw-browsers/chromium-1194`, matching `playwright-core` 1.61.1) launches
  and drives the live app. (The session-start hook's own `playwright install`
  failed — it tried to fetch chromium-1228, which the egress proxy blocked with
  `403` — but the already-present 1194 build is the one this Playwright needs.)
- **Frontend (Vercel): PASS.** `https://prepio.qiuyue.dev/` → `200`, title
  `Prepio - Interview Prep Tool`. Logged-out landing, guest sample, `/auth`,
  protected-route redirects, retired-route 404s, and both desktop (1280×900) and
  mobile (iPhone-13, 390×844) breakpoints were exercised live.
- **Backend (Supabase): FAIL — host blocked by this environment's egress
  policy.** Every call to `https://vjwrirrqprjzdorignlz.supabase.co` returns
  `502 CONNECT tunnel failed` through the agent proxy (confirmed by `curl` and by
  Chromium console `net::ERR_TUNNEL_CONNECTION_FAILED` / `Failed to fetch` on the
  login attempt). This is an **environment limitation, not a product outage** —
  it is the same host run #20 reached and logged in against. I did not route
  around it.

**Consequence:** this is a **partial** review. Everything that does not require a
session — the entire logged-out top-of-funnel — is **live-verified** this run.
The authenticated research→practice loop (`/interviews`, `/dashboard`,
`/practice`, `/history` with data) could **not** be exercised live; it is
reviewed from **source** this run, and its runtime behaviour is **carried from
run #20's full-live pass** where the files are unchanged. Findings that depend on
runtime/rendering are tagged "static — needs live-browser confirmation."

Screenshots were captured in-session (logged-out surfaces only; no CV, no
credentials, no PII) but are **not committed** — during the freeze I am keeping
the change docs-only and avoiding new permanent binary blobs in history. Evidence
is given as measured values, routes, and `file:line` instead, which the contract
permits.

## The headline: the freeze shipped, and it cleared run #20's entire top-of-funnel P0

Run #20's single P0 was that *the frontend still exposed the pre-freeze
guest/billing/auth surface* — the guest "Preview my prep" CTA fired a doomed
`research-preview` call and **blanked the page's best asset**, `/pricing` showed
live checkout CTAs pointing at an undeployed function, and public sign-up was
open. Since then three commits landed that implement the freeze decision:

- **`#354` — lock Prepio to the invite-only frozen core (PREPIO-27).**
- **`#360` — close freeze gaps found by the final audit and UX reviews.**
- **`#363` — [PREPIO-180] disclose that pasted CV text is saved with the prep plan.**

Verified live and in source this run, the following run-#20 findings are now
**RESOLVED**:

| Run #20 finding | Status now | Evidence |
|---|---|---|
| **P0** — pre-freeze guest/billing/auth surface exposed | **Resolved** ✅ | Guest path is a **static, deterministic sample** ("Illustrative sample · Payments company · Product Manager", labelled *"A fictional example… practice prompts, not verified questions… No live research runs when you open this sample."*). No Edge Function call on the guest action (live). `/pricing` → **404** (live). Auth is **invite-only, no Sign Up tab** (live): only Sign In / Forgot password / Resend verification. |
| **P2** — `/auth` sign-in fields have no `autocomplete` (15-audit repeat) | **Resolved** ✅ | Live DOM probe: `#signin-email` → `autocomplete="email"`, `#signin-password` → `autocomplete="current-password"`; both still `<label>`-associated. Fixed in `#360`. |
| **P3** — `/history` shows empty state despite in-progress work | **Resolved (copy)** ✅ | Empty state is now *"No finished sessions yet — Finished practice sessions appear here… Answers you save in an unfinished session stay on that interview in Your interviews."* (`src/pages/History.tsx:316-319`). This is exactly run #20's recommended fix: scope history to *finished* sessions and point to `/interviews` for in-progress work. |

The surface lock is **thorough, not cosmetic** — it is enforced in depth via
`src/lib/frozenProduct.ts` (`billing/answerFeedback/voice/profile/resumeUpload`
all `false`, "deliberately not overridable by a browser or environment flag") at
**both** the UI layer (voice tip in `HintBanner.tsx`, resume-upload blocks and
profile note in `Home.tsx`, answer-feedback tabs/cards in `SessionSummary.tsx`
and `SessionList.tsx`) **and** the service layer (`searchService.ts` throws
"Voice practice is unavailable." / "Resume upload is unavailable." / "Profile
import is unavailable."; `billing.ts` throws "Prepio is free and invite-only.").
The practice page is now text-only: `VoiceRecorder.tsx` is **no longer imported
by `Practice.tsx`**, so there is no visible "Record answer" affordance — run
#20's last-standing voice surface item is gone. Nav (`Navigation.tsx:34-38`) is
Home / Dashboard / Practice / Practice History only — no Profile or Pricing dead
links.

## Overall product judgment

**This is the strongest state this review has recorded. The freeze did what it
was scoped to do: the four-month "why is half the app dark" top-of-funnel
breakage is gone, the long-standing autocomplete accessibility repeat is finally
closed, and the `/history` returning-user confusion is fixed — all with no code
regressions.** The logged-out experience a first-time visitor now hits is honest
and self-consistent end to end: a clean hero, an invite-only story that matches
reality, a deterministic fictional sample that makes zero backend calls and says
so, retired billing/profile URLs that 404 instead of offering purchases that
can't complete, and sign-in fields that autofill. **No new user-facing P0 or P1
was found this run.** The single most impactful *remaining* user-facing defect is
the one run #20 already root-caused and that is tracked and authorized:
Favorite/Needs-work flag writes return `42P10` until the per-type-unique-key
migration is applied in the attended freeze deploy (PREPIO-170) — a production
deploy gate I could **not** re-confirm live this run because the backend is
unreachable here, carried from run #20 and the FREEZE_RELEASE baseline. The only
*new* findings are P3 polish: one measured contrast failure on the 12px
"Free · Invite-only" badge, sub-44px landing/auth chrome targets (carried), and
a generic 404 page. The remaining ceiling is not reliability any more — it is
**differentiation**: the logged-out sample proves the format but not yet the
*personalization* wedge (no "why this question", no company-signal or
CV-tailoring demo), so a first-timer still can't fully see why this beats asking
ChatGPT.

## Top 5 issues

### 1. P1 (carried; could NOT re-confirm live — backend unreachable) — Favorite / Needs-work flag write returns `400 / 42P10`; the fixing migration is written, authorized for the freeze window, and unapplied in production

- **Severity:** P1 — a core practice-triage affordance fails 100% of the time for real users until the migration ships.
- **Area:** practice
- **User scenario:** during practice a user taps Favorite (or Needs work) to mark what to revisit.
- **What happened:** run #20 observed live `POST user_question_flags?on_conflict=user_id,question_id,flag_type` → `400 {"code":"42P10","message":"there is no unique or exclusion constraint matching the ON CONFLICT specification"}`. The upsert (`src/services/searchService.ts`, `on_conflict` of `(user_id, question_id, flag_type)`) targets a constraint that does not exist in production. FREEZE_RELEASE.md's own 2026-09-21 live baseline confirms `user_question_flags` still has `UNIQUE(user_id, question_id)`, not the three-column key — i.e. **still unapplied**. I could not re-observe the `400` this run because the Supabase host is blocked from this environment (502 CONNECT); this finding is **carried**, not freshly live-verified.
- **Why it matters:** favorites/needs-work is how a time-pressured user decides what to practise next; a visible control that never persists erodes trust in whether anything persists. (Text-answer save was `201` live in run #20 — this is specifically the flag path.)
- **Recommended fix:** apply `supabase/migrations/20260710203000_question_flags_per_type.sql` in the PREPIO-124 attended freeze window (pre-check/dedupe conflicting rows first, per the FREEZE runbook — *do not silently deduplicate user data*); then verify all three flag entry points persist across a reload on desktop and mobile.
- **Tracking:** [PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170) (Urgent, Todo). Carried from run #20; re-confirmation blocked by environment egress this run.

### 2. P3 (NEW, live-measured) — The 12px "Free · Invite-only" badge fails WCAG AA contrast (4.06:1)

- **Severity:** P3 (WCAG 2.1 SC 1.4.3 Contrast (Minimum); small normal-weight text needs 4.5:1).
- **Area:** accessibility / landing
- **What happened (live):** the pill badge on `/` renders `--muted-foreground` (`30 8% 46%` ≈ `rgb(127,117,108)`, `src/index.css:30`) at **12px** on the warm-cream `--secondary` background (`rgb(244,243,241)`), measured at **4.06:1** — below the 4.5:1 floor for text this size. The 16px and 14px muted body paragraphs on white measure **exactly 4.50:1** — they pass, but with zero margin, so any future sub-16px non-bold use of this token is one step from failing (the 14px auth sub-copy is already right at the line).
- **Why it matters:** the badge is the first thing framing the product ("Free · Invite-only"); at 12px it's the most contrast-sensitive text on the page, and it's the token most reused across the app, so the fix is systemic.
- **Recommended fix:** darken `--muted-foreground` slightly (e.g. lightness `46% → ~42%`, which clears 4.5:1 at 12px on both white and `--secondary`) **or** stop using `--muted-foreground` for text below 14px and give the badge a darker dedicated token. Verify against both `--background` and `--secondary`.
- **Tracking:** below the >30-min ticketing threshold; **not filed during the freeze maintenance-pause.** Logged here for the next DESIGN_PRINCIPLES token pass / whenever the landing is next touched.

### 3. P3 (carried, live-measured) — Sub-44px touch targets on the landing/auth chrome

- **Severity:** P3 (external 44px ergonomic baseline; WCAG 2.5.8 AA 24px passes).
- **Area:** accessibility / mobile / landing / auth
- **What happened (live, 390×844):** landing nav **"Sign in"** is 71×**36** (desktop and mobile); on mobile `/auth`, **"Forgot password?"** and **"Resend verification email"** are each full-width but only **36px** tall, and the email/password inputs are **40px**. The primary **Sign In** button (44px) and **Back to home** (44px) are fine, and — carried from run #20 — practice-mode mobile controls are all ≥44px. The gap is specifically the landing/auth chrome.
- **Why it matters:** these are the first controls a mobile visitor touches; 36px is a small one-handed hit area.
- **Recommended fix:** bump landing/auth nav and secondary-link controls to a ≥44px min height, and inputs to ≥44px. Folds naturally into any landing/auth pass.
- **Tracking:** below the >30-min threshold; report note (same disposition as run #20 #5).

### 4. P3 (NEW, live) — The 404 page is generic and context-free for users following retired `/pricing` or `/profile` links

- **Severity:** P3 (copy / error recovery).
- **Area:** copy / error states
- **User scenario:** a returning user opens a bookmarked `/pricing`, `/profile`, or old billing URL — all intentionally retired by the freeze — and lands on the catch-all 404.
- **What happened (live):** the page renders a large **"404"** heading, **"Oops! Page not found"**, and a **"Return to Home"** link (`src/pages/NotFound.tsx`). It works, but "404" as the hero and "Oops!" are the developer-ish, low-trust patterns the copy standards call out, and nothing tells a user who deliberately went to `/pricing` *why* it's gone (the freeze made Prepio free and invite-only).
- **Why it matters:** these retired URLs are exactly the ones existing users may have bookmarked; a bare "404" reads as "the app is broken" rather than "this changed."
- **Recommended fix:** soften the copy to user-facing language ("This page isn't part of Prepio") and, for the known retired routes, one honest sentence ("Prepio is now free and invite-only — there's no billing page.") with a link to `/` or `/interviews`. Small, self-contained.
- **Tracking:** below the >30-min threshold; report note.

### 5. P2-leaning product observation (not a bug) — The logged-out sample proves the *format* but not the *personalization wedge*

- **Severity:** P2 for conversion (no defect; a time-to-value/differentiation gap).
- **Area:** landing / first-time understanding
- **What happened (live):** the guest sample is honest and clean — three stages (Hiring manager / Product discussion / Team collaboration), one question each, with a one-line answer-approach hint. But it is collapsed behind a "View sample plan" toggle, uses a generic "Payments company", and shows **no "why this question was asked"**, no stage difficulty, and no hint of CV/role tailoring. Run #20's pre-freeze landing example carried a per-question *"why it matters"*; the frozen sample is simpler. That's a defensible freeze simplification, **not a regression**, but it means the page still doesn't demonstrate the thing the product strategy calls the moat.
- **Why it matters:** a first-timer deciding "is this better than asking ChatGPT for interview questions?" sees a plausible but generic list. The differentiator — research-driven, company/role/CV-specific questions — is claimed in prose but never *shown*.
- **Recommended fix (for whenever the freeze lifts, not now):** restore a single "why it matters" line per sample question and, ideally, one concrete company-signal reference, so the sample itself argues the non-generic case. Deliberately **deferred** under the freeze — recorded as the standing differentiation ceiling, not a freeze-window action.
- **Tracking:** no issue filed (freeze; and this is product-strategy direction, not a defect). Carried as the top non-defect opportunity.

## Journey scorecard

Rows tagged **(live)** were exercised live this run; **(static)** were reviewed
from source and/or carried from run #20's full-live pass where the files are
unchanged. Comparison column is run #20 (2026-09-03).

| Area | 2026-09-03 | 2026-10-15 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | **4** | ▲ | **(live)** The guest-preview failure that *blanked* the page is gone; the static sample is honest, reliable, and well-labelled. Held below 5 by the differentiation gap (issue #5): no "why this question", generic company, sample behind a toggle. |
| Research entry | 4 | 4 | = | **(static)** Progressive CV-aware form unchanged behaviourally; `#363` adds an honest "Your CV text is saved privately with this prep plan…" line under the paste box (`Home.tsx:869,1049`). Not re-submitted (spends real budget). |
| Research progress/loading | 5 | 5 | = | **(static, carried)** Async modal unchanged in source; not re-triggered. |
| Generated output clarity | 5 | 5 | = | **(static, carried)** Plan/stage/question + guidance structure unchanged; strong in run #20's live pass. |
| Practice mode | 4 | 4 | = | **(static)** Now cleanly text-only (VoiceRecorder unused); coach panel hidden when a question has no guidance (`#338`/PREPIO-176). Held at 4 by the flag-write `42P10` (issue #1). |
| Mobile usability | 4 | 4 | = | **(live, logged-out)** Landing/auth sub-44px chrome targets remain (issue #3). Practice-mobile ≥44px carried from run #20. |
| CV trust (paste) | 4 | 4 | = | **(live/static)** Reframed: profile is unrouted (404) under the freeze; the only CV surface is the `/new-interview` paste box, now with an honest persistence disclosure (`#363`). PDF upload correctly gated off. |
| Dashboard/history/resume | 3 | **4** | ▲ | **(live `/history` logged-out copy; static dashboard)** `/history` empty state now scopes to *finished* sessions and points to "Your interviews" — resolves run #20 P3 #4. |
| Error/empty states | 4 | 4 | = | **(live)** Guest no longer blanks; `/history` empty state improved; protected-route redirect keeps intent ("Continue to Dashboard."). Held at 4 by the generic 404 copy (issue #4). |
| Accessibility | 4 | 4 | = | **(live)** `/auth` autocomplete **fixed** (long-standing repeat closed). Offset by the newly-measured 12px badge contrast fail (issue #2) and sub-44px targets (issue #3). Net hold. |
| Copy quality | 4 | 4 | = | **(live)** Freeze copy pass done: invite-only auth, honest fictional-sample labelling, CV disclosure. Minor drag: "Oops! / 404" (issue #4). |

**Composite: up two (First-time understanding, Dashboard/history), zero
regressions.** The two movers are both direct consequences of the freeze
shipping. The deployed core's scores are carried from run #20 (backend
unreachable here) and remain strong.

## Regression check

Multiple improvements since run #20; **no code regressions found.**

| Item | State | Note |
|------|-------|------|
| Pre-freeze guest/billing/auth surface (run #20 P0) | **Resolved** ✅ | Static guest sample, `/pricing` 404, invite-only auth. (`#354`/`#360`, PREPIO-27) |
| `/auth` autocomplete (15-audit repeat) | **Resolved** ✅ | `email` / `current-password` live. (`#360`, PREPIO-123) |
| `/history` empty-state vs in-progress parity | **Resolved** ✅ | Copy scopes to finished sessions, points to Your interviews. (PREPIO-107 direction) |
| Voice "Record answer" surface | **Resolved** ✅ | `VoiceRecorder` no longer imported; practice is text-only; service rejects voice. |
| Paid/feedback/profile/upload controls | **Resolved** ✅ | Gated off in depth via `frozenProduct.ts` (UI + service layer). |
| CV paste persistence disclosure | **Improved** ✅ | New honest inline line (`#363`, PREPIO-180). |
| Protected-route redirect intent | **Holding** ✅ | `/dashboard` → `/auth` shows "Continue to Dashboard." (live). |
| Favorite/Needs-work flag write (`42P10`) | **Still open** ⚠️ | Production migration unapplied; could not re-confirm live (backend blocked). (issue #1, PREPIO-170) |
| Landing sample richness | **Simplified (not a regression)** ⚠️ | Frozen sample drops the per-question "why it matters" run #20's example had. Deliberate; recorded as the differentiation ceiling (issue #5). |

## Recommended tickets

**No new Linear issues filed this run** — the same disposition as run #20, and
the correct one under the freeze (`CLAUDE.md`: *"Do not add features, recurring
audits or routine dependency PRs"*; FREEZE_RELEASE.md §5: *"Pause maintenance
work; only security incidents and critical breakages reopen it"*). The findings
map as follows:

1. **[P1] Apply `20260710203000_question_flags_per_type.sql`** so the
   Favorite/Needs-work upsert stops returning `42P10`. →
   **[PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170)** (existing, Urgent;
   part of the PREPIO-124 attended deploy). Carried; re-confirmation blocked by
   environment egress this run.
2. **[P3] 12px badge / `--muted-foreground` contrast (4.06:1)** — sub-threshold;
   fold into the next design-token pass. Not filed during the freeze pause.
3. **[P3] Sub-44px landing/auth chrome targets** — sub-threshold; fold into any
   landing/auth pass. Not filed.
4. **[P3] Generic 404 copy for retired routes** — sub-threshold; report note.
   Not filed.
5. **[P2 product] Show personalization in the logged-out sample** — deferred
   under the freeze; product-strategy direction, recorded not filed.

All substantive findings either map to an existing open issue (PREPIO-170) or are
below the >30-min threshold the hygiene convention sets; none meets the
freeze's "security incident or critical breakage" bar for reopening maintenance.

---

Capability: partial — logged-out frontend live-verified; backend (Supabase)
unreachable from this environment (502 CONNECT), authenticated surfaces reviewed
from source and carried from run #20's full-live pass.
