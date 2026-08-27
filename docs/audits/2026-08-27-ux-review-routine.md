# Prepio UI/UX Review — 2026-08-27 (recurring routine, run #18)

Eighteenth run of the recurring weekly UX-review routine. Baselines:
[`2026-06-21`](./2026-06-21-ux-review-routine.md),
[`2026-07-16`](./2026-07-16-ux-review-routine.md),
[`2026-07-30`](./2026-07-30-ux-review-routine.md),
[`2026-08-06`](./2026-08-06-ux-review-routine.md),
[`2026-08-13`](./2026-08-13-ux-review-routine.md),
[`2026-08-20`](./2026-08-20-ux-review-routine.md),
[`2026-08-23`](./2026-08-23-ux-review-routine.md).

## Capability check — FULL LIVE (frontend + backend both reachable)

This run is a **full-live** review: both capability checks passed and the authenticated **practice**
loop was exercised live (login → resume an existing plan → save an answer → flag a question). It was
**not** an end-to-end research-to-practice pass — no fresh research run was submitted this week, so
the research form and the async progress modal were not re-exercised (they are marked as such in the
scorecard). Backend state was probed live regardless (deploy table below).

- **Playwright Chromium: PASS** — `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
  (`--ssl-version-max=tls1.2` + `--ignore-certificate-errors` + explicit `--proxy-server` from
  `HTTPS_PROXY`; standing gotchas).
- **Frontend (Vercel): PASS** — `curl … https://prepio.qiuyue.dev/` → `200`.
- **Backend (Supabase): PASS** — `vjwrirrqprjzdorignlz.supabase.co/auth/v1/health` → `401` (server
  answered). **Login with the tester account succeeded** (`signInWithPassword` → redirect to
  `/interviews`). A **text-answer save persisted live** (`POST practice_answers` → `201`,
  session-progress advanced Q1→Q2, "1 answered"). The **Favorite flag write failed live**
  (`POST user_question_flags` → `400 / 42P10`). Guest-preview and checkout failures below are
  **live-observed network responses**, not inferences.

**What IS live-verified this run:** logged-out landing (desktop 1440×900 + mobile 390×844), guest
preview attempt, `/auth` (autocomplete probe), login, `/interviews`, practice mode
(desktop + mobile) — text-answer save (`201`), Favorite flag write (`400/42P10`), notes autosave,
`/history`, `/profile`, `/pricing` + a real checkout attempt, and an edge-function deploy probe.
Screenshots under [`assets/2026-08-27/`](./assets/2026-08-27/) — the tester account carries a real
seeded CV; profile/CV-derived captures were kept to non-PII surfaces (practice, pricing, history,
landing) and the flag-error capture.

### The week in one line: no product code shipped

`origin/main` HEAD is `d0377e8` (a docs PR). **Zero product-code commits landed on `main` since the
last review — `git log 04719f2..d0377e8` contains only that one documentation commit.** (An earlier
draft attributed the `ebea456` Practice test de-flake to this interval; that was wrong —
`ebea456` is an ancestor of the 2026-08-23 review commit `04719f2`, i.e. it predates the last
review, per Codex review of this PR.) So there are **no regressions and no new improvements** this
run: every finding below is carried unchanged from `2026-08-23`, now re-confirmed live. The product
surface has been static for a week while the P0 below has not moved.

### Edge-function deploy state — freshly probed live (the standing P0)

OPTIONS-preflight against each function (`Access-Control-Request-Method: POST`,
`Origin: https://prepio.qiuyue.dev`). Deployed functions answer `200`; missing ones return the
gateway `{"code":"NOT_FOUND"}` `404` (confirmed via a POST body check, not just the status):

