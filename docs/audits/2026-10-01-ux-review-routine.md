# Prepio UI/UX Review — 2026-10-01 (recurring routine, run #21)

Twenty-first run of the recurring weekly UX-review routine. Baselines:
[`2026-08-13`](./2026-08-13-ux-review-routine.md),
[`2026-08-20`](./2026-08-20-ux-review-routine.md),
[`2026-08-23`](./2026-08-23-ux-review-routine.md),
[`2026-08-27`](./2026-08-27-ux-review-routine.md),
[`2026-08-30`](./2026-08-30-ux-review-routine.md),
[`2026-09-03`](./2026-09-03-ux-review-routine.md).

## Capability check — STATIC CODE + LIVE DEPLOYED-BUNDLE VERIFICATION (no rendered browser capture)

Per [`UX_REVIEW_ROUTINE.md`](./UX_REVIEW_ROUTINE.md), both capability checks are reported honestly:

- **Live app reachable: PARTIAL / verified by fetch.** `curl https://prepio.qiuyue.dev/` → `200`.
  The deployed JS bundle was fetched over the standard agent proxy (an allowed HTTPS GET) and its
  route chunks grepped for freeze markers — see "Freeze lock is live" below. This is strong evidence
  about *what the production frontend actually serves*, stronger than a screenshot for the
  freeze-deployment question.
- **Playwright Chromium / rendered capture: NOT AVAILABLE this run.** The session-start hook failed
  to download Chromium 1228 (`cdn.playwright.dev` transfer aborted); a pre-installed Chromium 1194
  exists, but the only known way to drive it in this environment — a local TLS-terminating proxy shim
  (the "MITM shim" prior runs used to get past the egress ClientHello reset) — is **blocked by the
  environment's containment policy this run**. No forward proxy could be launched, so no page was
  rendered.

