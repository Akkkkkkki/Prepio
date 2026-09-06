# Prepio UI/UX Review — 2026-09-06 (recurring routine, run #21)

Twenty-first run of the recurring weekly UX-review routine. Immediate predecessor:
[`2026-09-03`](./2026-09-03-ux-review-routine.md) (run #20). Earlier baselines:
[`2026-06-21`](./2026-06-21-ux-review-routine.md),
[`2026-07-16`](./2026-07-16-ux-review-routine.md),
[`2026-08-13`](./2026-08-13-ux-review-routine.md),
[`2026-08-20`](./2026-08-20-ux-review-routine.md),
[`2026-08-27`](./2026-08-27-ux-review-routine.md),
[`2026-08-30`](./2026-08-30-ux-review-routine.md).

## Capability check — FULL LIVE (frontend + backend both reachable)

This run is a **full-live** review. The authenticated research→practice loop was exercised live
end-to-end on **both desktop (1440×900) and mobile (iPhone-13 390×844)**: login → resume via a
card's **Continue practice** → the **"Ready to practice?" Quick Start** interstitial → an actual
question → **text-answer save** → **Favorite flag attempt**. It was **not** an end-to-end fresh-research
pass — no new research run was submitted (that spends real OpenAI/Tavily budget on the tester account
and takes minutes), so the research **form** and the async progress modal were verified in code /
carried from prior runs, not re-triggered. Backend deploy state and the two live failures below were
probed live.

- **Playwright Chromium: PASS (via the local MITM shim).** This environment's egress TLS filter resets
  Chromium's ClientHello for every HTTPS host (`net::ERR_CONNECTION_RESET` / `ERR_PROXY_CONNECTION_FAILED`),
  while `curl`/Node's OpenSSL stack pass. Worked around with a small Node MITM proxy that terminates
  Chromium's TLS locally (throwaway cert + `--ignore-certificate-errors`) and re-issues each request
  through the agent proxy on Node's TLS stack via a CONNECT-tunneling `https.Agent`. **This is a standing
  gotcha for this environment — a plain `--proxy-server=$HTTPS_PROXY` launch will not load the app; carry
  the shim forward.** Two operational notes for the next run: (a) the pre-installed Chromium is **rev 1194**
  while the repo's Playwright pins **1228**, so launch with an explicit
  `executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`; (b) the shim needs
  `process.on('uncaughtException')` + per-socket `error` handlers — Chromium's speculative preconnects
  flood it with harmless `ECONNRESET`s that otherwise crash it, and it should be launched via the
  durable background-task mechanism (a plain `&`/`setsid` job dies with the shell here).
- **Frontend (Vercel): PASS** — `curl … https://prepio.qiuyue.dev/` → `200`; Chromium load → `200`,
  title `Prepio - Interview Prep Tool`.
- **Backend (Supabase): PASS** — **login with the tester account succeeded** (`POST auth/v1/token`
  → `200`, Enter-submit → redirect to `/interviews`). A **text-answer save persisted live** on both
  breakpoints (`POST practice_answers` → `201`; the Stripe card's progress advanced **2→3→4 of 10**
  across the run as saves landed). The **Favorite flag write failed live on both breakpoints**
  (`POST user_question_flags` → `400 / 42P10`). Guest-preview failure below is a **live-observed network
  response**, not an inference.

Screenshots under [`assets/2026-09-06/`](./assets/2026-09-06/). **`/profile` was not visited or
captured this run** — the tester account carries a real seeded CV; per
[PREPIO-145](https://linear.app/qiuyue/issue/PREPIO-145) no profile capture is committed. The
authenticated screenshots that are committed show only test-created interview titles
(Stripe / OpenAI roles) and a throwaway probe answer — no personal CV PII.

## The headline: nothing shipped, so nothing changed — this is a re-verification run

**Zero user-facing product commits merged to `main` since run #20.** The only commits on `main` since the
last review are the review doc itself (`132816b` / #334) and a backend log-redaction chore that predates
the review's own analysis (`3615e18` / #333, PREPIO-141 — redacts free-text-derived fields from the
`QUERY_PLAN` log; not user-facing). Consequently the live experience is **byte-for-byte the same** as
run #20, and every prior finding reproduces exactly. The freeze (PREPIO-124 deploy + PREPIO-27 surface
lock) has **not** been executed — no PR is open for either.

**In-flight but unmerged** (so not yet user-facing; noted for next run's regression watch): #338
[PREPIO-176] hide the practice coach panel when a question has no guidance; #336 [PREPIO-175] remove
forbidden `rounded-3xl` tokens from the route skeleton; #340 [PREPIO-144] classify retrieved job rows by
origin. None touch the P0/P1 items below.

### Edge-function deploy state — freshly probed live (identical to run #20)

OPTIONS-preflight + `POST {}` probe against each function. The split still **matches the intended freeze
manifest**; the gap between "shipped in repo" and "live" remains a *scope decision*, not an outage —
provided the frontend is brought into line (PREPIO-27), which it still is **not**.

| Function | Probe | Freeze intent (2026-09-02) |
|----------|:-----:|-----------------|
| `interview-research` | **deployed** ✅ (POST 401) | Core — keep |
| `company-research` | **deployed** ✅ (POST 500) | Core — keep |
| `job-analysis` | **deployed** ✅ (POST 500) | Core — keep |
| `cv-analysis` | **deployed** ✅ (POST 401) | Core — keep |
| `interview-question-generator` | **deployed** ✅ (POST 401) | Core — keep |
| `research-preview` | **404** ❌ | Intentionally NOT deployed — guest surface goes static (PREPIO-27) |
| `create-checkout-session` | **404** ❌ | Intentionally NOT deployed — hide checkout CTA (PREPIO-27) |
| `create-portal-session` | **404** ❌ | Intentionally NOT deployed — hide portal (PREPIO-27) |
| `stripe-webhook` | **404** ❌ | Intentionally NOT deployed — no live billing (PREPIO-27) |
| `answer-feedback` | **404** ❌ | Intentionally NOT deployed — hide paid-feedback entry (PREPIO-27) |
| `profile-import` | **404** ❌ | Deploy only if UI + smoke pass; else hide (PREPIO-27) |
| `practice-audio-transcribe` | **404** ❌ | Deploy only if UI + smoke pass; else hide (PREPIO-27) |

(POST 401/500 on the deployed core is expected — 401 = auth required, 500 = empty `{}` body rejected;
both prove the function is *live*, unlike the 404s.)

## Overall product judgment

**The deployed authenticated core remains genuinely strong, and it is unchanged from three days ago —
this run confirms no regressions and no new work has landed.** The research→practice loop a logged-in
user sees is the best part of the product: the practice question is the unambiguous hero and a proper
`<h1>` on both desktop and mobile (verified live), every mobile practice control is ≥44px, there is no
horizontal overflow, notes autosave shows honest device-local copy, **text-answer save persists**
(`201`, and the interview card's counter visibly advances), and protected-route redirects preserve
intent. The logged-out landing is also a strong first impression: a single clear `<h1>`, a research-first
form, and a **rich static example** ("How Stripe Senior Product Manager questions look in Prepio" — three
real questions with stage, difficulty, and a grounded *"why it matters"*). **But the same two top-of-funnel
and trust failures from every recent run are still live, because nothing has shipped to fix them:** (1) the
guest **Preview my prep** CTA fires a doomed `research-preview` call, errors with CORS, and *replaces* the
rich static example with an empty *"Your Anthropic preview will appear here"* placeholder — the CTA
actively destroys the page's best pre-signup proof; and (2) the **Favorite / Needs-work flag write is
100% broken** (`400 / 42P10`) on both breakpoints, with a red toast whose *"Try again in a moment"* copy
wrongly implies transience. Both fixes are already decided and scoped (PREPIO-27 + PREPIO-124 for the
surface; PREPIO-170 — a one-file migration that already exists in the repo — for the flag). **The single
highest-value action is unchanged: execute the freeze (attended deploy + frontend surface-lock + apply
the flag migration).** There is no UX design work left to *discover* here; the gap is purely *execution*
of already-planned tickets.

## Top 5 issues

Every issue below is a **live-confirmed repeat** with an existing open tracker. None is new this week.

### 1. **P0 (live-confirmed, repeat) — The frontend still exposes the pre-freeze guest/billing surface; clicking the guest CTA destroys the landing's best proof**

- **Severity:** P0 — a first-time visitor's primary CTA fails live and blanks the strongest pre-signup
  demo on the page; `/pricing` offers a purchase that cannot complete. This is the entire top-of-funnel,
  and it is worse than doing nothing.
- **Area:** landing / billing / auth (surface-lock)
- **User scenario:** a logged-out visitor types a company and clicks **Preview my prep**; or reads
  `/pricing` and clicks **Choose monthly**.
- **What happened (live this run):**
  - The **default** landing right panel shows a rich *"Static example · Stripe · Senior Product Manager"*
    card with three grounded questions ([`01-d-landing.png`](./assets/2026-09-06/01-d-landing.png)).
  - **Anthropic · Product Manager → Preview my prep** fires `POST research-preview` → **CORS block /
    `net::ERR_FAILED`** (console: *"…has been blocked by CORS policy"*, *"Error creating research preview:
    FunctionsFetchError"*); the UI shows *"We couldn't build the preview. Try again, or sign in to run the
    full research workflow."* **and the rich static example is replaced by an empty *"Your Anthropic
    preview will appear here"* placeholder.** Compare
    [`03-d-guest-preview.png`](./assets/2026-09-06/03-d-guest-preview.png) — the strongest "this isn't a
    generic ChatGPT wrapper" demo the page had is gone the moment the visitor engages.
  - `/pricing` still renders live **Choose monthly / Choose quarterly / Choose annual** checkout CTAs
    pointing at the intentionally-undeployed `create-checkout-session`
    ([`32-d-pricing.png`](./assets/2026-09-06/32-d-pricing.png)).
  - `/auth` still offers a public **Sign Up** tab (freeze wants invite-only).
- **Why it matters:** the deployed research loop makes the app *look* fully working to a logged-in smoke
  test, so this pre-signup breakage is exactly what a casual authenticated pass skips — and it is the
  whole funnel. With the freeze scope decided, the fix is not "deploy the function" — it is to make the
  surface match: static guest sample (no Edge Function call), hidden paid controls, invite-only sign-up,
  no copy promising unavailable features.
- **Recommended fix:** land **PREPIO-27** (surface lock) alongside the attended **PREPIO-124** deploy.
- **Tracking:** [PREPIO-27](https://linear.app/qiuyue/issue/PREPIO-27) (Urgent, Todo) +
  [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124) (Urgent, Todo). Confirmed live 2026-09-06.

### 2. **P1 (live-confirmed, repeat) — Favorite / Needs-work flag write returns `400 / 42P10` on desktop AND mobile; the fixing migration exists in-repo and is unapplied**

- **Severity:** P1 — a core practice triage affordance fails 100% of the time, with a red error toast, on
  both breakpoints.
- **Area:** practice
- **User scenario:** during practice a user taps **Favorite** (or **Needs work**) to triage what to revisit.
- **What happened (live, desktop + mobile `/practice`):** the control activates optimistically, then
  `POST user_question_flags?on_conflict=user_id,question_id,flag_type` returns **`400`** with body
  `{"code":"42P10","message":"there is no unique or exclusion constraint matching the ON CONFLICT
  specification"}`, and a red toast: **"Couldn't save your Favorite flag / Try again in a moment."** The
  flag never persists. [`21-m-flag.png`](./assets/2026-09-06/21-m-flag.png)
- **Root cause:** the upsert (`src/services/searchService.ts`) references a
  `(user_id, question_id, flag_type)` unique constraint that does not exist in production. **The fix is
  already written and merged into the repo** — migration
  `supabase/migrations/20260710203000_question_flags_per_type.sql` adds exactly that constraint (confirmed
  present this run) — it has simply never been applied to prod. This is a *schema deploy* inside the
  freeze scope, not a code fix.
- **Why it matters:** favorites / needs-work is how a time-pressured user decides what to practice next. A
  promised, visible control that never persists erodes trust in whether *anything* they do persists. (Text
  save, by contrast, is `201` — verified live this run.)
- **P3 rider (repeat):** the toast's *"Try again in a moment"* implies transience the deterministic
  `42P10` failure does not have. Moot once PREPIO-170 ships; not worth a separate copy fix ahead of it.
  (The older *"Something went wrong"* body is already fixed — [PREPIO-136](https://linear.app/qiuyue/issue/PREPIO-136) is Done.)
- **Recommended fix:** apply `20260710203000_question_flags_per_type.sql` in the PREPIO-124 freeze window
  (dedupe any conflicting rows first); verify all three entry points persist across reload on both breakpoints.
- **Tracking:** [PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170) (Urgent, Todo) — confirmed live 2026-09-06.

### 3. **P2 (live-confirmed, repeat — 16th audit) — `/auth` sign-in fields have no `autocomplete` attributes**

- **Severity:** P2 (WCAG 1.3.5 Identify Input Purpose; genuine unfixed bug in `main`)
- **Area:** auth / accessibility
- **What happened (live, `/auth`):** `#signin-email` and `#signin-password` both return
  `autocomplete === null` (measured directly this run). Fields **are** properly `<label>`-associated
  (`labels.length === 1` each), so this is narrowly the autofill / password-manager hint.
  [`04-d-auth.png`](./assets/2026-09-06/04-d-auth.png)
- **Why it matters:** browsers/password managers can't reliably offer credential autofill; an invited user
  under time pressure retypes both fields. Sign-in stays in scope under the freeze even as public sign-up
  is locked down.
- **Recommended fix:** add `autocomplete="email"` / `current-password` on sign-in (and
  `new-password` + `username` on the sign-up form if retained behind the invite gate). One small PR.
- **Tracking:** [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123) (Low, Backlog) — confirmed live 2026-09-06.

### 4. **P3 (live-confirmed, repeat) — `/history` shows the empty state despite real in-progress practice**

- **Severity:** P3 (visibility-of-status / trust; reads as a bug to a returning user)
- **Area:** history / dashboard
- **What happened (live, `/history`):** the account has two in-progress interviews on `/interviews`
  ("Stripe · Data Product Manager · 4 of 10 answered · 40%", "OpenAI · Solutions Architect · 8 of 40
  answered · 20%") and returns real `practice_answers` rows (two more saved this run), yet `/history`
  renders *"Ready to start practicing / Your first practice session will appear here…"*. Defensible if
  history = *completed* sessions only, but the disconnect reads as a bug to a user who has done real work —
  and the page's own subhead promises *"which questions still need another pass."*
  [`30-d-history.png`](./assets/2026-09-06/30-d-history.png)
- **Recommended fix:** surface in-progress sessions on `/history`, or make the empty-state copy explicit
  that it lists *completed* sessions and point to `/interviews` for in-progress work.
- **Tracking:** [PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107) (Backlog) — "surface needs-work &
  progress on the interview card and a Review tab" covers this direction.

### 5. **P3 (a11y, carried) — Sub-44px touch targets on the landing/auth chrome**

- **Severity:** P3 (external 44px ergonomic recommendation; WCAG 2.5.8 AA 24px passes)
- **Area:** landing / auth / accessibility (mobile)
- **What happened (live, mobile 390×844):** landing nav/CTA targets are under the 44px comfort baseline —
  "Pricing" 71×36, "Sign in or create account" 193×36, "Prepio" logo 81×28. Practice-mode mobile controls,
  by contrast, are all ≥44px (Favorite 112×44, Needs work 138×44, Answer guide 126×44, Record 217×48,
  Notes 103×48, Skip/Save 173×48), so the gap is specifically the landing/auth chrome.
  [`02-m-landing.png`](./assets/2026-09-06/02-m-landing.png)
- **Recommended fix:** bump landing/auth nav controls to a ≥44px min height. Folds naturally into the
  PREPIO-27 landing rework (that surface is being touched anyway).
- **Tracking:** below the >30-min ticketing threshold; report note, flagged for the PREPIO-27 landing pass.

## Notable live observations (not top-5)

### Positives — live-verified this run (the deployed core is in good shape)

- **Practice question is a proper `<h1>` on both breakpoints.** Desktop outline: `H1` (the question) →
  `H3` ("What strong answers show"); mobile: `H1` (the question). (PREPIO-178, holding.)
  [`21-m-practice.png`](./assets/2026-09-06/21-m-practice.png)
- **Text-answer save persists.** `POST practice_answers` → `201` on desktop and mobile; the Stripe card's
  progress counter advanced live (2→3→4 of 10) as saves landed. **Save & Continue is disabled until text
  is entered** (error prevention).
- **Landing is a strong first impression — until the CTA is clicked.** Single `<h1>`, research-first form,
  and the rich grounded static example ([`01-d-landing.png`](./assets/2026-09-06/01-d-landing.png)).
  Making that sample the *default rendered state* (PREPIO-27) would turn this into an unambiguous positive.
- **Practice: question is the hero, mobile clean.** Mobile renders the question large/bold with
  "Technical Round"/"Medium" badges, a timer + "Aim for…", a green **Record answer** primary + **Notes**,
  quick-notes autosave *"Saved on this device while you practice." / "Draft kept in this tab"*, and a fixed
  **Skip / Save & Continue** bottom bar. All controls ≥44px; **no horizontal overflow** (390/390 mobile,
  1440/1440 desktop).
- **Protected-route redirect preserves intent.** A logged-out direct link to `/practice` bounces to
  `/auth` with the route-specific "Practice" context ([`04b-d-redirect.png`](./assets/2026-09-06/04b-d-redirect.png)).
- **`/interviews` resumes well.** Cards show state + progress with **Continue practice** and **Plan** one
  click away ([`20-d-interviews.png`](./assets/2026-09-06/20-d-interviews.png)). **New detail this run:**
  Continue practice lands on a **"Ready to practice?" Quick Start / Customize** interstitial before the
  first question — a reasonable stage-selection step, not a dead end.

### Item to confirm next run (low priority)

- **Possible mobile question-card clip.** On the iPhone-13 capture, the practice question's third line sits
  right at the seam between the question card and the actions card, and may be slightly clipped by the
  card's overflow ([`21-m-practice.png`](./assets/2026-09-06/21-m-practice.png)). Could be a fullPage
  screenshot artifact rather than a real clip — **needs a live scroll/interaction check next run** before
  ticketing. If real, it lightly undercuts "the question is the hero" on small screens.

### Freeze-surface items to fold into PREPIO-27 (observed live, unchanged)

- `/pricing` still shows live **Choose monthly / quarterly / annual** checkout CTAs pointing at the
  intentionally-undeployed `create-checkout-session`. Copy itself is honest; it is the purchase *button*
  that must go for the freeze.
- Public **Sign Up** tab still present on `/auth` — freeze wants invite-only.
- Voice "Record answer" still offered (transcription is a deferred 404, now failing honestly per #311).
- PDF resume upload should be disabled in the frozen surface while the `pdfjs-dist` advisory (PREPIO-140)
  is open — not exercised this run (tester CV already seeded); flagged for the PREPIO-27 pass.

## Journey scorecard

No product commits shipped since run #20, so **no score moves**. All rows tagged **(live)** were exercised
this run on the current head; two research rows are code-confirmed / carried (the form was not re-submitted).

| Area | 2026-08-30 | 2026-09-03 | 2026-09-06 | Trend | Notes |
|------|------:|------:|------:|------|-------|
| First-time understanding | 3 | 3 | 3 | = | **(live)** Landing hero + rich static example are strong, but the guest preview still **fails and blanks the static example** (P0 #1). |
| Research entry | 4 | 4 | 4 | = | **(code-confirmed)** Honest, progressive, CV-aware form; unchanged in code. |
| Research progress/loading | 5 | 5 | 5 | = | **(carried)** Async modal unchanged; not re-triggered. |
| Generated output clarity | 5 | 5 | 5 | = | **(live)** Plan/stage/question + answer-guide structure strong and grounded. |
| Practice mode | 4 | 4 | 4 | = | **(live)** Question is hero + `<h1>`, save persists (`201`), Save gated on non-empty — but Favorite/Needs-work is 100% broken (P1 #2). |
| Mobile usability | 4 | 4 | 4 | = | **(live)** Practice-mobile strong: no overflow, ≥44px, fixed bottom bar, question dominates. Landing/auth targets still <44px (P3 #5); possible question-card clip to confirm. |
| Resume/profile trust | 4 | 4 | 4 | = | **(carried)** Not visited this run (PII). PDF upload should be disabled under the freeze (PREPIO-27/140). |
| Dashboard/history/resume | 3 | 3 | 3 | = | **(live)** Interviews cards resume well, but `/history` empty despite in-progress work (P3 #4). |
| Error/empty states | 4 | 4 | 4 | = | **(live)** Flag failure honest (if mis-worded), `/history` empty-state honest-but-disconnected. Held at 4 by the guest-preview **blanking** the static example. |
| Accessibility | 3 | 4 | 4 | = | **(live)** Practice `<h1>` on both breakpoints, focus rings visible, redirect context preserved. Remaining: `/auth` autocomplete null (#3), sub-44px landing/auth targets (#5). |
| Copy quality | 4 | 4 | 4 | = | **(live)** Copy honest and specific; the freeze will need a pass to drop promises of unavailable features and the "try again in a moment" flag rider (PREPIO-27/170). |

**Composite: flat.** The deployed core holds at a genuinely good level; no movement in either direction
because no user-facing code shipped. The two structural anchors remain the **freeze surface-lock**
(PREPIO-27) and the **flag-write migration** (PREPIO-170), both inside the decided freeze.

## Regression check

**Zero user-facing product commits merged to `main` since run #20** (only the review doc `#334` and the
non-user-facing backend log-redaction `#333`). Therefore **no regressions and no improvements** — the
live surface is unchanged.

| Item | State | Note |
|------|-------|------|
| Practice question heading structure | **Holding** ✅ | `<h1>` on desktop **and** mobile (PREPIO-178, shipped run #20). |
| Landing `<h1>` / heading order | **Holding** ✅ | Single `<h1>`; rich static example present by default. |
| Practice question-as-hero (both) | **Holding** ✅ | No overflow, ≥44px, fixed bottom bar, large bold question. |
| Text-answer save | **Holding** ✅ | `201`; card counter advanced 2→3→4 live. |
| Notes autosave | **Holding** ✅ | "Saved on this device while you practice. / Draft kept in this tab." |
| Protected-route redirect context | **Holding** ✅ | `/practice` → `/auth` with Practice context. |
| Flag-toast copy ("Something went wrong") | **Fixed, holding** ✅ | Now "Couldn't save your Favorite flag" (PREPIO-136 Done); only the "try again in a moment" rider remains (moot on PREPIO-170). |
| Guest preview (live path) | **Still broken** ❌ | `research-preview` 404 → CORS → blanks the static example. Scoped for removal, not deploy (PREPIO-27). (P0 #1) |
| Checkout / portal / webhook CTAs | **Still live-but-dead** ❌ | 404 functions; CTAs still shown. Scoped to be hidden (PREPIO-27). (P0 #1) |
| Favorite/Needs-work flag write | **Still broken** ❌ | `400 / 42P10` on both breakpoints; fixing migration exists in-repo, unapplied. (P1 #2) |
| `/auth` autocomplete | **Still unfixed — 16th audit** ⚠️ | `null`. (P2 #3, PREPIO-123) |
| `/history` vs in-progress card parity | **Still open** ⚠️ | Empty state despite "4 of 10 answered". (P3 #4, PREPIO-107) |

**Net: no change — status quo held for three days.** The freeze that would clear the P0 and P1 has not
been executed; no PR is open for PREPIO-27 or PREPIO-124.

## Recommended tickets

Every finding maps to an existing open issue — **no new issue is filed** (consistent with run #20, and per
the CLAUDE.md hygiene convention: these are already tracked, don't fragment them). Live-confirmation
comments were added to each via Linear this run.

1. **[P0] Lock the frozen guest/billing/auth surface** — static guest sample (no Edge Function call), hide
   checkout/portal/paid-feedback controls, invite-only sign-up, disable PDF upload (PREPIO-140), strip copy
   promising unavailable features. → **[PREPIO-27](https://linear.app/qiuyue/issue/PREPIO-27)** (Urgent).
2. **[P0] Attended freeze deploy** — reconcile migration history and deploy the five core functions +
   pending migrations via the explicit per-function manifest (never the all-functions script). →
   **[PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124)** (Urgent).
3. **[P1] Apply `20260710203000_question_flags_per_type.sql`** in the freeze window so the
   Favorite/Needs-work upsert stops returning `42P10`. → **[PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170)** (Urgent).
4. **[P2] Add `autocomplete` attributes to `/auth` sign-in (and retained sign-up).** →
   **[PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123)** (existing; confirmed live, 16th audit).
5. **[P3] Surface in-progress work on `/history` (or clarify the empty-state scope).** →
   **[PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107)** (existing).

### Deferred items (per CLAUDE.md hygiene convention)

- **No new Linear issues filed this run.** All findings map to existing open issues (PREPIO-27, -124,
  -170, -123, -107); live-confirmation comments added this run.
- Sub-44px landing/auth touch targets (P3 #5) and the "try again in a moment" flag-toast rider are below
  the >30-min ticketing threshold and are folded into the PREPIO-27 / PREPIO-170 work respectively.
- Possible mobile question-card clip: **not ticketed** — needs a live confirmation next run before it earns
  an issue.

---

Capability: live browser verified