| Function | Preflight | Product surface |
|----------|:--------:|-----------------|
| `interview-research` | **200** ✅ | Core research pipeline (POST body → function-level "Missing bearer token", i.e. genuinely deployed) |
| `company-research` | **200** ✅ | (sub-step) |
| `job-analysis` | **200** ✅ | (sub-step — invoked by `interview-research`; required for role-grounded questions) |
| `cv-analysis` | **200** ✅ | (sub-step — invoked by `interview-research`; required for CV personalization) |
| `interview-question-generator` | **200** ✅ | (sub-step) |
| `research-preview` | **404** ❌ | **Guest preview** (guest→signup funnel) |
| `create-checkout-session` | **404** ❌ | **Stripe checkout** (free→paid funnel) |
| `create-portal-session` | **404** ❌ | Billing management portal |
| `stripe-webhook` | **404** ❌ | Subscription state sync |
| `answer-feedback` | **404** ❌ | **Paid AI answer feedback** (the headline paid feature) |
| `profile-import` | **404** ❌ | Structured CV import drafts |
| `practice-audio-transcribe` | **404** ❌ | **Voice-answer transcription** |

**The core research→practice loop is deployed and healthy; everything that touches guest
conversion, monetization, the paid feature, structured CV import, and voice is not.** Same freeze on
record since **2026-05-15 — now ~15 weeks (over three-and-a-half months)** — live-confirmed again,
and cross-checked by three independent user-facing failures below (guest preview, checkout,
transcription).

## Overall product judgment

**The deployed core remains genuinely good; the commercial and top-of-funnel surfaces remain dead;
and nothing moved this week.** The research→practice loop a logged-in user sees is strong —
practice mode makes the question the unambiguous hero on both desktop and mobile (28px/bold on
mobile), every practice control is ≥44px, there is no horizontal overflow, notes autosave shows a
live "Saving draft…", and **text-answer save persists** (`201`, progress advanced live). But the
~15-week deploy freeze still guts both funnels the business depends on: **guest preview fails**
("We couldn't build the preview…"), **Stripe checkout fails** (CORS/`ERR_FAILED` →
"unavailable. Please try again later."), and **voice transcription 404s silently**. The
**Favorite / Needs-work flag write is still 100% broken** (`400 / 42P10`) — and this run pinpointed
that the fix already exists in the repo: migration `20260710203000_question_flags_per_type.sql`
adds the exact `(user_id, question_id, flag_type)` unique constraint the upsert needs, but it was
never applied to production. So the flag bug, like the seven functions, is **fixed-in-code but
undeployed** — one attended `npm run db:push && npm run functions:deploy` clears the P0 *and* the P1
together. The two accessibility carries (no landing `<h1>`; `/auth` autocomplete `null`) are also
unshipped — and PR #244, which fixed autocomplete, was **closed unmerged** on 2026-08-13, so that
path now needs re-applying rather than merging. The highest-value action is unchanged and now
overdue by any measure: **one attended backend deploy + migration push.**

## Top 5 issues

### 1. **P0 (live-confirmed) — Guest-preview, billing, paid-feedback, CV-import, and voice edge functions still not deployed (~15 weeks)**

- **Severity:** P0 — kills the guest→signup funnel, the free→paid funnel, the paid feature itself,
  and voice answers. In force since 2026-05-15 — **~15 weeks**; freshly verified live this run.
- **Area:** infra / deployment (fans out to landing, billing, practice, profile)
- **User scenario:** a first-time visitor tries the guest preview; a free user tries to buy; a
  mobile user records a voice answer.