**Consequence (static-only limitations, stated up front):** this run did **not** visually verify
rendered layout, mobile-viewport behavior, touch-target sizes, keyboard focus order, screen-reader
order, or slow-network / offline / runtime loading states. Those findings are carried from prior
live runs (notably 2026-09-03, which was full-live) and from source; where user impact depends on
rendering they are marked "inferred from code / needs live-browser confirmation." The authenticated
flag-write failure was **not** re-tested live this run — its status is inferred from the pending
migration (see issue #2).

Source base for this review: `main` @ `a08ca05` (the review branch is even with `origin/main`).

## The headline: the frozen-core surface lock is now LIVE in production

Every prior review through run #20 carried the same standing **P0** — *"the frontend still exposes the
pre-freeze guest/billing surface; a guest's primary CTA fires a doomed `research-preview` call, blanks
the best pre-signup asset, and `/pricing` offers a purchase that cannot complete."* **That is now
resolved in the deployed app.**

`fix: lock Prepio to the invite-only frozen core` (#354, merged 2026-09-22) and its routing-boundary
test (#357) landed, and the production bundle serves the locked surface. Verified by fetching and
grepping the live route chunks:

| Live chunk | Freeze markers **present** | Pre-freeze markers **absent** |
|---|---|---|
| `assets/Home-*.js` | `sample plan`, `Illustrative sample`, `Prepare for your next`, `Sign in to prepare` | `Preview my prep`, `research-preview`, `Upload PDF`, `Choose monthly` |
| `assets/Auth-*.js` | `invite-only`, `Sign in with your invited account` | `Create account`, `Sign up`, `signup` |

What the lock does, confirmed in source (`src/lib/frozenProduct.ts`, `GuestSample.tsx`, `App.tsx`,
`Navigation.tsx`, `Auth.tsx`, `Home.tsx`):

- **Guests** get a deterministic, fictional **static sample** (`GuestSample.tsx`) — no Edge Function,
  OpenAI, Tavily, or network request. It carries an honest `Illustrative sample` badge and the line
  *"These are practice prompts, not verified questions from a particular employer. No live research
  runs when you open this sample."* This is exactly the PREPIO-27 boundary.
- **`FROZEN_PRODUCT`** (`billing / answerFeedback / voice / profile / resumeUpload`, all `false`) is a
  single, non-overridable kill-switch threaded through Home, Practice, History, SessionSummary,
  SessionList, searchService, and billing. Resume **upload**, paid feedback, voice, and profile import
  are all gated off; **CV paste text stays** (allowed by the freeze).
- **Routes** `/pricing`, `/profile`, `/settings` are removed from the router — they now fall through to
  `NotFound` (covered by `src/__tests__/App.routing.test.tsx`).
- **Auth** is sign-in only, with invite-only copy (*"Prepio is free and invite-only. Sign in with your
  invited account."*); no signup tab exists.
- **Nav** is Home / Dashboard / Practice / History + sign-out — no profile, pricing, or billing.

This is the single biggest week-over-week improvement in this review's history: the top-of-funnel
went from "actively worse than doing nothing" to a clean, honest, self-consistent invite-only surface.

**Important caveat — this is a frontend lock, not a verified production freeze.** Per
[`docs/FREEZE_RELEASE.md`](../FREEZE_RELEASE.md) the release is still a *candidate*. The server-side
gates remain open: production Auth "allow new signups / anonymous" must still be turned off and
*verified* (not just absent from the UI) under PREPIO-27/124; the backend manifest deploy and the
flag-fix migration are not yet applied (PREPIO-124, PREPIO-170); security/PII gates
(PREPIO-168, PREPIO-145) and the acceptance pass (PREPIO-30) are open. Do not read "the lock is live"
as "the freeze is done."

## Overall product judgment

The product is **meaningfully better and more trustworthy than last week**, and the improvement is
concentrated exactly where it mattered most. The chronic top-of-funnel P0 — a guest's first click
failing and erasing the page's best proof — is gone: a logged-out visitor now lands on a calm,
honest invite-only page with a one-click fictional sample that makes *no* network call, and the
pricing/signup/upload surfaces that pointed at undeployed functions have been removed from the
shipped bundle. The authenticated research→practice core remains strong (research form with real
progress reporting, practice question as a true `<h1>` hero, honest device-local autosave copy,
action-oriented empty states on Interviews/History). **The highest-remaining user-facing risk is no
longer the frontend — it is the still-open backend freeze gates:** until PREPIO-170's migration is
applied, **Favorite / Needs-work still fails in production** for every practising user, and until the
production Auth toggles are verified, "invite-only" is a UI claim rather than an enforced boundary.
The one genuinely new frontend gap this run is small: the sole remaining CV-collection surface (the
`/new-interview` paste box) has strong *value* framing but **no privacy/trust line** — the copy that
PREPIO-37 added lived on the now-removed Profile page.

## Top 5 issues

### 1. Favorite / Needs-work flag write still fails in production (migration unapplied)
- **Severity:** P1 (carried; now the top live user-facing defect)
- **Area:** practice
- **User scenario:** A signed-in user taps Favorite or Needs-work on a practice question.
- **What happened:** The write targets `ON CONFLICT (user_id, question_id, flag_type)`, but production
  `user_question_flags` still has the two-column `UNIQUE(user_id, question_id)` key, so the upsert
  fails `400 / 42P10` (live-observed on 2026-09-03; **not** re-tested live this run — inferred from
  the migration still being unapplied). The fix migration
  `supabase/migrations/20260710203000_question_flags_per_type.sql` exists and is reviewed/authorized,
  but production's last applied migration is `20260515171733` — the per-type migration has not run.
- **Why it matters:** Favoriting and marking needs-work are core practice-triage actions; both are
  100% broken in production, so "practice feels like progress" quietly breaks.
- **Recommended fix:** Apply the migration as part of the attended freeze deploy. Already tracked as
  **PREPIO-170** (Todo) under PREPIO-124. No new ticket.
- **Evidence:** `supabase/migrations/20260710203000_question_flags_per_type.sql`;
  `docs/FREEZE_RELEASE.md` ("`user_question_flags` still has `UNIQUE(user_id, question_id)`");
  prior live capture in [`2026-09-03`](./2026-09-03-ux-review-routine.md).

### 2. "Invite-only" is enforced in the UI but not yet verified server-side
- **Severity:** P1 (carried, reframed)
- **Area:** auth
- **User scenario:** Someone POSTs a signup request directly to the Supabase Auth endpoint, bypassing
  the (now absent) signup UI.
- **What happened:** The frontend no longer exposes signup (verified in the live `Auth` chunk), but
  `docs/FREEZE_RELEASE.md` is explicit that `supabase/config.toml` "documents local intent; committing
  it does not apply production Auth settings," and that a direct non-invited signup must be verified to
  fail — which has not been done.
- **Why it matters:** The product promise is invite-only/free; an open server-side signup would let
  arbitrary accounts spend real OpenAI/Tavily budget through the deployed research functions.
- **Recommended fix:** Turn off "Allow new users to sign up" and "Allow anonymous sign-ins" in prod
  Auth and verify a direct signup request is rejected. Tracked as **PREPIO-27 / PREPIO-124**. No new
  ticket.
- **Evidence:** `docs/FREEZE_RELEASE.md` §2; live `Auth` chunk (no `signup`/`Create account`).

### 3. The only remaining CV surface has no privacy/trust copy
- **Severity:** P2 (new this run)
- **Area:** research / copy / trust
- **User scenario:** A signed-in user opens the "Add your CV" accordion on `/new-interview` and is
  about to paste their résumé to tailor questions.
- **What happened:** The paste area shows good *value* copy ("Optional. Personalizes questions to your
  background." / "CV added (N chars). Personalizes every question." / an "Improves relevance" badge)
  but **no statement of what happens to the CV** — no "used only to tailor this prep plan" line.
  PREPIO-37 (Done) added exactly this copy, but to the **Profile upload area**, which the freeze has
  removed; `renderProfileResumeNote()` is gated behind `FROZEN_PRODUCT.profile` (`false`) and renders
  nothing. So today the active CV surface ships with zero privacy framing.
- **Why it matters:** Anxious job-seekers pasting a résumé are exactly the moment trust copy earns its
  place; its absence is a quiet conversion/trust leak on a value-producing input.
- **Recommended fix:** Add one inline line near the paste box, e.g. *"Your CV is used only to
  personalize this prep plan."* Content-only; freeze-compatible. **New ticket filed — see Recommended
  tickets.**
- **Evidence:** `src/pages/Home.tsx` ~L990–1043 (desktop) and the mobile accordion ~L855–865;
  `FROZEN_PRODUCT.profile === false` in `src/lib/frozenProduct.ts`.

### 4. Guest can no longer see *personalized* output before signing in (accepted freeze trade-off)
- **Severity:** P3 (design note, not a defect)
- **Area:** landing
- **User scenario:** A first-time visitor wants to judge whether Prepio beats a generic ChatGPT prompt.
- **What happened:** By freeze design the guest sample is a fixed fictional "Payments company · Product
  Manager" plan, revealed behind a "View sample plan" toggle (collapsed on first paint). It
  demonstrates *structure* (stage → question → focus) honestly, but it cannot demonstrate
  *personalization* (the actual moat), and the strongest proof is one click away rather than visible.
- **Why it matters:** "Show personalization, don't just claim it" is a core principle; the freeze
  legitimately trades it away for guests (a guest must make no provider call). Worth tracking as a
  *post-freeze* landing improvement, not fixing now.
- **Recommended fix:** None during freeze. Post-freeze, consider showing the sample's first card
  expanded by default and a one-line "why this question" annotation. Related existing work:
  PREPIO-16 (Done), PREPIO-152 (Backlog). No new ticket.
- **Evidence:** `src/components/GuestSample.tsx` (`useState(false)` for `showSample`).

### 5. `/interviews` load-error state offers no recovery action
- **Severity:** P3 (static-inferred)
- **Area:** history / error states
- **User scenario:** A returning user's interview list fails to load (transient network / backend).
- **What happened:** The error renders a destructive alert reading *"We couldn't load your
  interviews."* with no retry affordance; the user's only recourse is a manual page refresh.
- **Why it matters:** Minor, but "help users recover from errors" wants a one-tap retry on a core
  returning-user surface.
- **Recommended fix:** Add a "Try again" button that re-runs the fetch. Small; defer to post-freeze or
  bundle into the next practice/dashboard polish pass. No new ticket this run (below the >30-min
  threshold on its own; note here for the trail).
- **Evidence:** `src/pages/Interviews.tsx` ~L185–189.

## Journey scorecard

Scored 1–5. Trend is vs. 2026-09-03 (run #20). Entries marked ⚠ are carried from prior live runs or
inferred from source — not visually verified this run.

| Area | Score | Trend | Notes |
|---|---:|:---:|---|
| First-time understanding | 4 | ▲ | Calm invite-only landing; honest static sample. Personalization not shown to guests (by design). |
| Research entry | 4 | = | Clear form, good value copy; real progress reporting. ⚠ render not re-verified. |
| Research progress/loading | 4 | = | `ProgressDialog` shows real `progress_pct`, step text, "Usually under a minute", honest connection-problem copy. ⚠ |
| Generated output clarity | 4 | = | Stage-grouped; question-as-hero carried from PREPIO-178. ⚠ |
| Practice mode | 3 | = | Question is a true `<h1>` on all three layouts; **but** Favorite/Needs-work still fails in prod (issue #1). |
| Mobile usability | 3 | = | ⚠ Not re-verified this run; carried from 2026-09-03 (≥44px controls, no horizontal overflow). |
| Resume/profile trust | 3 | ▼ slight | Upload/profile removed by freeze (honest); but active CV paste now ships **no** privacy copy (issue #3). |
| Dashboard/history/resume | 4 | = | Strong action-oriented empty states; interview cards with state. ⚠ |
| Error/empty states | 3 | = | Empty states good; offline banner honest; `/interviews` error lacks retry (issue #5). |
| Accessibility | 3 | = | h1 present on guest + practice; `aria-expanded`/`aria-controls` on sample toggle. ⚠ focus order/contrast not re-verified; PREPIO-123 (autocomplete) still In Progress. |
| Copy quality | 4 | ▲ | Invite-only/sample/offline copy is direct and honest; CV privacy line is the one gap. |

## Regression check

**No regressions found. Net improvement.** Specifically:

- **RESOLVED** — Guest "Preview my prep" doomed-call + blanked example (standing P0 through run #20):
  now a static sample, verified in the deployed bundle.
- **RESOLVED** — `/pricing` live checkout CTAs pointing at an undeployed function: route and CTAs
  removed from the shipped bundle.
- **RESOLVED (frontend)** — Public signup surface: Auth is invite-only, no signup UI in the live
  chunk. (Server-side verification still open — issue #2, not a regression.)
- **UNCHANGED** — Favorite/Needs-work `42P10` (issue #1): still blocked on the pending migration.
- **Minor new gap (not a regression of a prior fix in the same place):** CV privacy copy absent on the
  active surface because the freeze removed the Profile page where PREPIO-37 had placed it (issue #3).

## Recommended tickets

Nearly all actionable items are already tracked: **PREPIO-170** (flag migration), **PREPIO-27 /
PREPIO-124** (freeze surface + backend deploy + Auth verification), **PREPIO-30** (release/tag),
**PREPIO-168 / PREPIO-145** (security/PII), **PREPIO-173** (stale schema), **PREPIO-123** (auth
autocomplete, In Progress), **PREPIO-107** (surface needs-work on the card, In Progress). This run adds
**one** genuinely new, freeze-compatible item:

1. **[NEW] Add CV privacy/trust copy to the `/new-interview` paste area** — one inline line (e.g.
   "Your CV is used only to personalize this prep plan.") near the paste textarea, since the freeze
   removed the Profile surface where PREPIO-37 added it. Content-only, Improvement, `area:research-pipeline`.
   Filed in Linear and cross-linked to this review. (Issue #3.)

Deliberately **not** filed: issue #4 (post-freeze landing improvement — defer, overlaps PREPIO-16/152)
and issue #5 (`/interviews` retry — below the >30-min threshold; noted for the trail). No new tickets
for already-tracked backend gates.

---

Capability: static code/change-diff review only (live reachability + deployed-bundle string
verification confirmed; no rendered or interactive browser capture this run).
