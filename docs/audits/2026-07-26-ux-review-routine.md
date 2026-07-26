# Prepio UI/UX Review — 2026-07-26 (recurring routine, run #10)

Tenth run of the recurring weekly UX-review routine. Baselines:
[`2026-06-21`](./2026-06-21-ux-review-routine.md),
[`2026-06-25`](./2026-06-25-ux-review-routine.md),
[`2026-07-02`](./2026-07-02-ux-review-routine.md),
[`2026-07-05`](./2026-07-05-ux-review-routine.md),
[`2026-07-09`](./2026-07-09-ux-review-routine.md),
[`2026-07-12`](./2026-07-12-ux-review-routine.md),
[`2026-07-16`](./2026-07-16-ux-review-routine.md),
[`2026-07-19`](./2026-07-19-ux-review-routine.md),
[`2026-07-23`](./2026-07-23-ux-review-routine.md).

## Capability check — live browser verified

Both checks required by [`UX_REVIEW_ROUTINE.md`](./UX_REVIEW_ROUTINE.md) passed:

- **Playwright Chromium: PASS** — `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
  (explicit `executablePath` still required; the `@playwright/test@^1.61.1`
  pin looks for a `chromium_headless_shell` build absent from the
  pre-populated `/opt/pw-browsers` layout — same standing gotcha as runs #8–#9).
- **Live-app reachability: PASS** — `curl … https://prepio.qiuyue.dev/` → `200`.
  Chromium reaches the live app with the standing workarounds
  (`--ssl-version-max=tls1.2`, `--ignore-certificate-errors`, explicit
  `proxy.server` from `HTTPS_PROXY`).

Coverage this run: logged-out landing + guest-preview (desktop 1440×900);
`/auth` keyboard + focus + empty-submit probe (desktop); logged-in
`/interviews`, `/new-interview`, `/dashboard` redirect, `/history`,
`/pricing` (desktop); full logged-in practice flow through Q1 with the
breathing-interstitial gate, flag `aria-pressed`/coexistence probe, and
Save-disabled-on-empty check (mobile 390×844). Screenshots under
[`assets/2026-07-26/`](./assets/2026-07-26/).

## Overall product judgment

**The story this run is production parity, and it split into two clearly
different failure modes that had been blurred together as "stale build."**
The first is a genuine stale-frontend deploy: `main` binds
`aria-pressed` and the active flag copy ("Favorited" / "Needs work flagged")
with test coverage (`Practice.tsx:2699–2725`), but the live app at
`prepio.qiuyue.dev` (bundle `index-DYSD0TVv.js`) still reads
`aria-pressed=false` and the static "Favorite" / "Needs work" copy after
activation. That is exactly run #9's ticket #5 — redeploy the frontend —
**still unactioned.**

**The second is worse and is a new discovery: PREPIO-111 is marked Done in
Linear, but its fix was never written into `main`.** The signed-in
`/new-interview` marketing hero this ticket asked to remove
("Prepio · Get insider insights … Tailored prep for you and your friends")
is still present in source at `Home.tsx:1546–1551` (desktop) and
`1428–1434` (mobile), gated by the signed-in branch at `Home.tsx:1416`.
The Done transition came from PR #190 — the *docs* PR that filed the
ticket — not a code change. So a frontend redeploy alone would **not** fix
the hero; the work still has to be done. **I reopened PREPIO-111 to Todo
this run and left an evidence comment.** This is the tenth consecutive
audit of that exact copy, and now we know why it never moved.

**The P0 is unchanged and now in its fifth week: `research-preview` is still
not deployed.** A fresh live probe returns `HTTP 404 NOT_FOUND` on the
OPTIONS preflight; every guest "Preview my prep" click still dies on the
CORS/404. **The Linear free-issue cap is also still in force** — attempting
to file the P0 this run returned the same `You've exceeded the free issue
limit` error (requestId `a2135d74…`). Existing-issue *updates* still work,
which is why the PREPIO-111 reopen went through.

