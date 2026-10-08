# Prepio UI/UX Review — 2026-10-08 (recurring routine, run #21)

Twenty-first run of the recurring weekly UX-review routine. Baselines:
[`2026-06-21`](./2026-06-21-ux-review-routine.md),
[`2026-07-30`](./2026-07-30-ux-review-routine.md),
[`2026-08-13`](./2026-08-13-ux-review-routine.md),
[`2026-08-27`](./2026-08-27-ux-review-routine.md),
[`2026-09-03`](./2026-09-03-ux-review-routine.md) (immediately prior).

## Capability check — HYBRID (frontend live; backend egress-blocked this run)

- **Playwright Chromium: PASS, no TLS workaround needed this run.** A plain
  `chromium.launch({ proxy: { server: $HTTPS_PROXY } })` against the pre-installed
  `/opt/pw-browsers/chromium-1194` loaded the live app over the agent proxy with the
  session's configured CA trust (`NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`).
  **The MITM-shim gotcha that prior runs documented did not recur** for the frontend host —
  no `--ignore-certificate-errors` and no local MITM proxy were used (and, when attempted,
  a self-signed-cert shim was correctly refused by the sandbox as a TLS-weakening action).
- **Frontend (Vercel, `prepio.qiuyue.dev`): PASS** — `curl` → `200`; Chromium load → `200`,
  title `Prepio - Interview Prep Tool`. All logged-out captures below are live.
- **Backend (Supabase, `vjwrirrqprjzdorignlz.supabase.co`): BLOCKED by egress policy this run.**
  Chromium login returned `net::ERR_TUNNEL_CONNECTION_FAILED` ("Failed to fetch"); `curl` to the
  same host returned `CONNECT tunnel failed, response 502`; the agent proxy status reports a
  `connect_rejected` for the host. This is a **session network-policy restriction, reported not
  retried** (per `/root/.ccr/README.md`). Consequence: the **authenticated** flows (login,
  `/interviews` with data, `/history` with data, practice persistence, Favorite/Needs-work writes)
  could **not** be exercised live this run and are reviewed from **current-`main` code + the repo's
  own 2026-09-21 live baseline in [`docs/FREEZE_RELEASE.md`](../FREEZE_RELEASE.md) + carried
  confirmation from run #20**. They are labelled **(code-confirmed)** or **(carried)** throughout;
  none are claimed as live this run.

**What IS live-verified this run (all logged-out / frontend):** landing default state
(desktop 1440×900 + mobile 390×844), the static guest **sample** expansion and its **zero
network calls**, `/auth` (invite-only copy, no Sign-Up tab, autocomplete attributes), `/pricing`
(now 404), protected-route redirect context (`/practice` → `/auth` "Continue to Practice."),
keyboard tab-order + focus rings on landing and `/auth`, the sample disclosure's
`aria-expanded`/`aria-controls` behaviour, and no horizontal overflow at 390px (collapsed and
expanded). Screenshots under [`assets/2026-10-08/`](./assets/2026-10-08/). **No authenticated
surface was screenshotted** — login was egress-blocked, and in any case `/profile` is now a 404
under the freeze (no CV-bearing surface was reachable, so no PII-redaction question arose). Tester
credentials are a **known exposed secret** (PREPIO-168) and are deliberately kept out of this
report.

## The headline: the freeze surface-lock shipped and is LIVE — the top-of-funnel went from "actively broken" to "honest and clean"

Every prior run through #20 carried a **P0** on the logged-out surface: the guest **Preview my prep**
CTA fired a doomed `research-preview` call, failed with a CORS error, and **blanked** the page's best
pre-signup asset; `/pricing` showed live checkout CTAs pointing at an undeployed function; and public
sign-up was open. **The two frontend-decidable ones (guest preview, `/pricing`) are now resolved on
production, verified live this run**; the third — public sign-up — has its **frontend control removed
and verified live (no Sign-Up tab)**, but the actual invite-only gate is a **backend** check
(`docs/FREEZE_RELEASE.md` requires a direct non-invited signup request to *fail*), and the Supabase
host was egress-blocked this run, so **whether production Auth rejects non-invited signup is NOT
verified here** — it rides the attended PREPIO-124 backend gate. These landed via the freeze-lock
commits that merged since the last review:

