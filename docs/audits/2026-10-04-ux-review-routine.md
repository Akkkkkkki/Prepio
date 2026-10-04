# Prepio UI/UX Review — 2026-10-04 (recurring routine, run #21)

Twenty-first run of the recurring weekly UX-review routine. Immediate baseline:
[`2026-09-03`](./2026-09-03-ux-review-routine.md) (run #20). Earlier baselines:
[`2026-08-27`](./2026-08-27-ux-review-routine.md),
[`2026-08-30`](./2026-08-30-ux-review-routine.md).

## Capability check — PARTIAL LIVE (frontend reachable; backend NOT reachable; styling NOT capturable)

Read the scope of this run narrowly. Three layers, three different outcomes:

- **Frontend DOM / network / behaviour: LIVE-VERIFIED.** Chromium (pre-installed
  `/opt/pw-browsers/chromium-1194`) loaded `https://prepio.qiuyue.dev` through the agent
  proxy (`--proxy-server=$HTTPS_PROXY`), HTTP 200, title *"Prepio - Interview Prep Tool"*.
  Every DOM-level, text-level, routing-level and network-request-level finding below was
  observed live this run.
- **Backend (Supabase): NOT reachable this run.** The egress gateway refuses `CONNECT` to
  the project host `vjwrirrqprjzdorignlz.supabase.co:443` with a **502** (`connect_rejected`,
  "policy denial or upstream failure"), reproduced on `curl` and in-browser
  (`net::ERR_TUNNEL_CONNECTION_FAILED` on the auth fetch). **Login could not complete**, so
  the authenticated loop (`/interviews`, practice save, the Favorite/Needs-work flag write,
  `/history` with data) was **not** exercised live. This is an environment egress limit, not
  a production fault — real users reach Supabase normally. (Run #20 reached it; this run's
  session cannot.)
- **Visual styling / screenshots: NOT capturable this run.** Through a plain
  `--proxy-server` launch the proxy hands Chromium the stylesheet with MIME `text/plain`, so
  Chromium refuses to apply it (*"Refused to apply style … not a supported stylesheet MIME
  type"*) and every page renders unstyled. **This is a capture artifact, not a production
  bug:** `curl` of the exact asset through the same proxy returns
  `Content-Type: text/css` / HTTP 200 / 83 KB, so production serves correct CSS to real
  users. The documented workaround (a local MITM TLS shim, carried in run #20's notes) was
  **blocked by this session's sandbox policy** (flagged as a containment-escape pattern), and
  was not routed around. **No screenshots are committed this run** — unstyled captures would
  misrepresent the live layout, and the routine's PII rule plus the no-misleading-evidence
  rule both argue against committing them. Evidence below is DOM/text/network, quoted inline.

Consequence: visual-layout, touch-target, focus-ring, and mobile-reflow claims are **not**
re-verified this run and are carried from run #20 (code unchanged where noted). Authenticated
findings are grounded in **code + the release-truth doc + Linear**, not re-exercised live.

## The headline: the frozen frontend surface-lock is now LIVE — run #20's standing P0 is resolved

Run #20's top finding was a **P0**: the frontend still exposed the pre-freeze guest/billing
surface (guest *"Preview my prep"* fired a doomed `research-preview` call and **blanked** the
page's best asset; `/pricing` showed live checkout CTAs at an undeployed function; public
Sign Up was still open). Since then **PR #354 ("lock Prepio to the invite-only frozen core")
and PR #360 ("close freeze gaps found by the final audit and UX reviews")** landed and are
**deployed to production**. Verified live this run, at the DOM/network level:

| Run #20 P0 symptom | State now (live 2026-10-04) | Evidence |
|---|---|---|
| Guest CTA fires `research-preview`, fails CORS, blanks the example | **Resolved** — landing is a static `GuestSample`; **zero** Supabase/Edge-Function requests on load or on opening the sample | `supabaseCalls: []` on `/` and after *View sample plan* |
| No company preview form | **Resolved** — no company/role input on the guest landing | `input[company]` count `0` |
| `/pricing` shows live checkout CTAs | **Resolved** — `/pricing` → **404** ("Oops! Page not found") | live nav |
| `/profile` reachable | **Resolved** — `/profile` → **404** | live nav |
| Public Sign Up tab open | **Frontend entry point removed** — `/auth` has **no Sign Up tab/button**; copy *"Prepio is free and invite-only … Ask the person who invited you"*. **Not fully "invite-only" until verified at the backend** — see the caveat below | tab+button count `0` (DOM) |
| `/auth` inputs have no `autocomplete` (15-audit-old P2) | **Fixed** — `#signin-email` = `email`, `#signin-password` = `current-password`, each `<label>`-associated | measured live; PREPIO-123 **Done** (#360) |

This is the single most important change in this review's history: the top-of-funnel is no
longer *actively worse than doing nothing*. The guest surface is now deterministic, honest,
and self-contained, and makes no paid-provider call — exactly what PREPIO-27 specified.

**But the split is now frontend-only, and "invite-only" is only verified at the frontend.**
The backend half of the freeze is still open: `FREEZE_RELEASE.md` records status
**"candidate; not a verified production freeze"**, its **2026-09-21 read-only baseline** shows
the five core functions at pre-fix versions and `user_question_flags` still keyed
`UNIQUE(user_id, question_id)` (the 2-column key), and **PREPIO-124** (reconcile + deploy) and
**PREPIO-170** (apply the flag migration) are both **Todo/Urgent**. Two caveats, both from the
same frontend/backend split, apply to the table above:

- **Invite-only is not backend-verified this run.** Removing the Sign Up tab proves only the
  frontend entry point is gone. `FREEZE_RELEASE.md` §2 (lines 63–66) requires the production
  Supabase Auth *"Allow new users to sign up"* / anonymous-sign-in settings to be turned off
  **and** verified by a direct non-invited signup API request failing — committing
  `supabase/config.toml` does not apply production Auth settings. Because Supabase was
  unreachable this run, that gate stays **unverified**: public API signup may still be enabled
  even though the UI tab is absent (issue #5).
- **The flag-write failure is a last-verified state, not a fresh probe.** The `42P10` evidence
  is the 2026-09-21/22 baseline plus PREPIO-170 still being Todo and the release being an
  unverified candidate; this run could not re-probe. So the write was **last verified failing**
  and there is no evidence of an intervening deploy — but "currently failing" is an inference,
  not a this-run observation (issue #1).

## Overall product judgment

The product is meaningfully better this week, and the improvement is structural rather than
cosmetic: the frozen frontend surface-lock shipped, so a first-time (or invited) visitor no
longer hits a CTA that fails and erases the page's best content, no longer sees purchase
buttons that cannot complete, and no longer sees a public Sign Up entry point that contradicts
the invite-only model — and the long-standing `/auth` autocomplete gap and the `/history`
empty-state copy are both finally fixed. The cost of that lock is a quieter top-of-funnel: the
guest landing now shows **no example output until you click *View sample plan***, and the
sample it then reveals is deliberately generic and fictional ("Payments company · Product
Manager"), so the page *claims* company-and-role specificity in prose but no longer *shows* it
by default — a mild first-time-understanding regression introduced by the lock. The
highest-value remaining user-facing defect is unchanged and now purely a backend-deploy step:
the **Favorite / Needs-work flag write was last verified failing with `42P10` in production**
(2026-09-21/22 baseline; not re-probed this run) because PREPIO-170's one-line migration was
unapplied. The biggest *process* risk is the frontend/backend split — the locked UI makes the
app look fully reconciled, while (per the last read-only baseline) the functions are still the
pre-fix 2026-05-15 versions (PREPIO-124) and even "invite-only" is unverified at the Auth
layer (issue #5).

## Top 5 issues

### 1. **P1 (carried; last verified failing 2026-09-21/22, not re-probed this run) — Favorite / Needs-work flag write — last-known production state is `400 / 42P10`**

- **Severity:** P1 — when last verified, a core practice-triage control failed 100% of the
  time in production; no evidence of an intervening fix.
- **Area:** practice
- **User scenario:** during practice a user taps **Favorite** / **Needs work** (or swipes) to
  mark what to revisit.
- **What happened:** not exercised live this run (Supabase unreachable), so this is the
  **last-verified** state, not a fresh probe. `FREEZE_RELEASE.md`'s 2026-09-21 baseline and
  PREPIO-170's own 2026-09-22 evidence both record `user_question_flags` still has
  `UNIQUE(user_id, question_id)` — **not** the three-column key. The upsert
  (`src/services/searchService.ts:1762`) uses `onConflict: 'user_id,question_id,flag_type'`, so
  against that schema it returns `42P10`. PREPIO-170 remains **Todo** and the release is still
  an unverified candidate, so there is no evidence an attended/manual deploy has applied the
  migration since — but confirm with a fresh schema/write probe before calling it current.
  Last live-confirmed failing on 2026-09-03 (run #20).
- **Why it matters:** favorites/needs-work is how a time-pressured candidate decides what to
  practise next; a visible control that never persists erodes trust that *anything* saves.
  (Text-answer save, by contrast, returned `201` live in run #20.)
- **Recommended fix:** apply `20260710203000_question_flags_per_type.sql` in the PREPIO-124
  attended window (re-run the duplicate-group precheck first), then verify all three entry
  points persist across a reload on desktop and mobile. Code is already correct; this is a
  schema deploy only.
- **Tracking:** [PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170) (Urgent, **Todo**),
  sequenced inside [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124) (Urgent, **Todo**).

### 2. **P2 (NEW, live-confirmed) — The guest landing shows no example output by default, and the sample it hides is generic/fictional — first-time understanding regressed as a side effect of the surface-lock**

- **Severity:** P2 — weakens the "show, don't claim, personalization" and "visible example of
  the output" first-time-understanding criteria. Calibrated down by the invite-only context
  (most real arrivals are already invited and simply sign in), but it is the clearest
  user-facing *regression* this week.
- **Area:** landing
- **User scenario:** a first-time (or newly invited) visitor lands on `/` logged out and
  tries to understand what Prepio produces before signing in.
- **What happened (live):** the landing hero reads *"Prepare for your next interview"* with
  body *"Research a company and role, review your plan, practice in writing, and save your
  answers. Favorite questions or mark them as Needs-work, then return to your History."* and a
  badge *"Free · Invite-only"* — but the **only** way to see any example output is to click
  **View sample plan** (`useState(false)` by default; the sample is absent from the DOM until
  toggled). The revealed sample is a fictional *"Payments company · Product Manager"* with
  three prompts and a focus line each, correctly disclaimed (*"A fictional example … not
  verified questions from a particular employer. No live research runs…"*). It no longer
  carries the named-company concreteness, difficulty badges, or per-question *"why it
  matters"* rationale that run #20 praised in the (when-working) pre-freeze example.
- **Why it matters:** run #20 explicitly recommended making the example the **default rendered
  state**; the freeze lock did the opposite (collapsed + genericised). The page now *tells*
  the company/role-specific story in prose but *shows* nothing of it on first paint, which is
  exactly the gap the routine's product principles call out ("time-to-value", "show
  personalization").
- **Recommended fix (freeze-compatible — no backend, stays fictional):** render a trimmed
  version of the fictional sample **inline by default** (keep the full disclaimer), and
  restore the light structure the old example had — a stage label and a one-line *"why this is
  asked"* per prompt — so an invited visitor sees the shape of a plan without a click. Keep
  the toggle for the full sample.
- **Tracking:** fold into [PREPIO-27](https://linear.app/qiuyue/issue/PREPIO-27) (In
  Progress) — it owns the static guest sample; a comment is added there rather than a new
  issue, to avoid fragmenting the surface work.

### 3. **P2 (carried) — No CV privacy/trust copy on the `/new-interview` paste area**

- **Severity:** P2 — the freeze keeps *pasted* CV text as the personalization input, but the
  surface that collects it still doesn't say why the CV improves the output or how it's used.
- **Area:** research / profile-trust
- **User scenario:** an invited user pastes their CV to tailor questions.
- **What happened:** not re-verified live this run (protected route; login unavailable). Known
  gap; `src/pages/Home.tsx` renders the paste area without the privacy line the routine's copy
  standard calls for (*"Your CV is used to personalize this prep plan."*).
- **Why it matters:** "any surface that collects ground truth must earn the ask" (CLAUDE.md
  user-effort budget). Pasting a CV is the single highest-trust ask in the frozen product.
- **Recommended fix:** add one calm privacy line adjacent to the paste field (per PREPIO-180).
- **Tracking:** [PREPIO-180](https://linear.app/qiuyue/issue/PREPIO-180) (Medium, **In
  Progress**).

### 4. **P3 (NEW, live-confirmed) — `/auth` stacks three near-duplicate sign-in prompts**

- **Severity:** P3 — copy redundancy; no functional impact.
- **Area:** auth / copy
- **What happened (live):** the sign-in view renders, top to bottom: a page subhead *"Sign in
  to access your interview research, practice history, and saved prep."*, then the card title
  *"Welcome"* + description *"Sign in with your invited account to continue."*, then a body
  line *"Prepio is free and invite-only. Sign in with your invited account. Ask the person who
  invited you if you need access."* — three overlapping "sign in with your invited account"
  statements in one viewport.
- **Why it matters:** minor, but it reads as unpolished and buries the one genuinely useful
  sentence (the invite-only explanation) under two restatements.
- **Recommended fix:** keep the invite-only explanation once (it's the informative one), drop
  the redundant card description and/or page subhead. Below the >30-min ticket threshold; fold
  into the PREPIO-27 auth-surface pass.

### 5. **P2 (NEW, code-confirmed) — Invite-only is enforced only at the frontend; the production Auth signup setting is unverified**

- **Severity:** P2 — a security/correctness gate for the whole freeze premise. Not a UX bug a
  user sees, but it is the difference between "looks invite-only" and "is invite-only".
- **Area:** auth
- **What happened:** the Sign Up tab is gone from `/auth` (verified live), but
  `FREEZE_RELEASE.md` §2 (lines 63–66) states the production Supabase Auth *"Allow new users to
  sign up"* and *"Allow anonymous sign-ins"* settings must be turned **off** and verified by a
  **direct non-invited signup API request failing** — committing `supabase/config.toml` does
  not apply production Auth settings. Supabase was unreachable this run, so this gate could not
  be probed and remains **unverified**: the public signup API may still accept new users even
  though the UI entry point is absent.
- **Why it matters:** if the API still allows signup, the invite-only model is cosmetic — anyone
  who hits `POST /auth/v1/signup` directly bypasses the whole freeze premise.
- **Recommended fix:** in the PREPIO-124 / PREPIO-27 attended window, disable both Auth
  settings in the production project and verify a direct non-invited signup request is denied
  (and an anonymous sign-in is rejected), then record the evidence.
- **Tracking:** [PREPIO-27](https://linear.app/qiuyue/issue/PREPIO-27) (In Progress; §2 of the
  freeze gate) + [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124).

> **Resolved since run #20 — dropped from the top-5:** the `/history` empty-state parity
> concern (run #20 P3 #4) is **fixed in code** (`bccb67c` / #360). `src/pages/History.tsx:316`
> now reads *"No finished sessions yet"* with body *"Finished practice sessions appear here with
> answers, timing, and notes. Answers you save in an unfinished session stay on that interview
> in Your interviews."* — exactly the clarification run #20 recommended. Not re-rendered live
> this run (Supabase unreachable), but the copy is merged on the deployed head. See the
> regression table and scorecard.

## Notable observations (not top-5)

### Live-verified positives (the frozen frontend is in good shape)

- **Guest action makes zero backend calls.** `/` and *View sample plan* fire no
  Supabase/Edge-Function request (`supabaseCalls: []`) — PREPIO-27's core acceptance criterion
  met live.
- **Removed surfaces fail honestly.** `/pricing` and `/profile` both return a clean **404**
  ("Oops! Page not found / Return to Home"), not a broken half-page.
- **Protected-route redirect preserves intent.** Logged-out `/practice` → `/auth` with the
  banner *"Continue to Practice."* (live).
- **Frozen feature flags are thoroughly wired** (`src/lib/frozenProduct.ts`): `billing`,
  `answerFeedback`, `voice`, `profile`, `resumeUpload` all `false`, and the gates are enforced
  in `searchService.ts`, `billing.ts`, `HintBanner.tsx`, `SessionSummary.tsx`,
  `SessionList.tsx`, and `Home.tsx` — not just hidden in the UI (`billing.ts` throws *"Prepio
  is free and invite-only."*). This is a release-boundary constant, "deliberately not
  overridable by a browser or environment flag."
- **Practice question is still an `<h1>`** across render branches (`Practice.tsx` lines 2127 /
  2807 / 3174) — PREPIO-178 holding in code (live re-verification blocked this run).

### Context, not a user-facing issue

- **Backend reconciliation gap (PREPIO-124, Todo).** Production functions are the pre-fix
  2026-05-15 versions per the release doc's 2026-09-21 baseline. Not directly user-visible
  beyond the flag bug (#1), but it is the standing release blocker and the reason the freeze is
  still a *candidate*. The locked frontend makes the app *look* reconciled; it is not.
- **Sub-44px landing/auth touch targets (carried a11y, P3).** Could not be re-measured this
  run (no styling captured). Carried from run #20; fold into the PREPIO-27 surface pass.

## Journey scorecard

No authenticated or visual re-verification this run; rows are marked **(live)** where observed
at DOM/network level today, **(carried)** where held from run #20 with code unchanged. The
frontend surface-lock is the only mover, and it lifts first-impression robustness without
moving most numbers, because the remaining gaps (flag write, no-example-by-default, backend
reconcile) persist.

| Area | 2026-09-03 | 2026-10-04 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | 3 | = | **(live)** The CTA-blanking failure is **gone** (big +), so the surface is now stable, not fragile — but the example is hidden by default and genericised (−), netting flat. Would be 4 with the sample shown inline by default (issue #2). |
| Research entry | 4 | 4 | = | **(carried)** CV-aware form unchanged; privacy copy still pending (issue #3, PREPIO-180). |
| Research progress/loading | 5 | 5 | = | **(carried)** Async modal unchanged in code; not re-triggered. |
| Generated output clarity | 5 | 5 | = | **(carried)** Plan/stage/question + answer-guide structure unchanged. |
| Practice mode | 4 | 4 | = | **(carried)** Question is `<h1>`, save persisted `201` in run #20 — but Favorite/Needs-work was last verified failing `42P10` in prod (issue #1) holds it at 4. |
| Mobile usability | 4 | 4 | = | **(carried)** Practice-mobile strong at run #20; not re-measured (no styling captured). |
| Resume/profile trust | 4 | 4 | = | **(live, partial)** `/profile` now 404 (frozen) — correct for the freeze; CV paste privacy copy still pending (PREPIO-180). |
| Dashboard/history/resume | 3 | **4** | **▲** | **(code-confirmed)** `/history` empty-state now honest — *"No finished sessions yet … Answers you save in an unfinished session stay on that interview in Your interviews"* (`bccb67c`/#360), implementing run #20's recommendation. Not re-rendered live (Supabase down). |
| Error/empty states | 4 | 4 | = | **(live)** Guest surface no longer blanks; removed routes 404 honestly; redirect preserves intent; `/history` empty-state now honest. Held at 4 only because the flag-write failure (#1) remains an unresolved "saved"-vs-actually-failed gap per the last probe. |
| Accessibility | 4 | 4 | = | **(live, partial)** `/auth` autocomplete now `email`/`current-password` with labels (PREPIO-123 **Done**) — the 15-audit gap is closed. Focus/targets not re-measured this run. |
| Copy quality | 4 | 4 | = | **(live)** Guest + auth copy honest and invite-aware; minor `/auth` triple-prompt redundancy (issue #4). |

**Composite: up one (Dashboard/history 3→4), and up in robustness elsewhere.** The top-of-funnel
moved from *fragile/actively-broken* to *stable/honest*, a 15-audit-old a11y gap (autocomplete)
closed, and the `/history` empty-state copy was fixed. The anchors that keep the other numbers
from rising are the two backend-deploy items (PREPIO-124 + PREPIO-170) plus the
no-example-by-default framing regression (issue #2), not frontend correctness.

## Regression check

PRs merged to `main` since run #20 are improvements or neutral; **no code regressions**. One
UX *framing* regression (issue #2) is a deliberate side effect of the freeze lock, not a bug.

| Item | State | Note |
|------|-------|------|
| Guest preview blanking / CORS failure | **Resolved** ✅ | Static `GuestSample`, zero backend calls (#354/#360 / PREPIO-27). Was run #20 P0. |
| `/pricing` checkout CTAs, `/profile` | **Resolved** ✅ | Both 404; billing/profile frozen off. Was run #20 P0. |
| Public Sign Up tab (frontend) | **Resolved (frontend)** ✅ | `/auth` has no Sign Up tab. Backend Auth setting still **unverified** (issue #5). Was run #20 P0. |
| `/auth` autocomplete (15 audits) | **Fixed** ✅ | `email` / `current-password` + labels (PREPIO-123 Done, #360). Was run #20 P2. |
| `/history` empty-state parity | **Fixed** ✅ | Now *"No finished sessions yet … stay on that interview in Your interviews"* (`bccb67c`/#360). Was run #20 P3 #4. |
| Practice question `<h1>` | **Holding** ✅ | Code unchanged (`Practice.tsx`); not re-verified live. |
| Favorite/Needs-work flag write | **Still failing (last probe)** ❌ | `42P10` at 2026-09-21/22; migration unapplied (PREPIO-170 Todo); not re-probed this run. Was run #20 P1. (Issue #1) |
| Guest landing example visibility | **Regressed (framing)** ⚠️ | Example now collapsed-by-default + genericised by the freeze lock. (Issue #2) |

## Recommended tickets

No new Linear issues filed — every finding maps to an existing issue or folds into the surface
owner, consistent with the freeze posture (CLAUDE.md: "Do not add features, recurring audits").

1. **[P1] Apply the flag migration** so Favorite/Needs-work stops returning `42P10`. →
   [PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170) (Urgent, Todo), inside
   [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124) (Urgent, Todo).
2. **[P1] Attended backend reconcile + freeze deploy** (five core functions + reviewed
   migrations via the guarded manifest). → [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124).
3. **[P2] Disable the production Auth signup/anonymous settings and verify a direct non-invited
   signup API request is denied** (issue #5 — invite-only is unverified at the backend). → §2 of
   [PREPIO-27](https://linear.app/qiuyue/issue/PREPIO-27) + [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124).
4. **[P2] Show the fictional sample inline by default + restore stage / "why it matters"
   structure** on the guest landing. → comment on
   [PREPIO-27](https://linear.app/qiuyue/issue/PREPIO-27) (In Progress; owns the guest sample).
5. **[P2] Add CV privacy/trust copy to the `/new-interview` paste area.** →
   [PREPIO-180](https://linear.app/qiuyue/issue/PREPIO-180) (In Progress).
6. **[P3] De-duplicate the `/auth` sign-in prompts** (keep the invite-only line once). → fold
   into the PREPIO-27 auth-surface pass; below the >30-min ticket threshold.

### Deferred items (per CLAUDE.md hygiene convention)

- **No new Linear issues filed this run.** All findings map to existing open issues
  (PREPIO-170, -124, -27, -180) or are below the >30-min threshold (issue #4, the `/auth`
  prompt de-duplication, and the carried sub-44px touch-target note). Live-verification / refinement comments added to PREPIO-27 and
  PREPIO-170 this run.
- [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123) (`/auth` autocomplete) is **Done**
  and **live-confirmed fixed**; the `/history` empty-state parity concern (run #20 P3 #4) is
  **fixed in code** (`bccb67c`/#360) — both removed from the standing carry list.

---

Capability: partial live — frontend DOM/network/behaviour verified; backend (Supabase)
unreachable from this environment; visual styling not captured (proxy strips CSS MIME; MITM
workaround blocked by sandbox policy). Production CSS confirmed served correctly to real users.