**Net: the composite scorecard is flat for the fourth straight week, but the
diagnosis sharpened materially.** The three highest-value actions are now
crisply separable: (1) deploy `research-preview`; (2) redeploy the frontend
to current `main`; (3) actually implement PREPIO-111 (redeploy won't cover
it). None require guesswork anymore.

## Top 5 issues

### 1. **P0 (5th week) — Guest "Preview my prep" is broken because `research-preview` is still not deployed**

- **Severity:** P0 (held — five-week outage of the entire guest conversion path)
- **Area:** landing / conversion
- **User scenario:** logged-out visitor on `/` fills Company=`Anthropic`, Role=`Product Manager`, clicks *Preview my prep*.
- **What happened (live, desktop 1440×900, this run):** button spins, then the red banner *"We couldn't build the preview. Try again, or sign in to run the full research workflow."* The right column stays in its pre-click state (*"Your Anthropic preview will appear here"*). Screenshot: [`assets/2026-07-26/03-d-guest-result.png`](./assets/2026-07-26/03-d-guest-result.png).
- **Root cause (re-confirmed live):**
  ```
  curl -X OPTIONS …/functions/v1/research-preview  →  HTTP/2 404, sb-error-code: NOT_FOUND
  ```
  Browser console: `blocked by CORS policy: Response to preflight request … does not have HTTP ok status` → `FunctionsFetchError`. The in-repo source, OPTIONS handler, and `verify_jwt=false` are all correct; the function was never shipped.
- **Why it matters:** the landing promises *"No account needed for preview."* Broken for over a month. The guest preview is the only interactive proof-of-value on the page.
- **Recommended fix:** `npm run functions:deploy-single research-preview`; smoke-test OPTIONS→200 + a real POST; add a synthetic health check; add a frontend static-example fallback on failure.
- **Tracking:** **Could not file — Linear at free-issue cap** (confirmed again this run). GitHub-ready ticket #1 below. **Deploy intentionally not performed by this review job** — it is a cost-incurring, guest-facing production change and this run is unattended.

### 2. **P1 (new, sharpened) — PREPIO-111 is marked Done but its fix is absent from `main`; the marketing hero is live *and* in source**