- **What happened (all live this run):**
  - **Guest preview** (`research-preview` 404): "Anthropic · Product Manager" → "Preview my prep"
    renders *"We couldn't build the preview. Try again, or sign in to run the full research
    workflow."* The pre-signup value demo — the roadmap's conversion centerpiece — does not work.
    [`03-d-guest-preview.png`](./assets/2026-08-27/03-d-guest-preview.png)
  - **Checkout** (`create-checkout-session` 404): on `/pricing`, the upgrade CTA fires
    `POST create-checkout-session` → **CORS block / `net::ERR_FAILED`** (console:
    *"…blocked by CORS policy"*), UI shows *"unavailable. Please try again later."* No Stripe
    redirect. Monetization is dead. [`33-d-checkout.png`](./assets/2026-08-27/33-d-checkout.png)
  - **Voice transcription** (`practice-audio-transcribe` 404): mobile leads with a green "Record
    answer" CTA, but the transcribe function is absent → a recorded answer never produces a
    transcript (silent, see issue #4).
  - **Paid AI feedback** (`answer-feedback` 404) and **structured CV import** (`profile-import` 404)
    likewise undeployed.
- **Why it matters:** the deployed research loop makes the app *look* fully working to a logged-in
  smoke test, which is exactly why this has survived — the breakage is confined to the surfaces a
  casual authenticated pass skips. Those surfaces are the entire commercial and top-of-funnel story.
- **Recommended fix (maintainer, attended):** reconcile migration history, `npm run db:push`,
  `npm run functions:deploy`, then verify each recovered function no longer returns the gateway
  `NOT_FOUND` 404 — any function-originated status counts as "deployed." **`stripe-webhook` is the
  OPTIONS-probe exception:** `supabase/functions/stripe-webhook/index.ts` accepts POST only and
  returns **405** for other methods, so post-deploy its preflight is `405`, not `200` — verify it
  via a signed POST, not a `200`. Add a deploy-parity/health check so a partial deploy can't silently
  persist for months again.
- **Tracking:** [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124) (Urgent) — keep as
  "confirmed broken (2026-08-27, live)."

### 2. **P1 (live-confirmed; fix located) — Favorite / Needs-work flag write returns `400 / 42P10`; the fixing migration exists but is unapplied**

- **Severity:** P1 — a core practice affordance fails 100% of the time, with a red error toast.
- **Area:** practice
- **User scenario:** during practice a user taps ★ Favorite (or ⃠ Needs work) — or, on mobile,
  swipes right to favorite — to triage what to revisit.
- **What happened (live, `/practice`):** the star fills optimistically, then
  `POST user_question_flags` returns **`400`** with body
  `{"code":"42P10","message":"there is no unique or exclusion constraint matching the ON CONFLICT
  specification"}`, and a red toast: *"Couldn't save your Favorite flag / Try again in a moment."*
  The flag never persists. [`23-d-flag.png`](./assets/2026-08-27/23-d-flag.png)
- **Root cause (newly pinpointed this run):** the upsert at `src/services/searchService.ts:1783`
  uses `onConflict: 'user_id,question_id,flag_type'`, but that unique constraint does not exist in
  production. **The fix is already written:** migration
  `supabase/migrations/20260710203000_question_flags_per_type.sql` drops the old
  `(user_id, question_id)` key and adds `UNIQUE (user_id, question_id, flag_type)` — the exact
  constraint the upsert references. It has simply never been applied (`db:push` not run). So this is
  a *schema deploy*, not a code fix.
- **Why it matters:** favorites / needs-work is how a time-pressured user decides what to practice
  next. It is reachable three ways (the ★ button, the mobile Favorite/Needs-work buttons, and the
  "swipe right to favorite" gesture) — all fail. A promised, visible control that silently never
  works erodes trust in whether *anything* they do persists. (Text-answer save, by contrast, is
  `201`.)
- **Recommended fix:** apply `20260710203000_question_flags_per_type.sql` to production via
  `npm run db:push` (pre-check/dedupe any conflicting rows first). Ships with the same attended
  deploy as #1 but is a **schema** step — call it out separately so it isn't missed behind the
  function deploy. **Split into its own schema issue** from PREPIO-124.

### 3. **P2 (REPEAT, live-confirmed — still unfixed) — Landing page ships no `<h1>` and an out-of-order heading hierarchy**

- **Severity:** P2 (WCAG 2.4.6 / 1.3.1; the single most important first-impression page)
- **Area:** accessibility / landing
- **What happened (live, `/`):** `document.querySelectorAll('h1').length === 0` on both desktop and
  mobile. The hero *"Walk into your next interview knowing exactly what to expect."* is an `<h3>`;
  the static example title is an `<h3>`; "How it works" is an `<h2>` — outline runs
  **h3 → h3 → h2** with no top-level heading. `/pricing`, `/profile`, and `/history` all render a
  correct single `<h1>`, so landing is the isolated outlier. Unchanged since 2026-08-20 (no
  landing/auth commits merged since). [`01-d-landing.png`](./assets/2026-08-27/01-d-landing.png)
- **Why it matters:** heading navigation is a primary screen-reader wayfinding tool; the page that
  decides whether a visitor trusts the product enough to sign up gives an SR user no title anchor.
- **Recommended fix:** promote the hero to `<h1>`; demote the two section titles to `<h2>`/`<h3>` to
  form a valid outline. Mirror `/pricing`'s correct pattern.

### 4. **P2 (REPEAT, code-confirmed) — Voice transcription fails silently; no "Transcription unavailable" message**

- **Severity:** P2 (visibility-of-status / honesty gap; compounds the P0 for mobile users)
- **Area:** practice / copy
- **User scenario:** a mobile user taps "Record answer" (the *primary* answer CTA on mobile),
  records, and stops.
- **What happened:** `practice-audio-transcribe` is 404 (issue #1), so `transcribePracticeAudio`
  fails — and `src/pages/Practice.tsx:1482` handles that with a bare
  `if (!transcriptionResult.success) return;`. The audio uploads and the answer row saves, but the
  user is **told nothing**: no transcript appears and no message explains why. The repo's own design
  principles list the correct copy verbatim ([`docs/DESIGN_PRINCIPLES.md:74`](../DESIGN_PRINCIPLES.md)) —
  *"Transcription unavailable. Your answer was still saved."* — which is not shown. (Note the wording
  is deliberately **generic** — "your answer," not "your text answer": a voice-only recording saves
  `audio_path` with `textAnswer` undefined, so a "text answer was saved" message would itself be
  misleading. Keep the generic phrasing when implementing.)
- **Why it matters:** on mobile the recommended answer path *is* voice; a user who records and sees
  no transcript and no explanation reasonably concludes their answer was lost. Even after the #1
  deploy, the silent-failure branch is a latent honesty bug worth fixing on its own.
- **Recommended fix:** in the `!success` branch, surface the design-principles copy as a toast; keep
  the answer save. Independent of the deploy. Evidence: `src/pages/Practice.tsx:1481-1482`; mobile
  flow [`21-m-practice.png`](./assets/2026-08-27/21-m-practice.png).

### 5. **P2 (REPEAT, live-confirmed — 13th audit; the fix PR is now closed unmerged) — `/auth` sign-in fields have no `autocomplete` attributes**

- **Severity:** P2 (WCAG 1.3.5 Identify Input Purpose; genuine unfixed bug in `main`)
- **Area:** auth / accessibility
- **What happened (live, `/auth`):** `#signin-email` and `#signin-password` both return
  `autocomplete === null` (measured directly this run). Fields are properly `<label>`-associated, so
  this is narrowly the autofill/password-manager hint. **PR #244 implemented the fix but was closed
  *unmerged* on 2026-08-13** (it was a draft; 32 additions, tests passing) — so the change now needs
  re-applying, not merging. [`04-d-auth.png`](./assets/2026-08-27/04-d-auth.png)
- **Why it matters:** browsers/password managers can't reliably offer credential autofill; a
  returning user under time pressure retypes both fields.
- **Recommended fix:** re-apply PR #244's diff (`autocomplete="email"` / `current-password`, plus
  `new-password` + `username` on sign-up) on a fresh branch and merge. One small PR closes this.
- **Tracking:** [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123) (Low) — note the fix PR is
  now closed unmerged; reopen the work.

## Notable live observations (not top-5)

### Positives — live-verified this run (the deployed core is in good shape)

- **Practice mode: question is the hero, mobile clean.** Desktop and mobile both foreground the
  question; mobile renders it 28px/bold over two lines with Final Round / Medium badges, a
  "Aim for 1-2 min" timer, and Favorite / Needs work / Answer guide all ≥44px. No horizontal
  overflow (390/390). A fixed Skip / Save & Continue bottom bar. Notes autosave shows a live
  *"Saving draft… / Saved on this device while you practice."*
  [`21-m-practice.png`](./assets/2026-08-27/21-m-practice.png)
- **Text-answer save persists.** `POST practice_answers` → `201`; session progress advanced
  Q1→Q2 with "1 answered" live. [`23-d-flag.png`](./assets/2026-08-27/23-d-flag.png)
- **`/interviews` resumes well.** Cards show state + progress ("Stripe · Data Product Manager ·
  0 of 10 answered", "OpenAI · Solutions Architect · 8 of 40 answered · 20%") with
  Start/Continue practice one click away, and an Info popover explaining the answered count.
- **`/pricing` copy is honest and concrete.** *"Research, prep plans, and practice stay free. Paid
  subscriptions unlock AI feedback on saved practice answers…"* — free vs paid is unambiguous (the
  checkout button is the only broken part). [`32-d-pricing.png`](./assets/2026-08-27/32-d-pricing.png)
- **`/profile` is useful memory, not admin.** CV source shown ("Current source: …CV_2026….pdf"),
  honest subscription block ("Free plan. Upgrade when you want detailed AI coaching.").
- **Empty `/history` copy is well-written.** *"Ready to start practicing / Your first practice
  session will appear here with answers, timing, and notes…"* (but see the parity caveat below).

### Lower-severity notes

- **P3 (copy) — flag error implies transience it doesn't have.** *"Try again in a moment"* on the
  `42P10` toast is misleading: retrying always fails (schema bug, not a transient blip). Until #2
  ships, calmer honest copy (*"Couldn't save your flag right now."*) avoids training users to retry
  a permanently-broken action.
- **P3 (parity, carried — PREPIO-107/99) — `/history` shows the empty state despite real practice.**
  The tester has an *"In progress · OpenAI · Solutions Architect · 8 of 40 answered"* interview and
  the account returns real `practice_answers` rows, yet `/history` renders *"Ready to start
  practicing / Your first practice session will appear here."* Defensible if history = *completed*
  sessions only, but the disconnect reads as a bug to a returning user who has done real work.
  [`30-d-history.png`](./assets/2026-08-27/30-d-history.png)
- **P3 (a11y, carried) — sub-44px landing/auth touch targets.** Mobile landing: "Pricing"/"Sign in"
  36px, company/role inputs 40px ("Preview my prep" is a healthy 48px). Practice-mode mobile
  controls, by contrast, are all ≥44px — the gap is specifically landing/auth. WCAG 2.5.8 AA (24px)
  passes; this is the external 44px ergonomic recommendation. [`02-m-landing.png`](./assets/2026-08-27/02-m-landing.png)
- **P3 (a11y, new note) — the `/practice` page itself has no `<h1>`.** The question is an `<h3>`
  (20px desktop) and the guidance panel title is an `<h3>`; there is no top-level heading on the
  core screen. Visually the question dominates, so impact is lower than landing, but an SR user gets
  no page-level anchor. Consider making the question (or a visually-hidden "Practice" title) the
  `<h1>`.

## Journey scorecard

Full authenticated pass this run. Since **no product code shipped since `2026-08-23`**, scores are
unchanged by design — the parenthetical is `2026-08-23`. Most rows were re-measured live here; two
were **not** and are marked accordingly in their notes: *Research entry* (the form was not
re-submitted — confirmed unchanged in code) and *Research progress/loading* (carried from the
`2026-08-23` live measurement; unchanged in code). Rows tagged **(live)** were exercised this run.

| Area | 2026-08-23 | 2026-08-27 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | 3 | = | **(live)** Landing hero + static example strong, but the guest preview — the pre-signup value demo — still **fails** (P0 #1). |
| Research entry | 4 | 4 | = | **(code-confirmed, not re-submitted)** Honest, progressive, CV-aware form; unchanged in code this week. |
| Research progress/loading | 5 | 5 | = | **(carried from 2026-08-23)** Async modal unchanged in code since it was measured excellent then; not re-triggered this run. |
| Generated output clarity | 5 | 5 | = | **(live)** Dashboard/plan structure + CV-grounded positioning unchanged. |
| Practice mode | 4 | 4 | = | **(live)** Question is hero, save persists (`201`) — but Favorite/Needs-work is 100% broken (P1 #2), holding the score down. |
| Mobile usability | 4 | 4 | = | **(live)** Practice-mobile strong: no overflow, ≥44px, fixed bottom bar, question dominates. (Landing/auth targets still small — P3.) |
| Resume/profile trust | 4 | 4 | = | **(live)** Profile shows CV source + honest upgrade copy; structured *import* (`profile-import`) undeployed (P0). |
| Dashboard/history/resume | 3 | 3 | = | **(live)** Interviews cards resume well, but `/history` empty despite in-progress work (P3 parity). |
| Error/empty states | 4 | 4 | = | **(live)** Guest-preview, checkout, and flag failures show honest recoverable copy; empty `/history` copy good. (Voice fails silently — P2 #4.) |
| Accessibility | 2 | 2 | = | **(live)** Practice-mobile targets good, but no landing `<h1>` (#3), `/auth` autocomplete null (#5), landing sub-44px targets, no practice `<h1>` — all unfixed. |
| Copy quality | 4 | 4 | = | **(live)** Research/dashboard/profile/pricing copy honest and specific; "try again in a moment" on a permanent failure is the one off-note (P3). |

**Composite: flat.** No row moved because no user-facing code shipped. The deployed core holds at a
genuinely good level; the two structural anchors — the **P0 deploy freeze** and the **landing/auth
accessibility cluster** — are both carried and both live-confirmed still open.

## Regression check

Zero product-code commits merged to `main` since the last review (`git log 04719f2..d0377e8` is one
docs commit; the `ebea456` test de-flake predates the last review), so **no *code-introduced*
regressions are possible this week** — the frontend bundle is byte-identical to the last review.
That does **not** rule out regressions from backend drift (edge-function deploy state, applied
migrations, config/secrets, data, or external services) — the very state this audit separately
tracks, which can change independently of the commit range. The table below therefore reports each
surface from its **live check this run**, not from the `git diff`; the diff only explains why no
*shipped-code* change could have moved them. State table:

| Item | State | Note |
|------|-------|------|
| Practice question-as-hero (desktop + mobile) | **Holding** ✅ | No overflow, ≥44px, fixed bottom bar, 28px question on mobile. |
| Text-answer save | **Holding** ✅ | `201`; progress advanced Q1→Q2 live. |
| Notes autosave ("Saving draft…") | **Holding** ✅ | Live indicator, honest device-local copy. |
| Guest preview | **Still broken** ❌ | `research-preview` 404 → "We couldn't build the preview." (P0 #1) |
| Stripe checkout | **Still broken** ❌ | `create-checkout-session` CORS/`ERR_FAILED` → "unavailable." (P0 #1) |
| Favorite/Needs-work flag write | **Still broken** ❌ | `400 / 42P10`; fixing migration exists but unapplied. (P1 #2) |
| Voice transcription | **Still broken + silent** ❌ | `practice-audio-transcribe` 404; no user message. (P2 #4) |
| Landing `<h1>` / heading order | **Still unfixed** ⚠️ | Zero `<h1>`, h3→h3→h2. (P2 #3) |
| `/auth` autocomplete | **Still unfixed — 13th audit** ⚠️ | `null`; PR #244 now **closed unmerged**. (P2 #5) |
| `/history` vs in-progress card parity | **Still open** ⚠️ | Empty state despite "8 of 40 answered." (P3, PREPIO-107/99) |

**Net: across the surfaces exercised live this run, nothing regressed and nothing improved — a
static week (with the drift caveat above: unchanged shipped code, not a guarantee the untested
surfaces or backend state are unchanged). The P0 deploy freeze, the P1 flag write, and the
landing/auth a11y cluster all remain open and are freshly live-confirmed; the P1's fix is now
located in an unapplied migration, and the autocomplete fix PR has been closed unmerged.**

## Recommended tickets

Linear was unauthenticated in this session, so these could not be filed directly; they are
Linear-ready below (mostly updates to existing issues) and filing is owed to the next session with
Linear access.

1. **[P0] Deploy the seven missing edge functions + reconcile schema** — clear the gateway
   `NOT_FOUND` 404 on `research-preview`, `create-checkout-session`, `create-portal-session`,
   `stripe-webhook`, `answer-feedback`, `profile-import`, `practice-audio-transcribe` (any
   function-originated status counts as deployed — **`stripe-webhook` answers OPTIONS with 405 by
   design, so verify via a signed POST, not a 200**); add a deploy-parity health check. **Update
   [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124) → confirmed broken 2026-08-27 (live).**
   (Issue #1.)
2. **[P1] Apply the `user_question_flags` unique-constraint migration to production** — run
   `npm run db:push` so `20260710203000_question_flags_per_type.sql` lands (dedupe conflicting rows
   first); this clears the `42P10`. **Split from PREPIO-124 into its own schema issue** so it isn't
   lost behind the function deploy. Area: `area:practice` + Bug. (Issue #2.)
3. **[P2] Landing page: add `<h1>` + fix heading order** — promote hero to `<h1>`, normalise the
   outline; mirror `/pricing`. Area: `area:landing` + accessibility. (Issue #3.)
4. **[P2] Surface "Transcription unavailable" copy on transcribe failure** — replace the bare
   `return` at `src/pages/Practice.tsx:1482` with the design-principles toast; keep the answer save.
   Area: `area:practice` + copy. (Issue #4.)
5. **[P2] Re-apply `/auth` autocomplete fix** — PR #244 was closed unmerged; re-land
   `autocomplete` on the sign-in/sign-up credential fields. **Update
   [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123).** (Issue #5.)
6. **[P3] Honest flag-failure copy** — drop "Try again in a moment" for a permanent failure until #2
   lands. Area: `area:practice` + copy.
7. **[P3] `/history` ↔ in-progress card parity** — either surface in-progress sessions in `/history`
   or adjust the empty-state copy to distinguish "no *completed* sessions" from "no practice at
   all." **Update [PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107)/[PREPIO-99](https://linear.app/qiuyue/issue/PREPIO-99).**
8. **[P3] Add an `<h1>` to `/practice`** — make the question (or a visually-hidden "Practice" title)
   the page's top-level heading. Area: `area:practice` + accessibility.

## Next-run focus

1. **Re-probe the deploy state first** (OPTIONS-preflight table). If the seven functions no longer
   return the gateway `NOT_FOUND` 404 (remembering `stripe-webhook` answers OPTIONS with `405` by
   design — verify via a signed POST), re-run guest preview + checkout + a voice answer to confirm
   the funnels recovered; if not, the P0 carries with an even longer clock.
2. **Confirm the `42P10` flag fix** — after `db:push`, favorite a question and check for `201`
   instead of `400`.
3. **Rotate the research company** (Vitol / McKinsey / Palantir) once the backend is stable enough
   to re-submit a fresh run, to keep the personalization check honest across roles.

`Capability: live browser verified (frontend + backend both reachable; full authenticated pass — login, live save `201`, live flag `400/42P10`, live deploy probe; no product code shipped since last review)`
