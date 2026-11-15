# Prepio UI/UX Review — 2026-11-12 (recurring routine)

First run of the recurring weekly UX-review routine since
[`2026-08-09`](./2026-08-09-ux-review-routine.md) (run #13). The routine had
been idle for ~3 months, during which the product was deliberately narrowed to
the [FREEZE_RELEASE](../FREEZE_RELEASE.md) scope. Several surfaces that earlier
runs flagged as broken or dishonest — the live guest "Preview my prep"
(dead CORS for seven weeks), `/pricing` + checkout, `/profile`, and the
breathing interstitial that gated Q1 — are **gone or reframed**, which resolves
those findings by removal rather than repair. This report therefore establishes
a fresh baseline at the freeze scope rather than a clean one-week delta.

## Capability check — live browser verified

Both checks required by [`UX_REVIEW_ROUTINE.md`](./UX_REVIEW_ROUTINE.md) passed:

- **Playwright Chromium: PASS** — pre-installed, `require('playwright')` +
  `chromium.launch()` with no options.
- **Live-app reachability: PASS** — `https://prepio.qiuyue.dev/` rendered in
  Chromium through the agent proxy, no TLS workarounds needed.

Coverage this run (desktop 1280×900 + iPhone 13 mobile emulation): logged-out
landing + guest sample plan + `/auth` + `/history`/`/dashboard` guest redirects;
logged-in `/interviews`, `/new-interview`, Stripe prep plan, full practice flow
(setup → Quick Start → question → typed answer → `Save & Continue` → Q2) on both
desktop and mobile; a **real end-to-end research run** (Anthropic · Product
Manager — captured the in-progress modal and verified it completed to *Plan
ready · 40 questions*); the research **error** review state; **offline** save
behavior (toggled `setOffline`); and a keyboard-focus / form-label / contrast
accessibility pass. Code cross-checked against `src/pages/Practice.tsx`.
Evidence under [`assets/2026-11-12/`](./assets/2026-11-12/). No CV PII: the
tester account's "Add your CV" box was empty on every captured surface.

## Overall product judgment

The freeze-scoped product is **honest, focused, and noticeably more trustworthy
than the mid-August build** — the dishonest/unwired surfaces are gone, and what
remains is tight. The research entry form, the research-progress modal, the prep
plan page, the resume/continue cards, and the offline/empty states are all
genuinely strong: direct copy, progressive disclosure, visible confidence
levels and sources, and work that stays safe when the network drops. The single
biggest user-facing risk sits in the most important surface: **in practice
mode, the box where the user types their actual interview answer is labeled
"Quick notes" with a "jot the beats / capture bullet points" placeholder and a
"Saved on this device" caption** — on both mobile and desktop. The field holds
`currentAnswer` and submitting it marks the question answered, yet nothing tells
the user this is *the answer*. That undersells the core action, invites users to
treat a full answer as throwaway scratch, and muddies whether their work
persists to their account. Secondary risks are all polish-grade: a generic
research-failure message, sub-AA contrast on 12px helper text, and a
`Dashboard`-nav/`/interviews` redundancy. Time-to-value is good; the headline
fix is to make the answer field unmistakably the answer.

## Top 5 issues

### 1. Practice answer field is disguised as a "Quick notes" scratchpad
- **Severity:** P1
- **Area:** practice / copy
- **User scenario:** A user enters practice, reads the question, and looks for
  where to write their answer.
- **What happened:** The only text input bound to `currentAnswer`
  (`src/pages/Practice.tsx:2923` mobile, `:3272` desktop) is headed **"Quick
  notes"**, captioned *"Saved on this device while you practice,"* and uses the
  placeholder *"Jot the beats you want to hit…"* (mobile) / *"Capture bullet
  points or timing cues…"* (desktop). On desktop it lives in a right-hand
  "Practice tools" drawer, physically separated from the question, while the
  drawer subtitle says *"Write and save your answer."* The drawer title and the
  field label contradict each other. Clicking the main **"Start answering"** CTA
  on desktop dismisses the intro hint but reveals no answer field in the
  question column.
- **Why it matters:** Violates two product principles at once — *the current
  practice question (and its answer) is the hero*, and *copy should be honest
  about what a control does*. A user who reads "Quick notes / jot the beats"
  reasonably treats the box as optional scratch and under-invests in the answer,
  so practice stops feeling like progress. The "Saved on this device" wording
  also creates doubt about whether answers reach their account (they do, on
  `Save & Continue` → `serverSaved`).
- **Recommended fix:** Relabel the primary field "Your answer" (both layouts),
  change the placeholder to an answer prompt (e.g. "Type your answer — full
  sentences or structured bullets"), and reconcile the caption with the
  persistence model ("Autosaves as you type · saved to your account when you
  continue"). If a separate scratch-notes area is still wanted, make it a second,
  clearly-secondary field.
- **Evidence:** `assets/2026-11-12/04-practice-desktop-quicknotes-answer.png`,
  `05-practice-mobile.png`; `src/pages/Practice.tsx:2912-2929`, `:3239`,
  `:3272-3277`.

### 2. Research-failure state shows a generic, system-voiced message
- **Severity:** P2
- **Area:** research / error / copy
- **User scenario:** A user opens a run whose card reads "Research needs
  attention."
- **What happened:** The review screen shows heading **"Error Loading Interview
  Research"** and body **"Search processing failed. Please try again."** with
  *Try Again* / *Prep a new interview*. No reason, no company/role context, no
  statement that the entered details are preserved. The card promised the user
  could "review the error," but there is nothing to review.
- **Why it matters:** This is close to the explicitly-banned "Something went
  wrong" anti-pattern. Under time pressure, a user hit by an unexplained failure
  loses trust and can't tell whether re-running will cost them their inputs.
- **Recommended fix:** Name the run and reassure: *"We couldn't finish
  researching OpenAI · Solutions Architect. Your details are saved — retry, or
  start a new prep."* Drop internal terms ("Search processing", "Loading").
- **Evidence:** `assets/2026-11-12/07-research-error.png`, route
  `/dashboard?searchId=…`.

### 3. 12px helper text fails WCAG AA contrast
- **Severity:** P2
- **Area:** accessibility
- **User scenario:** A user reads the small grey helper lines under the research
  form fields.
- **What happened:** The muted helper text (`rgb(127,117,108)` on the near-white
  background, **12px**) measures **~4.06:1** contrast on four of five sampled
  strings ("Optional. Personalizes questions…", "Your CV text is saved
  privately…", "Country, seniority level…", "Known stages, interviewers…").
  WCAG 2.1 AA requires ≥4.5:1 for normal-size text. 12px is well below the
  large-text threshold, so these fail.
- **Why it matters:** The failing lines carry the trust/privacy and
  "what you'll get" copy — exactly the text an anxious user needs to read before
  pasting a CV. Low-vision and bright-sunlight mobile users lose it.
- **Recommended fix:** Darken the muted-foreground token used at ≤14px (target
  ≥4.5:1) or bump these helper lines to a tested token/size.
- **Evidence:** computed-contrast probe on `/new-interview`; values 4.06–4.50:1.

### 4. "Dashboard" nav and `/interviews` are the same page; duplicate cards are indistinguishable
- **Severity:** P2
- **Area:** dashboard / information architecture
- **User scenario:** A returning user clicks "Dashboard" expecting progress, or
  scans their interview list.
- **What happened:** `/dashboard` (no `searchId`) and `/interviews` render the
  identical "Your interviews" surface, so the "Dashboard" nav item and the
  post-login landing are duplicates, and the nav label doesn't match the page
  heading. Separately, two cards both read **"OpenAI · Solutions Architect"**
  (one errored, one 20%) with no date or other differentiator, so the user can't
  tell them apart.
- **Why it matters:** Redundant nav and undifferentiated cards weaken
  *recognition over recall* and make "resume the right prep" harder — the whole
  job of this surface.
- **Recommended fix:** Point "Dashboard" at the plan view or rename it
  "Interviews" to match the heading (one entry point); add a created/updated
  date (and optionally a short run label) to each card.
- **Evidence:** `assets/2026-11-12/` landing shots; `/dashboard` vs
  `/interviews` render byte-identical body text.

### 5. Landing hides its strongest proof behind a collapsed toggle
- **Severity:** P3
- **Area:** landing / first-time understanding
- **User scenario:** A first-time invited user lands logged-out and spends 30s
  deciding whether Prepio is worth signing in for.
- **What happened:** The page is a single sparse card — headline, one paragraph,
  and a "View sample plan" button. The concrete, well-built sample (Payments
  company · Product Manager, three stages with real questions + guidance) only
  appears after a click, yet the copy says *"Explore a fixed example below,"*
  implying it's already visible.
- **Why it matters:** The sample is the single best "this isn't a ChatGPT
  wrapper" proof, and it's behind an extra click with a copy mismatch. Showing
  it earlier raises first-30-seconds understanding at no honesty cost.
- **Recommended fix:** Expand the sample by default (or show the first stage as a
  teaser with "See the full sample plan"), and align the "below" copy to the
  actual state.
- **Evidence:** `assets/2026-11-12/01-landing-desktop.png`,
  `02-guest-sample-plan.png`.

## Journey scorecard

| Area | Score | Notes |
|---|---:|---|
| First-time understanding | 4 | Honest, concrete sample — but collapsed by default; sparse above the fold. |
| Research entry | 4 | Excellent: progressive disclosure, dynamic "Research {Company} →" CTA, disabled-until-valid, strong CV-privacy copy. |
| Research progress/loading | 4 | Best-in-class phased modal with %, ETA, and "safe to leave" copy. Nit: ETA non-monotonic (19s→55s). |
| Generated output clarity | 4 | Strong plan page: summary, confidence/priority badges, collapsible stages, "Why this plan + Sources". |
| Practice mode | 2 | Question is a clear hero, but the answer field is disguised as "Quick notes"; "Start answering" is hollow on desktop. |
| Mobile usability | 4 | Clean setup, question-as-hero, safe-area padding handled (`env(safe-area-inset-bottom)`), 44–48px touch targets. |
| Resume/profile trust | 3 | CV paste has good privacy copy; no standalone profile (out of freeze scope); "saved on this device" answer copy muddies trust. |
| Dashboard/history/resume | 4 | Excellent resume cards (state, progress, CTAs) and honest empty history; Dashboard/Interviews redundancy and duplicate cards cost a point. |
| Error/empty states | 3 | History-empty and offline states are excellent; research-failure copy is generic. |
| Accessibility | 3 | Labels, focus rings, safe-area good; 12px muted text fails AA; no `<main>` landmark; `/auth` h1 is the brand, not the page. |
| Copy quality | 3 | Mostly direct and honest (sample disclaimer, offline, dynamic CTA); the "Quick notes"=answer contradiction and generic error pull it down. |

## Regression check

No like-for-like prior run exists (first run in ~3 months; scope changed), so
this is a baseline rather than a delta. Relative to `2026-08-09`, the direction
is **positive by removal**:

- Guest "Preview my prep" dead CORS → replaced by a deterministic local sample
  plan (no network, honest disclaimer). **Resolved.**
- Breathing interstitial gating Q1 → gone; practice now goes setup → Quick Start
  → question directly. **Resolved.**
- `/pricing` + undeployed checkout, and `/profile` → removed from scope (now
  404). No longer a live dishonesty surface.

No new regressions observed against the freeze baseline. (Freeze
reconciliation items PREPIO-168/145, 124/170, 173, 30 remain open per
[FREEZE_RELEASE.md](../FREEZE_RELEASE.md) and are out of scope for a UX run.)

## Recommended tickets (ready to file — not auto-filed this run)

Held back from auto-filing because this is an unattended scheduled run and the
freeze ("do not add features, recurring audits or routine dependency PRs")
argues for a human to triage. All are `area:practice`/`area:landing`/
`area:infra` + `Improvement`/`Bug`, Quality & Maintenance project.

1. **Relabel the practice answer field from "Quick notes" to "Your answer"**
   (mobile `Practice.tsx:2916/2926`, desktop `:3252/3275`); align placeholder
   and the "saved on this device" caption with the actual persistence model.
   (Issue #1 above.)
2. **Rewrite the research-failure state** to name the run and reassure that
   inputs are saved; drop "Search processing"/"Loading" internal wording.
   (Issue #2.)
3. **Fix contrast of ≤14px muted helper text to ≥4.5:1** (darken the token or
   bump size). (Issue #3.)
4. **Resolve the Dashboard/Interviews redundancy** (single entry point, matching
   label) and **add a created/updated date to interview cards** so same
   company/role runs are distinguishable. (Issue #4.)
5. **Show the logged-out sample plan expanded (or a teaser) by default** and fix
   the "example below" copy. (Issue #5.)
6. **Make the research ETA monotonic** (or suppress the first unstable estimate)
   so it never jumps from ~19s to ~55s. (P3.)
7. **Add a semantic `<main>` landmark** as the skip-link target and make the
   `/auth` `<h1>` describe the page ("Sign in") rather than the brand. (P3, a11y.)

---

Capability: live browser verified