- **Severity:** P1 (a Done ticket whose code change never landed — corrupts the backlog and hides a live trust issue)
- **Area:** landing / research entry / process
- **User scenario:** signed-in user clicks *Prep a new interview* from `/interviews` → lands on `/new-interview`.
- **What happened (live + source, this run):** the page header reads verbatim *"Prepio · Get insider insights on any company's interview process. Tailored prep for you and your friends."* ([`assets/2026-07-26/11-d-new-interview.png`](./assets/2026-07-26/11-d-new-interview.png) — cropped to the hero; the CV card below it is omitted because this form prefills the account's saved résumé and would otherwise commit tester PII). This copy is still in `origin/main`: desktop `src/pages/Home.tsx:1546–1551`, mobile `1428–1434`, gated by the signed-in branch at `Home.tsx:1416` (`!user ? renderGuestHome() : isMobile ? … : (this)`).
- **Why the Done state is wrong:** PREPIO-111's Done transition (2026-06-25) came from PR #190 — the *docs* PR that filed PREPIO-111/112/113 — not a code fix. `git grep "insider insights" origin/main` still hits `Home.tsx:1550`.
- **Why it matters:** unlike finding #3, a frontend redeploy will **not** fix this — the acceptance criteria were never implemented. Tenth consecutive audit of this copy. It's also the first surface every returning user sees when starting fresh prep.
- **Action taken this run:** reopened PREPIO-111 (Done → Todo) and left an evidence comment. This was possible because the cap blocks *creation*, not *updates*.
- **Recommended fix:** implement the ticket's acceptance criteria (task-framed header for signed-in `/new-interview`, remove the "for you and your friends" / "desktop-style sprawl" metacopy for signed-in users). Tracked: [PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111) (reopened).

### 3. **P1 (held — run #9 ticket #5, unactioned) — Stale production frontend: `aria-pressed` + active flag copy are in `main` but not live**

- **Severity:** P1 (production is serving a build that predates PR #231; real a11y bug live)
- **Area:** practice / accessibility / deployment
- **What happened (live, mobile Q1, this run):** `aria-pressed` read `false` on both flag buttons before *and* after activation (initial `{fav:false, nw:false}`; after *Favorite* `{false,false}`; after also *Needs work* `{false,false}`), and the button copy stayed "Favorite" / "Needs work" (never "Favorited" / "Needs work flagged"). Screenshot: [`assets/2026-07-26/65-m-both-flags.png`](./assets/2026-07-26/65-m-both-flags.png).
- **Confirmed against source:** `main` binds `aria-pressed={favoriteActive}` / `aria-pressed={needsWorkActive}` (`Practice.tsx:2699,2716,3139,3155`) and renders `favoriteActive ? "Favorited" : "Favorite"` / `needsWorkActive ? "Needs work flagged" : "Needs work"` (`:2708,2725`). So the fix exists and is tested — the live app is stale. Bundle: `index-DYSD0TVv.js`.
- **Why it matters:** screen-reader users get no pressed-state feedback on the two most-used practice controls, and the app has already fixed it. This is pure deploy lag.
- **Recommended action:** confirm the commit `prepio.qiuyue.dev` is serving and redeploy the frontend to current `main`; re-probe that `aria-pressed` tracks state and both flags can coexist (PR #233). Do **not** re-implement — it already exists.
- **Tracking:** **Could not file — Linear cap.** GitHub-ready ticket #3 below (same as run #9 ticket #5, still open).

### 4. **REPEAT P1 (4th consecutive week) — Practice launches into a "Breathe in… / Cycle 1 of 3" breathing interstitial before Q1**

- **Severity:** P1 (held)
- **Area:** practice / core flow
- **What happened (live, mobile 390×844):** after *Continue practice* → *Start practice* (Quick start), the app shows a full-screen breathing loop. `innerText` at the gate: `Breathe in... | Cycle 1 of 3 | Don't show again | Skip`; only *Skip* exits. Screenshots: [`assets/2026-07-26/61-m-after-start.png`](./assets/2026-07-26/61-m-after-start.png), Q1 past the gate: [`assets/2026-07-26/64-m-practice-q1.png`](./assets/2026-07-26/64-m-practice-q1.png).
- **Confirmed present in `main`:** `src/components/practice/BreathingBreak.tsx` (3-cycle loop, `Don't show again` opt-out). This is current behavior, not a stale build — so a redeploy will *not* remove it; it needs a product change.
- **Why it matters:** violates *"the current practice question is the hero"* and *"time-to-value beats feature count."* Three steps to the first question.
- **Recommended fix (unchanged):** move the interstitial behind an opt-in on practice-setup (off by default); or invert *"Don't show again"* to on; or cap the gate at ≤5s and auto-advance.
- **Tracking:** **Could not file — Linear cap.** GitHub-ready ticket #4 below.

### 5. **REPEAT P2 (5th consecutive week) — Interviews card counter and History disagree**

- **Severity:** P2 (repeat)
- **Area:** history / dashboard consistency
- **What happened (live):** `/interviews` card reads *"In progress · OpenAI · Solutions Architect · 3 of 40 practiced · 8%"* ([`assets/2026-07-26/30-m-interviews.png`](./assets/2026-07-26/30-m-interviews.png)). `/history` renders the empty state *"Ready to start practicing / Your first practice session will appear here…"* ([`assets/2026-07-26/35-d-history.png`](./assets/2026-07-26/35-d-history.png)). Counter held at 8% (no completed save; Save & Continue is correctly disabled on empty).
- **Why it matters:** two surfaces disagree about whether the user practiced anything; History (the resume surface) reads empty while the card claims 8% progress.
- **Recommended fix (unchanged, option 1 preferred):** render in-progress sessions as an *"In progress · resume"* row in `/history`; or relabel the counter from *"practiced"* to *"answered"* with a tooltip.
- **Tracking:** **Could not file — Linear cap.** GitHub-ready ticket #5 below.

## Notable live observations (not top-5)

### Process blocker — still active

- **Linear workspace remains at its free-issue cap.** Filing the P0 this run
  returned `invalid_request: "You've exceeded the free issue limit for this
  workspace…"` (requestId `a2135d74a80ec948`). This is the fourth review in
  a row that could not file new tickets. **Existing-issue updates still
  work** — the PREPIO-111 reopen + comment succeeded — so the cap blocks
  creation only. GitHub-ready ticket #2 below (upgrade / trial / prune).

### Accessibility (partial pass — long-owed keyboard/focus probe finally run)

- **Landing keyboard order + focus rings: healthy.** Tab order:
  skip-link → Prepio → Pricing → *Sign in* → `#guest-company` →
  `#guest-role`, each with a visible focus ring (`focus-visible=true`). The
  disabled *Preview my prep* button is correctly skipped until Company is
  filled. Skip-to-main is the first tab stop (eighth confirmation).
- **`/auth` labels are real `<label>` elements** ("Email" / "Password"),
  not placeholder-only — good. But **`autocomplete` is still `null`** on both
  `#signin-email` and `#signin-password` ([PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123),
  PR #244 still unmerged; Chromium logs the `current-password` warning live).
  Seventh audit.
- **NEW (small) — empty-submit gives no programmatic error linkage.**
  Submitting `/auth` with empty required fields produced **0** `aria-invalid`
  attributes, **0** `role=alert` regions, and **0** `aria-describedby`
  associations. Validation appears to rely on native HTML5 `required`, whose
  bubble is not reliably announced by screen readers and is not linked to the
  fields. P3 — fold into the a11y ticket (#6). Screenshot:
  [`assets/2026-07-26/20-d-auth.png`](./assets/2026-07-26/20-d-auth.png).

### Positives holding

- **Save & Continue disabled on empty answer** — `button.disabled === true`
  on Q1 with an empty answer. Holds from run #9.
- **Question is the hero on Q1.** Verbatim: *"Q1/10 · 00:07 · Final Round ·
  Medium · Explain the importance of ethics in AI development. · Aim for 1-2
  min · Favorite · Needs work · Answer guide · Record answer · Notes · Quick
  notes · Saved on this device while you practice. · Saving draft… · Skip ·
  Save & Continue."* Metadata supportive, autosave copy honest.
- **Autosave "Saving draft…"** rendered next to Quick notes (PREPIO-108
  healthy, seventh live confirmation).
- **Landing hero + static Stripe example** unchanged, still strong —
  [`assets/2026-07-26/01-d-landing.png`](./assets/2026-07-26/01-d-landing.png).
  Carrying the funnel while the live preview 404s.
- **Pricing copy** unchanged and honest: *"Research, prep plans, and practice
  stay free. Paid subscriptions unlock AI feedback on saved practice
  answers…"* — [`assets/2026-07-26/14-d-pricing.png`](./assets/2026-07-26/14-d-pricing.png).

### Tracked repeats confirmed live

- **Nav has no "Interviews" item** ([PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101),
  In Progress) — desktop nav verbatim `Prepio · Home · Dashboard · Practice ·
  Practice History · Pricing · Profile`. **Tenth audit.**
- **`/dashboard` redirect collision** — direct nav to `/dashboard` resolved
  to `/interviews` again (seventh consecutive live confirmation). Component of
  PREPIO-101.
- **`/history` "Go to Dashboard" CTA** still points to `/dashboard` (which
  redirects to `/interviews`) — fifth consecutive audit.
- **Mobile typed-answer path still ambiguous** — the only text input on Q1 is
  the device-local *Quick notes* textarea (placeholder *"Jot the beats you
  want to hit…"*). *Record answer* remains the primary answer path; a user who
  wants to *type* a saved answer has only the on-device notes drawer. Carried
  from runs #7–#9; still worth a product decision.

## Journey scorecard

Rows marked **↑** improved since run #9, **=** unchanged, **↓** worse. Cells marked **(live)** are live-verified this run.

| Area | Run #9 | Run #10 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | 3 | = | **(live)** Landing hero + static example still strong. Guest preview still 404s — fifth week. |
| Research entry | 3 | 3 | = | **(live)** `/new-interview` marketing hero unchanged; now confirmed *in source* too (PREPIO-111 reopened). Tenth audit. |
| Research progress/loading | — | — | = | Not scored — no fresh authenticated research run started (cost-incurring; deferred again). Eighth owed cycle. |
| Generated output clarity | 4 | 4 | = | **(live)** Reviewed via Interviews card (40 questions / OpenAI SA) + Q1. Plan page not re-audited. |
| Practice mode | 3 | 3 | = | **(live)** Breathing interstitial still gates Q1 (4th week). Q1 layout intact; Save & Continue disabled-on-empty holds. |
| Mobile usability | 3 | 3 | = | **(live)** Interstitial still ships on mobile; typed-answer path still ambiguous. |
| Resume/profile trust | 4 | 4 | = | Not re-audited in depth (tester PII — deferred to a synthetic account, per run #8 note). |
| Dashboard/history/resume | 3 | 3 | = | **(live)** Counter/History mismatch persists (8% vs empty), fifth week. |
| Error/empty states | 3 | 3 | = | **(live)** Guest preview error honest on the left; right column still silently pre-click. `/history` empty state fine but *Go to Dashboard* still mis-routes. |
| Accessibility | 3 | 3 | = | **(live)** Landing keyboard order + focus rings healthy; auth labels real. `aria-pressed` stale-in-prod (finding #3); `autocomplete=null` + no empty-submit error linkage still open. |
| Copy quality | 4 | 4 | = | **(live)** Hero, unified CTA, honest autosave/pricing all holding. "Cycle 1 of 3" interstitial copy still reads as from a different app. |

**Composite trend: 0 net (all rows unchanged).** Fourth consecutive flat
scorecard — but this run cleanly separated the two production-parity failure
modes and reopened a mis-closed ticket.

## Regression check

| Item | State | Note |
|------|-------|------|
| Guest "Preview my prep" broken (`research-preview` 404) | **Still broken — 5th week** | Re-confirmed `HTTP 404 NOT_FOUND` live. P0. Could not file (Linear cap). |
| **NEW: PREPIO-111 marked Done but fix absent from `main`** | **Backlog-integrity regression** | Marketing hero still in `Home.tsx:1546–1551`/`1428–1434`. Reopened to Todo + commented this run. |
| Stale production frontend (`aria-pressed`, active flag copy) | **Still stale — run #9 ticket #5 unactioned** | `main` binds it with tests; live serves pre-#231 bundle `index-DYSD0TVv.js`. |
| Breathing interstitial before Q1 | **Still ships — 4th week** | Present in `main` (`BreathingBreak.tsx`). Redeploy won't remove it — needs a product change. Could not file. |
| Interviews counter vs History mismatch | **Still broken — 5th week** | 8% vs empty. Could not file. |
| Linear workspace at free-issue cap | **Still blocking creation** | Fourth review unable to file new tickets. Updates still work. |
| Nav has no "Interviews" link + `/dashboard` collision | **Still open** ([PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101), In Progress) | Tenth audit. |
| `/history` "Go to Dashboard" → `/interviews` | **Still open** (part of PREPIO-101) | Fifth audit. |
| Password autocomplete missing on `/auth` | **Still open** ([PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123), PR #244 unmerged) | Seventh audit. |
| Save & Continue disabled on empty answer | **Holding** ✅ | `disabled === true` re-verified. |
| Skip-to-main + landing focus rings | **Holding** ✅ | Eighth confirmation; full landing tab order verified this run. |
| Landing hero + static Stripe example | **Holding** ✅ | Unchanged. |
| Autosave "Saving draft…" | **Holding** ✅ | Visible on Q1. |

**Zero of the long-running P0/P1/P2 findings shipped.** The dominant new
facts: (a) PREPIO-111's Done state was spurious — its fix never reached
`main` — now corrected in the tracker; (b) the two production-parity issues
(undeployed function, stale frontend) are cleanly distinct and both remain
unactioned.

## Recommended tickets

Listed GitHub-ready because **the Linear workspace is at its free-issue cap
and no new issue could be created this run** (confirmed live). Once the cap
is lifted (ticket 2), file 1 and 3–6 to Linear per CLAUDE.md conventions.
Ticket 7 is already reopened in Linear.

1. **[P0] Deploy the `research-preview` edge function** — absent from
   production (`404 NOT_FOUND`), breaking guest preview for five weeks.
   `npm run functions:deploy-single research-preview`; verify
   `verify_jwt=false`; smoke-test OPTIONS→200 + POST; add a synthetic health
   check and a frontend static-example fallback on failure.
   *Project: Landing Page Framing · Type: Bug · area:landing.*
2. **[P1] Lift the Linear free-issue cap** (upgrade / trial / prune) so the
   audit→backlog workflow in CLAUDE.md can function again. Four reviews now
   blocked. *Project: Quality & Maintenance · Type: Chore · area:infra.*
3. **[P1] Redeploy the frontend to current `main` and verify production
   parity** — live app serves a stale bundle (`index-DYSD0TVv.js`) that reads
   `aria-pressed=false` and pre-#231 flag copy though `main` binds
   `aria-pressed` with test coverage. Confirm the serving commit, redeploy,
   re-probe the flag toggles + coexistence. Do **not** re-implement.
   *Project: Quality & Maintenance · Type: Chore · area:infra.* (= run #9 ticket #5.)
4. **[P1] Remove the breathing interstitial from the default practice start**
   (or invert "Don't show again" + cap at ≤5s with auto-advance). Present in
   `main` (`BreathingBreak.tsx`) — needs a product change, not a redeploy.
   *Project: Quality & Maintenance · Type: Bug · area:practice.*
5. **[P2] Reconcile the Interviews "practiced" counter with History** — render
   in-progress sessions as a resume row in `/history` (preferred), or relabel
   the counter to "answered" with a tooltip.
   *Project: Quality & Maintenance · Type: Bug · area:practice.*
6. **[P3] Auth a11y pass** — add `autocomplete` to `/auth` email + password
   (existing [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123),
   PR #244 unmerged — land it), *and* add programmatic error linkage on empty
   submit (`aria-invalid` + `role=alert`/`aria-describedby`, or replace native
   `required` with announced inline errors).
   *Project: Quality & Maintenance · Type: Improvement · area:auth.*
7. **[P1] Implement PREPIO-111 (reopened this run)** — the signed-in
   `/new-interview` marketing hero is still in `main` (`Home.tsx:1546–1551`
   desktop, `1428–1434` mobile) despite the ticket being marked Done off a
   docs PR. Redeploy will not fix it. Already reopened to Todo in Linear with
   an evidence comment. *[PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111).*

## Next-run focus

1. **Verify the `research-preview` deploy landed** — re-run OPTIONS→200 + POST
   and the live guest flow. Single highest first-touch recovery.
2. **Verify the frontend redeploy** — re-probe `aria-pressed` tracks state and
   both flags coexist; check the "Favorited" / "Needs work flagged" active
   copy appears live.
3. **Confirm the Linear cap is lifted and file tickets 1, 3–6.**
4. **Re-check PREPIO-111** — verify the hero copy is actually removed from
   `main` and live before it is Done again (don't trust a docs-PR close).
5. **Budget a real authenticated research run end-to-end** — eight audits
   owed. Rotate to a fresh company (Palantir, Amazon).
6. **Empty-state coverage + resume/profile** — use a scratch account (tester
   still has one interview + PII); the truly-empty `/interviews` state and the
   CV/profile trust flow both remain unreached.

`Capability: live browser verified`
