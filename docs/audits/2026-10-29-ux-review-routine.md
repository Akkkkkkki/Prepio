# Prepio UI/UX Review — 2026-10-29 (recurring routine, run #21)

Twenty-first run of the recurring weekly UX-review routine, and the **first since
[`2026-09-03`](./2026-09-03-ux-review-routine.md) (run #20)** — an ~8-week gap while the
freeze work landed. Prior baselines:
[`2026-08-20`](./2026-08-20-ux-review-routine.md),
[`2026-08-23`](./2026-08-23-ux-review-routine.md),
[`2026-08-27`](./2026-08-27-ux-review-routine.md),
[`2026-08-30`](./2026-08-30-ux-review-routine.md),
[`2026-09-03`](./2026-09-03-ux-review-routine.md).

## Capability check — FULL LIVE (frontend + backend both reachable)

Both capability gates pass; this is a **full-live** review of the authenticated
research→practice loop.

- **Playwright Chromium: PASS.** Launched the pre-installed Chromium via
  `executablePath: '/opt/pw-browsers/chromium'` (the npm `playwright` pins build 1228, which
  is absent; the symlink resolves to the installed 1243). **No MITM shim was needed this run** —
  a plain `--no-sandbox --headless=new` launch loaded every HTTPS origin cleanly (the
  `ERR_CONNECTION_RESET` ClientHello reset that forced last run's local TLS shim did not
  reproduce; the agent HTTPS proxy is picked up transparently). Carry this forward: try the
  plain launch first.
- **Frontend (Vercel): PASS** — `curl https://prepio.qiuyue.dev/` → `200`; Chromium load → `200`,
  title `Prepio - Interview Prep Tool`.
- **Backend (Supabase): PASS** — tester login succeeded (`POST auth/v1/token` → `200`,
  Enter/click-submit → redirect to `/interviews`). A **text-answer save persisted live**
  (`POST practice_answers` → `201`, session counter advanced "0 answered" → "1 answered").
  The **Favorite / Needs-work flag write still fails live** (`POST user_question_flags` →
  `400 / 42P10`) — the same failure as run #20, re-confirmed today with a captured red error
  toast and console trace.

**What IS live-verified this run:** logged-out landing (desktop 1440×900 + mobile 390×844),
the guest **View sample plan** static expansion (network-instrumented: **zero** Edge Function /
provider / REST calls), `/auth` (autocomplete + keyboard focus order), login, protected-route
redirect context, `/interviews`, practice mode desktop + mobile (**question-as-`<h1>` on both**),
**text-answer save (`201`)**, **flag write (`400/42P10`)**, notes autosave, `/dashboard`
(→`/interviews`), `/history`, the old monetization/profile routes (`/pricing`, `/billing`,
`/profile`, `/settings` → **all 404**), and a keyboard-focus + touch-target pass. Screenshots
under [`assets/2026-10-29/`](./assets/2026-10-29/). **No `/profile` or CV surface was captured** —
`/profile` is now a 404 under the freeze, and no CV-derived field was rendered or screenshotted
(PII rule in [`UX_REVIEW_ROUTINE.md`](./UX_REVIEW_ROUTINE.md)).

## The headline this week: the freeze surface-lock shipped — and it is good

The 4-month "why is half the app dark" tension is **resolved in the product**, not just on paper:

- **PREPIO-27 (freeze surface lock) is Done** (Linear, completed 2026-10-14; code `#354`
  "lock Prepio to the invite-only frozen core", `#360` "close freeze gaps"). Live-verified today:
  - The guest **View sample plan** CTA now expands a **deterministic static sample inline with
    zero backend calls** (network-instrumented). Last review's **P0** — the guest CTA fired a
    doomed `research-preview` call, CORS-failed, and *blanked* the page's best asset — is **gone**.
  - Old monetization/profile routes (`/pricing`, `/billing`, `/profile`, `/settings`) now all
    return a clean **404**. No live checkout CTA remains.
  - `/auth` is **invite-only** — the public Sign-Up tab is removed; copy reads "Prepio is free and
    invite-only. Sign in with your invited account. Ask the person who invited you if you need access."
- **PREPIO-123 (auth autocomplete) is Done** (completed 2026-10-01). Live-verified: `#signin-email`
  now carries `autocomplete="email"`, `#signin-password` carries `current-password`. The
  15-audit repeat finding is **closed**.
- The **`/history` empty-state** that read as a bug last review (run #20 P3 #4) is **rewritten and
  honest**: "Review how each round went … No finished sessions yet. Finished practice sessions
  appear here with answers, timing, and notes. **Answers you save in an unfinished session stay on
  that interview in Your interviews.**" This is exactly last review's recommended fix, shipped.

**What is still broken is now singular and sharp:** the **Favorite / Needs-work flag write**
(`400 / 42P10`). The fixing migration (`supabase/migrations/20260710203000_question_flags_per_type.sql`,
adds the `(user_id, question_id, flag_type)` unique key the upsert at `src/services/searchService.ts:1765`
targets) is **present in the repo and unapplied in production**. It is tracked by
**[PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170)** (Urgent, Todo) and ships inside the
**[PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124)** attended deploy (Urgent, In Progress).
Eight weeks on, it is the one clearly-broken control a logged-in user touches.

## Overall product judgment

The product experience is **meaningfully better than run #20** and is, for the first time in this
review's history, honest end-to-end about its own scope. The freeze surface-lock removed the entire
pre-signup breakage (guest CORS blanking, dead checkout CTAs, open public signup) and replaced it
with a calm, truthful invite-only landing + a static sample the user can inspect in one click with
no network dependency. The authenticated core is strong: the practice question is the unambiguous
`<h1>` hero on desktop and mobile, questions are visibly role/company-specific ("…managing data
products at **Stripe**?"), text-answer save persists (`201`), every mobile practice control is ≥44px
with no horizontal overflow, keyboard focus rings are visible, and protected-route redirects
preserve intent. **The single highest-priority user-facing defect is unchanged and overdue:** the
Favorite / Needs-work flag write fails 100% of the time with a red error toast, blocked only on the
PREPIO-124 deploy applying an already-written migration. A secondary, softer cost arrived *with* the
freeze lock: the new landing's default view is nearly empty — its strongest proof (the sample plan)
now sits behind a click, the hero copy got blander ("Prepare for your next interview"), and the copy
"Explore a fixed example below" is literally inaccurate until you click. That is a first-impression
regression worth a small polish pass, not a structural problem.

## Top 5 issues

### 1. P1 (live-confirmed, 8 weeks open) — Favorite / Needs-work flag write returns `400 / 42P10`; the fixing migration is written, authorized, and still unapplied

- **Severity:** P1 — a core practice-triage control fails 100% of the time, with a red error toast,
  in the frozen authenticated core.
- **Area:** practice
- **User scenario:** during practice a user taps **Favorite** (or **Needs work**) to mark what to
  revisit.
- **What happened (live, desktop + mobile `/practice`):** the control responds optimistically, then
  `POST user_question_flags?on_conflict=user_id,question_id,flag_type` returns **`400`** with body
  `{"code":"42P10","message":"there is no unique or exclusion constraint matching the ON CONFLICT
  specification"}`, console logs *"Error setting question flag … 42P10"* / *"Failed to set flag"*,
  and a red toast appears: *"Couldn't save your Needs work flag. Try again in a moment."* After a
  reload no flag is pressed — nothing persisted. Both Favorite and Needs-work fail identically.
  Evidence: [`06-d-flag-error-42P10.png`](./assets/2026-10-29/06-d-flag-error-42P10.png).
- **Root cause (confirmed in code this run):** the upsert at `src/services/searchService.ts:1765`
  uses `onConflict: 'user_id,question_id,flag_type'`, but production still carries the old
  two-column `UNIQUE(user_id, question_id)` key. The migration
  `supabase/migrations/20260710203000_question_flags_per_type.sql` drops the two-column key and adds
  the three-column one — it exists in the repo and has simply never been applied. This is a **schema
  deploy, not a code change**, and is **inside** the freeze scope.
- **Why it matters:** Favorite / Needs-work is how a time-pressured user decides what to practice
  next. A visible, promised control that never persists erodes trust in whether *anything* they do
  persists (text-answer save, by contrast, is `201` — verified live).
- **Recommended fix:** apply `20260710203000_question_flags_per_type.sql` in the PREPIO-124 freeze
  window (run the duplicate-group precheck for `(user_id, question_id, flag_type)` first; the freeze
  doc says this returned zero on the last baseline — re-check, do not silently dedupe). Then verify
  all three entry points persist across a reload on desktop and mobile.
- **P3 rider (carried):** the toast's *"Try again in a moment"* implies a transient failure, but
  `42P10` is deterministic — retry will never succeed. Moot once the migration ships; not worth a
  separate copy PR ahead of it.
- **Tracking:** **[PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170)** (Urgent, Todo) inside
  **[PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124)** (Urgent, In Progress). Confirmed live
  2026-10-29.

### 2. P2 (new, introduced by the freeze lock) — the landing hides its strongest pre-signup proof behind a click, and the hero copy weakened

- **Severity:** P2 — first-impression / time-to-value; the default landing view is nearly empty.
- **Area:** landing / copy
- **User scenario:** an invited (or prospective) user opens `https://prepio.qiuyue.dev` logged out
  and spends 30 seconds deciding what Prepio is and whether to sign in.
- **What happened (live, `/`):** the default view is a single card — a "Free · Invite-only" badge,
  the hero **"Prepare for your next interview"**, two sentences of description, and two buttons
  (**Sign in**, **View sample plan**). The rich example that run #20 praised as the page's strongest
  asset ("A first-timer understands the company-and-role-specific value in well under 30s *without*
  signing in") is **no longer visible by default** — it only appears after clicking **View sample
  plan** (which is genuinely good once expanded: 3 well-structured PM stages with honest "fictional
  example / No live research runs" framing). Two concrete copy defects compound it:
  - The body copy says **"Explore a fixed example below."** — but nothing is below until the button
    is clicked; the sentence is inaccurate on first paint.
  - The hero **"Prepare for your next interview"** is generic and no longer signals the
    company/role-specific differentiation the way run #20's *"Walk into your next interview knowing
    exactly what to expect."* did.
  Evidence: [`01-d-landing.png`](./assets/2026-10-29/01-d-landing.png) (default, near-empty),
  [`02-d-guest-sample-plan.png`](./assets/2026-10-29/02-d-guest-sample-plan.png) (expanded, strong).
- **Why it matters:** "Time-to-value is everything" and "research entry/value must stay prominent"
  are named product principles. The freeze lock correctly killed the P0 CORS-blanking failure, but
  the replacement default state shows almost nothing — the proof a user needs is one interaction
  away, and the one line pointing at it is wrong.
- **Recommended fix (small):** render the sample plan **expanded by default** (or a condensed
  2-question teaser inline), and fix the "below" copy to match whatever the real layout is. Optional:
  restore a more specific hero line. This folds into the already-touched landing surface; it is
  polish, not a redesign.
- **Tracking:** does **not** map cleanly to an existing open issue (PREPIO-27 is Done). Written up
  as a recommended ticket below; **held, not filed** (see *Recommended tickets* — freeze posture +
  unattended run). Owner to confirm whether the minimal default is intentional.

### 3. P3 (a11y, mobile) — sub-44px touch targets: the `/interviews` progress info icons (14×14) and the landing "Sign in" nav (71×36)

- **Severity:** P3 — external 44px ergonomic recommendation; WCAG 2.5.8 AA (24px) passes.
- **Area:** accessibility / mobile (interviews, landing)
- **What happened (live, mobile 390×844):** on `/interviews` the ⓘ "What the answered count means"
  info icon next to each progress percentage measures **14×14px** — a very small one-handed tap
  target for a tooltip trigger. On the landing, the "Sign in" nav control is **71×36px** (under the
  44px comfort baseline). Practice-mode mobile controls, by contrast, are all ≥44px (Favorite
  112×44, Needs work 138×44, Skip/Save 173×48, back/menu 44×44) — the gap is specifically the
  info-icon and the landing/auth chrome.
- **Why it matters:** the info icon is the only affordance explaining what "8 of 10 answered · 80%"
  counts; at 14px it is easy to miss or mis-tap on a phone.
- **Recommended fix:** give the info icon a ≥44px hit area (padding/transparent target around the
  14px glyph) and bump the landing nav control to ≥44px min height. Small CSS change.
- **Tracking:** below the >30-min ticketing threshold; report note, flagged for any landing/interviews
  polish pass.

### 4. P3 (recognition) — two identically-titled "OpenAI · Solutions Architect" cards on `/interviews` with no disambiguation

- **Severity:** P3 — recognition-over-recall; mild confusion for a returning user.
- **Area:** dashboard / interviews
- **What happened (live, `/interviews`):** the account shows three cards; **two** are titled
  "OpenAI · Solutions Architect" — one in a **"Research needs attention"** error state ("Open the
  research run to review the error and try again." → *Review research*) and one **"In progress · 8 of
  40 answered · 20%"**. There is no date, attempt number, or other distinguisher between them, so a
  returning user can't tell at a glance which is which or why there are two.
  Evidence: [`04-d-interviews.png`](./assets/2026-10-29/04-d-interviews.png).
- **Why it matters:** the interviews list is the returning-user's "what did I do / what's next"
  surface; duplicate titles make it ambiguous which run to resume.
- **Recommended fix:** add a lightweight distinguisher to each card (created date, or "Attempt 2"),
  and/or collapse a failed research run under its successful sibling for the same company/role.
- **Tracking:** adjacent to **[PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107)** (Backlog —
  "Surface needs-work & progress on the interview card"); fold the disambiguation note there.

### 5. P3 (polish) — the generic 404 is the entire treatment for deliberately-removed freeze routes

- **Severity:** P3 — honesty/recovery polish; acceptable per the freeze acceptance spec, but blunt.
- **Area:** copy / error states
- **User scenario:** a returning user follows an old bookmark or link to `/profile` or `/pricing`.
- **What happened (live):** all four removed routes render the generic **"404 — Oops! Page not
  found — Return to Home."** The freeze acceptance table explicitly allows "unavailable/404", so this
  is **in-spec and not a bug** — but for `/profile` specifically (a feature an existing user used to
  have), a bare 404 reads as "something broke" rather than "this isn't part of the current release."
- **Why it matters:** low impact, but a one-line "this feature isn't available in the current
  release" on the known-removed paths would be more honest than a generic not-found.
- **Recommended fix (optional):** nothing is required for freeze sign-off; if touched, a short
  "not available in this release" message on the known freeze-removed routes beats the generic 404.
- **Tracking:** report note only; below threshold and explicitly allowed by the freeze spec.

## Notable live observations (not top-5)

### Positives — live-verified this run

- **Guest sample is fully static and honest.** View sample plan expands inline, **zero** Edge
  Function / provider / REST calls (network-instrumented), with a clear disclaimer: *"A fictional
  example of a prep plan. These are practice prompts, not verified questions from a particular
  employer. No live research runs when you open this sample."* Three stages (Hiring manager /
  Product discussion / Team collaboration), each with a question and a "what to show" line, then a
  "Sign in to prepare your interview" CTA. [`02-d-guest-sample-plan.png`](./assets/2026-10-29/02-d-guest-sample-plan.png)
- **`/auth` is clean, invite-only, and accessible.** Autocomplete set (email / current-password),
  single-`<label>` fields, no public Sign-Up tab, honest invite-only copy, logical keyboard focus
  order (skip-link → logo → Back to home → email → password → Sign In → Forgot → Resend) with a
  2px-solid + box-shadow focus ring on every control. [`03-d-auth.png`](./assets/2026-10-29/03-d-auth.png)
- **Practice question is the hero and a proper `<h1>` on both breakpoints.** Desktop and mobile both
  render the question as the sole `<h1>`; questions are visibly role/company-specific. Stage +
  difficulty badges, a session progress bar + timer + "Aim for 1–2 min", notes autosave ("Saved on
  this device while you practice." / "Draft kept in this tab"), and **Save & Continue correctly
  disabled until text is entered** (error prevention). [`05-d-practice.png`](./assets/2026-10-29/05-d-practice.png),
  [`07-m-practice.png`](./assets/2026-10-29/07-m-practice.png)
- **Text-answer save persists.** `POST practice_answers` → `201`; the "answered" counter advanced
  live.
- **`/interviews` resumes well.** Cards show state + progress ("8 of 10 answered · 80%") with
  **Continue practice** and **Plan** one click away, a **Prep a new interview** primary CTA, and an
  honest **"Research needs attention … Review research"** recovery card for a failed run.
  [`04-d-interviews.png`](./assets/2026-10-29/04-d-interviews.png)
- **Protected-route redirect preserves intent.** Logged-out `/practice` → `/auth` with the
  route-specific banner *"Continue to Practice."*
- **Mobile practice is clean.** No horizontal overflow (390/390), fixed Skip / Save & Continue
  bottom bar, all controls ≥44px, question dominates. [`07-m-practice.png`](./assets/2026-10-29/07-m-practice.png)

## Journey scorecard

Full authenticated pass. Since run #20 the freeze lock (`#354`/`#360`, PREPIO-27) + auth autocomplete
(PREPIO-123) + the history empty-state rewrite shipped. Score movers this run: **First-time
understanding 3→3 (mixed: P0 blanking gone ▲ but sample now hidden-by-default ▼ — net flat)**,
**Error/empty states 4→5 ▲**, **Accessibility 4→5 ▲**, **Copy quality 4→4 (= ; new "below" mismatch
offsets the honesty gains)**. Research rows are code-confirmed / carried — **no fresh research run was
submitted** (it spends real OpenAI/Tavily budget on the tester account), so the research form and
async progress modal were not re-triggered this week.

| Area | 2026-09-03 | 2026-10-29 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | 3 | = | **(live)** P0 guest-CORS-blanking is **gone** (▲), but the landing default view is now near-empty with the sample behind a click + an inaccurate "below" line (▼). Net flat. (P2 #2) |
| Research entry | 4 | 4 | = | **(code-confirmed, not re-submitted)** Authenticated research form unchanged in code; guest entry intentionally removed under the freeze. |
| Research progress/loading | 5 | 5 | = | **(carried)** Async modal unchanged in code; not re-triggered (budget). |
| Generated output clarity | 5 | 5 | = | **(live)** Plan/stage/question + guidance structure strong and role/company-specific. |
| Practice mode | 4 | 4 | = | **(live)** Question is `<h1>` hero, save persists (`201`), Save gated on non-empty — but Favorite/Needs-work is 100% broken (P1 #1), holding the score down. |
| Mobile usability | 4 | 4 | = | **(live)** Practice-mobile strong: no overflow, ≥44px, fixed bottom bar, question dominates. (Interviews info icon 14px + landing nav <44px — P3 #3.) |
| Resume/profile trust | 4 | 4 | = | **(carried)** Profile is now unrouted (404) under the freeze; CV surface not exercised (PII rule). Not a regression — a scope decision. |
| Dashboard/history/resume | 3 | 4 | ▲ | **(live)** `/history` empty-state rewritten and honest (last run's P3 #4 fixed); interviews cards resume well. Duplicate-title cards (P3 #4) hold it below 5. |
| Error/empty states | 4 | 5 | ▲ | **(live)** Guest sample static + honest, failed-research recovery card, history empty-state honest, flag failure is at least a clear toast. Pre-signup blanking is gone. |
| Accessibility | 4 | 5 | ▲ | **(live)** `<h1>` on both practice breakpoints, autocomplete fixed (PREPIO-123 Done), visible focus rings, logical focus order, no overflow. Remaining: sub-44px info icon / landing nav (P3 #3). |
| Copy quality | 4 | 4 | = | **(live)** Invite-only/auth/history/sample copy honest and specific; offset by the new "Explore a fixed example below" mismatch and the blander hero (P2 #2) + the "try again in a moment" rider (P1 #1). |

**Composite: up, led by Error/empty states and Accessibility.** The deployed core is at its best
level in this review's history. The one structural drag is the unshipped flag-write migration
(PREPIO-170), entirely a deploy gap.

## Regression check

Net **strongly positive** since run #20 — three prior findings fixed, no code regressions; one new
first-impression softness introduced *by* the (beneficial) freeze lock.

| Item | State | Note |
|------|-------|------|
| Guest preview (pre-signup surface) | **Fixed** ✅ | Static inline sample, **zero** backend calls. Last run's **P0** (CORS blanking) is gone. (PREPIO-27 Done) |
| Checkout / portal / billing CTAs | **Fixed** ✅ | `/pricing`, `/billing` → 404; no live checkout CTA. (PREPIO-27 Done) |
| Public sign-up | **Fixed** ✅ | `/auth` invite-only; Sign-Up tab removed. (PREPIO-27 Done) |
| `/auth` autocomplete | **Fixed** ✅ | `email` / `current-password` set. 15-audit repeat **closed**. (PREPIO-123 Done) |
| `/history` empty-state vs in-progress work | **Fixed** ✅ | Copy now explains history = finished sessions + points to "Your interviews". (was run #20 P3 #4) |
| Practice question `<h1>` (desktop + mobile) | **Holding** ✅ | Sole `<h1>` on both breakpoints. |
| Text-answer save | **Holding** ✅ | `201`; counter advanced live. |
| Notes autosave / protected redirect / mobile ≥44px | **Holding** ✅ | All unchanged and good. |
| Favorite / Needs-work flag write | **Still broken** ❌ | `400 / 42P10`; migration written, authorized, **unapplied**. (P1 #1, PREPIO-170) |
| Landing first-impression | **New softness** ⚠️ | Sample now behind a click; "Explore a fixed example below" inaccurate; blander hero. (P2 #2) — a side effect of the otherwise-correct freeze lock. |

**Net: three fixes, zero code regressions, one new polish-level softness.**

## Recommended tickets

Every **actionable defect** this run maps to an existing open issue — **no new Linear issue is
filed** (consistent with the routine's convention and the freeze posture "do not add features /
redesign work"; this is also an unattended scheduled run, so external-state changes are kept
minimal). One finding (landing polish, P2 #2) does not map to an open issue and is written up here
as a **held** recommendation for the owner to triage rather than auto-filed.

1. **[P1] Apply `20260710203000_question_flags_per_type.sql`** in the PREPIO-124 freeze window so the
   Favorite/Needs-work upsert stops returning `42P10`; verify persistence across reload on desktop +
   mobile. → **[PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170)** (Urgent, Todo) inside
   **[PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124)** (Urgent, In Progress). *Live-confirmation
   comment added to PREPIO-170 this run.*
2. **[P2 — held, not filed] Landing polish:** render the sample plan expanded by default (or a
   condensed inline teaser), and fix the "Explore a fixed example below" copy to match the real
   layout; optionally restore a more specific hero line. Does not map to an open issue (PREPIO-27 is
   Done); **held** pending owner confirmation that the minimal default isn't intentional — file under
   **Landing Page Framing** if accepted. (P2 #2)
3. **[P3 — note] ≥44px hit area** for the `/interviews` progress info icon (currently 14×14) and the
   landing "Sign in" nav (71×36). Below threshold; fold into any landing/interviews polish. (P3 #3)
4. **[P3 — note] Disambiguate duplicate interview cards** (date / attempt number), adjacent to
   **[PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107)** (Backlog). (P3 #4)

### Deferred items (per CLAUDE.md hygiene convention)

- **No new Linear issues filed this run.** The one non-mapping finding (landing polish, P2 #2) is
  held for owner triage rather than filed, per the freeze "no redesign work" posture and the
  unattended-run posture of keeping external writes minimal.
- All actionable findings map to existing open issues: **PREPIO-170** (flag write, Urgent),
  **PREPIO-124** (freeze deploy, Urgent), **PREPIO-107** (interview-card surfacing, Backlog). A
  live-confirmation comment was added to **PREPIO-170** this run.
- **Closed since run #20:** PREPIO-27 (freeze surface lock — Done), PREPIO-123 (auth autocomplete —
  Done). Removed from the standing carry list.

---

Capability: live browser verified