- `9d9b711` / **#354** — *"lock Prepio to the invite-only frozen core"* (the PREPIO-27 implementation):
  `GuestSample.tsx`, `frozenProduct.ts`, reworked `Auth`, `Home`, `Practice`, `Navigation`.
- `bccb67c` / **#360** — *"close freeze gaps found by the final audit and UX reviews"* — autocomplete
  hints, History empty-state copy, voice/offline copy, auth recovery-flow fixes.
- `c4932a9` (#350, pdfjs 5→6), `908b8f4` (#353, react-router 6→7), `9987fc1` (#348, Playwright smoke
  now a blocking gate), plus security/privacy hardening (#337, #335, #344).

**Consequence for this review:** the long-standing top-of-funnel P0 is **closed on the frontend**, and
the one remaining core-flow defect (Favorite/Needs-work) is now purely a **backend deploy gate**
(PREPIO-170/124) that this run could not re-probe. The project is in its best user-facing shape in the
history of this routine.

### Live-verified freeze state (logged out)

| Surface | Prior run (#20) | This run (live) | Status |
|---|---|---|---|
| Guest landing | "Preview my prep" → CORS fail, **blanks** the example | Static card + **"View sample plan"** disclosure; clicking it makes **0 network calls** (verified) | **Fixed** ✅ |
| `/auth` sign-up **(frontend control)** | Public **Sign Up** tab present | **No Sign-Up tab**; copy: *"free and invite-only … Ask the person who invited you"* | **Frontend fixed** ✅ — backend signup-rejection gate still pending (PREPIO-124) |
| `/auth` autocomplete | `email`/`password` both `null` (15-audit repeat) | `#signin-email` = `email`, `#signin-password` = `current-password` | **Fixed** ✅ (PREPIO-123) |
| `/pricing` checkout CTAs | Live "Choose monthly/quarterly" → undeployed fn | `/pricing` → **404** (route removed) | **Fixed** ✅ |
| `/profile` | Rendered seeded CV (PII risk) | **404** (profile frozen) | **Fixed** ✅ |
| Protected-route redirect | `/practice` → `/auth` + intent banner | Holding: "Continue to Practice." | Holding ✅ |

## Overall product judgment

**This is the strongest week in the history of this review.** The freeze surface-lock that every prior
run flagged as the standing P0 is now shipped and **live on production** (verified logged-out): the
guest path is a deterministic static sample that makes **zero** Edge-Function/OpenAI/Tavily calls, the
page no longer self-destructs when the primary CTA is clicked, the `/auth` **frontend** is honestly
invite-only (no Sign-Up tab) with working autocomplete (closing a 15-audit-old a11y repeat), and the
dead `/pricing` and PII-risk `/profile` routes are gone. (Whether production Auth actually *rejects*
non-invited signup is a backend check this run could not reach — it rides the PREPIO-124 gate, not the
frontend; see Top-5 #2.) Logged-out accessibility is clean — single `<h1>`, skip-link-first tab
order, visible 2px focus rings, a proper `aria-expanded`/`aria-controls` disclosure, and no horizontal
overflow at 390px in either state. **The single highest-value remaining action is unchanged and is now
a pure backend gate: apply the `question_flags_per_type` migration to production (PREPIO-170) so
Favorite/Needs-work stops failing `400/42P10`.** The repo's own 2026-09-21 live baseline still shows
the old two-column constraint and PREPIO-170/124 are both still **Todo**, so there is no evidence it
has shipped — treat it as still-broken until applied and re-probed. The one genuinely *new* UX note is
small: the frozen guest landing is sparse and hides its only concrete proof-of-value behind a "View
sample plan" click on an otherwise near-empty page — defaulting the sample to visible would restore
immediate time-to-value at near-zero cost.

## Top 5 issues

### 1. **P1 (code-confirmed; not live-re-probable this run) — Favorite / Needs-work still fails `400/42P10` in production until the flag migration is deployed**

- **Severity:** P1 — a core practice-triage affordance fails 100% of the time in prod. (Held at P1,
  not P0, because it is a single unapplied migration with the fix already written and authorized.)
- **Area:** practice
- **User scenario:** during practice a user taps **Favorite** / **Needs work** to mark what to revisit.
- **What the evidence shows:** the client still upserts with
  `onConflict: 'user_id,question_id,flag_type'` (`src/services/searchService.ts:1762`), which requires a
  three-column unique constraint. The fixing migration
  `supabase/migrations/20260710203000_question_flags_per_type.sql` exists (drops the two-column key,
  adds `UNIQUE(user_id, question_id, flag_type)`), but **`docs/FREEZE_RELEASE.md`'s 2026-09-21 live
  baseline records production still carrying `UNIQUE(user_id, question_id)`**, and **PREPIO-170 and
  PREPIO-124 are both still `Todo`**. The backend was egress-blocked this run, so it could not be
  re-probed — but nothing indicates the fix has shipped.
- **Why it matters:** favorites/needs-work is how a time-pressured user decides what to practice next; a
  visible control that never persists erodes trust in whether anything persists.
- **Recommended fix:** apply `20260710203000_question_flags_per_type.sql` in the attended PREPIO-124
  freeze window (pre-dedupe any conflicting rows first — the baseline precheck returned zero, re-run it
  at deploy), then verify all three flag entry points persist across a reload on desktop and mobile.
- **Tracking:** [PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170) (Urgent, Todo) inside
  [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124) (Urgent, Todo). **Not live-verified 2026-10-08
  (backend blocked); last live-confirmed broken 2026-09-03.**

### 2. **P1 (release-integrity) — Production freeze is still "candidate, not verified": the frontend lock shipped but the attended backend reconcile/deploy (PREPIO-124) has not**

- **Severity:** P1 — not a user-visible bug, but the release cannot be called done, and #1 lives here.
- **Area:** infra / release
- **What the evidence shows:** the **frontend** freeze lock is live (verified this run). The **backend**
  side — reconcile the divergent migration history, deploy only the five core functions + pending
  migrations via `supabase/freeze-functions.json`, apply the flag migration — is the attended owner
  runbook and is **unverified**: `docs/FREEZE_RELEASE.md` is headed *"candidate; not a verified
  production freeze"*, its deployed-function versions "predate the merged ownership/privacy fixes"
  (#337, etc.), and PREPIO-124 is still `Todo`. CLAUDE.md's Current Product Truth explicitly forbids
  calling merged code deployed from source checks alone.
- **Why it matters:** the merged security/privacy fixes (search-ownership enforcement #337, log
  redaction #335/#344) and the flag migration only protect real users once the attended deploy runs.
  Until then the live backend is running older function versions than `main`.
- **Recommended fix:** complete the PREPIO-124 attended runbook (owner-gated), record the evidence
  gates in `docs/FREEZE_RELEASE.md`, then re-run this routine's authenticated pass from an environment
  with Supabase egress to confirm.
- **Tracking:** [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124) (Urgent, Todo),
  [PREPIO-27](https://linear.app/qiuyue/issue/PREPIO-27) (Urgent, In Progress — frontend portion now
  live-verified).

### 3. **P2 (NEW, live-confirmed) — The frozen guest landing is sparse and hides its only proof-of-value behind a click**

- **Severity:** P2 — top-of-funnel first-impression; weakens time-to-value for the one page a
  not-yet-signed-in (invited) visitor sees.
- **Area:** landing
- **User scenario:** an invited user (or anyone) opens `/` logged out to understand what Prepio does.
- **What happened (live):** the default landing is a **single small card** — badge "Free · Invite-only",
  `<h1>` "Prepare for your next interview", a two-line description, and a **"View sample plan"** button —
  on an otherwise near-empty viewport ([`01-d-landing.png`](./assets/2026-10-08/01-d-landing.png)). The
  concrete example (three fictional "Payments company · Product Manager" prompts with stage + focus) only
  appears **after** clicking ([`02-d-sample.png`](./assets/2026-10-08/02-d-sample.png)). The sample is
  honest and well-structured, but it is the page's only differentiator and it starts collapsed. The old
  pre-freeze landing (per run #20) led with a rich, always-visible example and a "How it works" section;
  the freeze replaced that with this minimal, collapsed-by-default card.
- **Why it matters:** the review's own first principle is *time-to-value*; "Show personalization/value,
  do not just claim it" wants the proof visible, not one interaction away on an empty page. Even for an
  invite-only audience, the one asset that explains the product shouldn't be hidden.
- **Recommended fix:** default the sample to **expanded** (render `GuestSample` with `showSample` true,
  keep the toggle to collapse), or inline the three prompts directly under the hero and drop the
  disclosure. Optionally restore a one-line "Research → Plan → Practice" strip to fill the empty page.
  Keep the honest "fictional example / no live research" caption.
- **Evidence:** desktop 1440×900 + mobile 390×844, `/`, logged out.
- **Tracking:** **new — proposed for the Landing Page Framing project** (Improvement, `area:landing`);
  not covered by PREPIO-27 (which was about *locking* the surface, now done).

### 4. **P3 (REPEAT, live-confirmed) — Sub-44px landing/auth nav touch targets**

- **Severity:** P3 (external 44px ergonomic recommendation; WCAG 2.5.8 AA 24px passes)
- **Area:** landing / auth / accessibility (mobile)
- **What happened (live, 390×844):** header controls are under the 44px comfort baseline — "Sign in"
  **71×36**, the brand/nav link ~81×28. The freeze landing rework did **not** bump these. (Practice-mode
  mobile controls were ≥44px when last live-measured — the gap is specifically the landing/auth chrome;
  practice could not be re-measured live this run.)
- **Why it matters:** these are the first controls a mobile visitor touches; 36px is a small one-handed
  hit area.
- **Recommended fix:** set a ≥44px min-height on the header nav controls. A few-line change to the
  `Navigation` header.
- **Evidence:** [`04-m-landing.png`](./assets/2026-10-08/04-m-landing.png).
- **Tracking:** below the >30-min ticketing threshold; left as a report note (as in run #20).

### 5. **P3 (code-confirmed) — `/pricing` and `/profile` are now hard 404s rather than graceful redirects**

- **Severity:** P3 — polish; correct for the freeze, but a blunt landing for a bookmark/back-button hit.
- **Area:** copy / navigation
- **User scenario:** a returning user with a bookmarked `/pricing` or `/profile` (both existed pre-freeze)
  opens it.
- **What happened (live for `/pricing`; code-confirmed for `/profile`):** both render the generic
  `NotFound` — *"404 / Oops! Page not found / Return to Home"*. Honest, but it reads as breakage rather
  than "this isn't part of the current free invite-only product."
- **Why it matters:** low impact, but a frozen product can orient the user better than a bare 404 for a
  route it deliberately removed.
- **Recommended fix (optional, folds into the freeze):** redirect these routes to `/` (or `/interviews`
  for signed-in users), or give `NotFound` a one-liner for intentionally-removed freeze routes. Not worth
  a standalone ticket; fold into the PREPIO-27 copy pass if that surface is touched again.
- **Evidence:** `/pricing` live 404; `/profile` 404 (route removed under `FROZEN_PRODUCT.profile=false`).

## Notable live observations (not top-5)

### Positives — live-verified this run

- **Guest sample makes zero backend calls.** Clicking "View sample plan" produced **no** request to any
  `supabase.co` / `functions/v1` / `research-preview` endpoint (network log empty). This is exactly the
  PREPIO-27 contract — a guest action spends no provider budget.
- **Honest, specific sample copy.** *"A fictional example of a prep plan. These are practice prompts, not
  verified questions from a particular employer. No live research runs when you open this sample."* — no
  overclaiming, matches the copy standard.
- **Invite-only auth copy is calm and actionable.** *"Prepio is free and invite-only. Sign in with your
  invited account. Ask the person who invited you if you need access."*
- **Logged-out accessibility is clean.** Single `<h1>`; tab order skip-link → brand → Sign in → View
  sample plan; "Sign in" and "View sample plan" carry `outline: solid 2px` + a box-shadow focus ring;
  the sample button is a proper disclosure (`aria-expanded` false→true, `aria-controls="guest-sample"`,
  operable by Enter); no horizontal overflow at 390px collapsed **or** expanded (390/390 both).
- **`autocomplete` hints shipped on all auth inputs** (#360): sign-in `email` / `current-password`
  (verified), and per the diff the reset/new-password forms too. Closes the P2 that had repeated for 15
  audits.
- **Protected-route redirect preserves intent.** Logged-out `/practice` → `/auth` with *"Continue to
  Practice."*

### Code-confirmed freeze copy fixes (#360), not live-re-probable this run

- **History empty state** now reads *"No finished sessions yet / Finished practice sessions appear here
  with answers, timing, and notes. Answers you save in an unfinished session stay on that interview in
  Your interviews."* (`src/pages/History.tsx:316`) — directly addresses run #20's P3 #4 (empty state vs
  in-progress work). Needs a live authenticated re-check once backend egress is available.
- **Practice hint** no longer advertises voice while frozen — `HintBanner` shows "Record for a full
  answer" only under `FROZEN_PRODUCT.voice` (false), else "Type your answer or quick bullets".
- **Offline research alert** no longer promises local resume parsing (gated on `FROZEN_PRODUCT.resumeUpload`,
  false — `src/pages/Home.tsx:1312`).
- **Frozen flags are consistently wired** across billing, voice, profile, resume upload, and answer
  feedback (`src/lib/frozenProduct.ts` consumed in `searchService`, `billing`, `Practice`, `History`,
  `Home`, `HintBanner`, `SessionList`, `SessionSummary`).

## Journey scorecard

Frontend-live + code pass. Big movers this run are the top-of-funnel rows the freeze lock fixed. Rows
tagged **(live)** were exercised this run; **(code)** rows are from current `main` + carried, not
re-run live (backend egress-blocked).

| Area | 2026-09-03 | 2026-10-08 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | **4** | ▲ | **(live)** Guest path no longer self-destructs; honest invite-only framing + a clean static sample. Held below 5 by the sparse, collapsed-by-default landing (P2 #3). |
| Research entry | 4 | 4 | = | **(code)** Form unchanged in substance; CV-paste retained, upload frozen. Not re-run live. |
| Research progress/loading | 5 | 5 | = | **(carried)** Async modal unchanged; not re-triggered. |
| Generated output clarity | 5 | 5 | = | **(carried)** Plan/stage/question + guidance structure unchanged. |
| Practice mode | 4 | 4 | = | **(code)** Question-as-`<h1>`, text save, voice-copy fix holding in code; **Favorite/Needs-work still deploy-gated-broken** (P1 #1) holds it at 4. Not re-run live. |
| Mobile usability | 4 | 4 | = | **(live, landing/auth)** No overflow at 390px collapsed/expanded; landing nav targets still <44px (P3 #4). Practice-mobile not re-measured live. |
| Resume/profile trust | 4 | **4** | = | **(live)** `/profile` now 404 (frozen) — removes the PII-risk surface; CV paste remains the only ground-truth ask. |
| Dashboard/history/resume | 3 | **4** | ▲ | **(code)** History empty-state copy now explains finished-vs-unfinished and points to Your interviews (#360), addressing run #20's P3 #4. Pending live re-check. |
| Error/empty states | 4 | **4** | = | **(live+code)** Guest path no longer blanks; honest 404s; history/voice/offline copy honest. Held at 4 by the bare 404 polish (P3 #5). |
| Accessibility | 4 | **5** | ▲ | **(live)** Autocomplete now present (15-audit repeat closed), focus rings visible, proper disclosure ARIA, clean tab order, no overflow. Remaining: sub-44px landing nav (P3 #4, ergonomic not WCAG-AA). |
| Copy quality | 4 | **5** | ▲ | **(live+code)** Invite-only, sample, voice, offline, and history copy all honest and specific; the "promises unavailable features" debt the freeze had to clear is cleared. |

**Composite: up materially (First-time +1, Dashboard/history +1, Accessibility +1, Copy +1).** The one
drag remaining on user-visible scores is the deploy-gated Favorite/Needs-work write (P1 #1); everything
else that moved, moved up.

## Regression check

Freeze-lock commits merged since the last review; **net strongly positive, zero user-facing regressions
found on the live frontend.**

| Item | State | Note |
|------|-------|------|
| Guest preview (was P0 #1) | **Fixed** ✅ | Static sample, **0 network calls** (live). (#354 / PREPIO-27) |
| `/pricing` checkout CTAs (was P0 #1) | **Fixed** ✅ | Route removed → 404 (live). |
| Public Sign-Up tab (was P0 #1) | **Frontend fixed** ✅ / backend gate pending ⚠️ | No Sign-Up tab (live). Production Auth rejecting non-invited signup is a backend check (FREEZE_RELEASE.md) not verifiable this run (egress-blocked); rides PREPIO-124. |
| `/auth` autocomplete (was P2 #3, 15-audit repeat) | **Fixed** ✅ | `email` / `current-password` (live). (#360 / PREPIO-123) |
| `/profile` CV PII-risk surface | **Removed** ✅ | 404 under the freeze (live). |
| History empty-state vs in-progress (was P3 #4) | **Fixed in code** ✅ | New finished-vs-unfinished copy (#360). Pending live re-check. |
| Practice voice/offline copy promises | **Fixed in code** ✅ | Gated on frozen flags (#360). |
| Landing single `<h1>` / heading order | **Holding** ✅ | Single `<h1>` (live). |
| Protected-route redirect context | **Holding** ✅ | "Continue to Practice." (live). |
| Favorite/Needs-work flag write | **Still deploy-gated-broken** ❌ | `42P10`; migration written + authorized, still `Todo` (PREPIO-170). Not live-re-probable this run. (P1 #1) |
| Sub-44px landing/auth nav targets | **Still open** ⚠️ | 71×36 (live). (P3 #4) |

**New since last review:** the sparse collapsed-by-default guest landing (P2 #3) — introduced by the
freeze rework; a UX trade-off worth a small follow-up, not a defect.

## Recommended tickets

Nearly every finding maps to an existing open issue; **one new issue is proposed** for the new
landing finding.

1. **[P1] Apply `20260710203000_question_flags_per_type.sql` to production** so Favorite/Needs-work stops
   returning `42P10`. → **[PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170)** (Urgent, Todo).
2. **[P1] Complete the attended backend reconcile + freeze deploy** (five core functions + pending
   migrations via `freeze-functions.json`; record evidence gates). →
   **[PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124)** (Urgent, Todo). Frontend portion of
   **[PREPIO-27](https://linear.app/qiuyue/issue/PREPIO-27)** is now live-verified.
3. **[P2] NEW — Default the guest sample to visible on the frozen landing** (or inline the three prompts
   under the hero; optionally a one-line Research→Plan→Practice strip). Restores immediate time-to-value;
   not covered by PREPIO-27. → **propose in the Landing Page Framing project** (Improvement, `area:landing`).
4. **[P3] Close PREPIO-123** — `/auth` autocomplete is live-fixed. →
   **[PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123)** (recommend Done).
5. **[P3] Bump landing/auth nav touch targets to ≥44px** and (optional) redirect the removed
   `/pricing` / `/profile` routes instead of a bare 404. Below the >30-min threshold individually; fold
   into the next landing/`Navigation` pass (PREPIO-27 copy/landing follow-up).

### Deferred items (per CLAUDE.md hygiene convention)

- **One new issue proposed** this run (landing time-to-value, P2 #3) — filed into the Landing Page
  Framing project, cross-linked to this report.
- The sub-44px nav targets (P3 #4) and the 404-vs-redirect polish (P3 #5) remain below the >30-min
  ticketing threshold; flagged into the next landing/`Navigation` pass.
- Live-confirmation comments added this run to PREPIO-27 (frontend lock deployed + verified) and the
  recommendation to close PREPIO-123.

---

Capability: live browser verified (frontend / logged-out); backend egress-blocked — authenticated
flows reviewed from code + repo baseline, not live, this run.
