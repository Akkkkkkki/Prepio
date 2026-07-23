# Prepio UI/UX Review — 2026-07-23 (recurring routine, run #9)

Ninth run of the recurring weekly UX-review routine. Baselines:
[`2026-06-21`](./2026-06-21-ux-review-routine.md),
[`2026-06-25`](./2026-06-25-ux-review-routine.md),
[`2026-07-02`](./2026-07-02-ux-review-routine.md),
[`2026-07-05`](./2026-07-05-ux-review-routine.md),
[`2026-07-09`](./2026-07-09-ux-review-routine.md),
[`2026-07-12`](./2026-07-12-ux-review-routine.md),
[`2026-07-16`](./2026-07-16-ux-review-routine.md),
[`2026-07-19`](./2026-07-19-ux-review-routine.md).

## Capability check — live browser verified

Both checks required by [`UX_REVIEW_ROUTINE.md`](./UX_REVIEW_ROUTINE.md) passed:

- **Playwright Chromium: PASS** — `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
  (explicit `executablePath` still required; the `@playwright/test@^1.61.1`
  pin looks for a `chromium_headless_shell` build not in the pre-populated
  `/opt/pw-browsers` layout — same run-#8 gotcha).
- **Live-app reachability: PASS** — `curl … https://prepio.qiuyue.dev/` → `200`.
  Chromium reaches the live app with the standing workarounds
  (`--ssl-version-max=tls1.2`, `--ignore-certificate-errors`, explicit
  `proxy.server` from `HTTPS_PROXY`).

Coverage this run: logged-out landing + guest-preview (desktop 1440×900),
`/auth`, `/new-interview`, `/dashboard` redirect, `/pricing` (desktop);
logged-in `/interviews`, `/history`, full practice flow through Q1 with
flag + Save-&-Continue probes (mobile 390×844). Screenshots under
[`assets/2026-07-23/`](./assets/2026-07-23/).

## Overall product judgment

**The four-week guest-preview outage finally has a root cause — and it is
worse and simpler than any prior run guessed.** The `research-preview`
edge function *is not deployed to production*. Every guest "Preview my
prep" click since run #6 has been calling an endpoint that returns
`404 NOT_FOUND`; the browser reports it as a CORS-preflight failure, which
is why prior runs only ever saw the red banner. The frontend, the CORS
handler, and `config.toml` are all correct — the function was simply never
shipped. This is now a **P0** with a one-command fix.

**The second discovery explains why the backlog never moves: the Linear
workspace is at its free issue cap.** Attempting to file the four issues
that runs #6–#8 all recommended returned `You've exceeded the free issue
limit for this workspace`. So the "recommended but never filed" pattern the
last three reports kept flagging isn't neglect — it's a hard tooling
block. Until the cap is lifted, no new tracking issue can be created, and
this report's recommended tickets are documented in GitHub-ready form
below rather than filed.

**Everything else is unchanged from run #8, with two small resolutions.**
The breathing interstitial still gates Q1 (third week). The
counter-vs-History mismatch still stands (fourth week). PREPIO-111
(`/new-interview` hero) and PREPIO-101 (nav) are unchanged at their ninth
audit. On the positive side: **Save & Continue is now genuinely
`disabled` on an empty answer** (verified this run — resolves the run-#7
counter-honesty concern), and the owed **`aria-pressed` probe landed**,
confirming a real accessibility bug on the practice flag buttons.

**The single highest-value action this week is deploying `research-preview`.**
It is the cheapest fix on the board (one command) and unblocks the entire
logged-out conversion funnel that has been dead for a month.

## Top 5 issues

### 1. **P0 (was P1, promoted) — Guest "Preview my prep" is broken because the `research-preview` edge function is not deployed**

- **Severity:** P0 (four-week outage of the entire guest conversion path; promoted from the P1 that runs #6–#8 held)
- **Area:** landing / conversion
- **User scenario:** logged-out visitor on `/` fills Company=`Meta`, Role=`Product Manager`, clicks *Preview my prep*.
- **What happened (live, desktop 1440×900, this run):** the button spins briefly, then the red banner *"We couldn't build the preview. Try again, or sign in to run the full research workflow."* The right column stays in its pre-click state (*"Your Meta preview will appear here"*). Screenshot: [`assets/2026-07-23/03-d-landing-post-preview.png`](./assets/2026-07-23/03-d-landing-post-preview.png).
- **Root cause (new, verified):** the browser console shows the fetch to `…/functions/v1/research-preview` blocked by CORS ("Response to preflight request … does not have HTTP ok status"). Hitting the endpoint directly:
  ```
  curl -X OPTIONS …/functions/v1/research-preview  →  HTTP/2 404, sb-error-code: NOT_FOUND
  ```
  `Supabase.list_edge_functions` for the production project returns only `interview-research, cv-analysis, company-research, interview-question-generator, job-analysis`. **`research-preview` is absent** — never deployed (last function deploy ~2026-05). The in-repo source (`supabase/functions/research-preview/index.ts`), its OPTIONS handler, and `verify_jwt = false` in `config.toml` are all correct. This is a deployment gap, not a code bug — which is why it's a flat, non-intermittent failure across four weeks and four companies (Anthropic → Vitol → Stripe → Meta).
- **Why it matters:** the landing CTA promises *"No account needed for preview."* That promise has been broken for a month. The guest preview is the only interactive proof-of-value on the page; without it the static Stripe example carries the whole funnel.
- **Recommended fix:**
  1. `npm run functions:deploy-single research-preview`; smoke-test OPTIONS→200 and a real POST.
  2. Add a synthetic health check on the endpoint (paged in every run since #6, still unbuilt).
  3. Frontend: on failure, fall back to the static example in the *right* column with honest copy instead of leaving the empty pre-click state.
- **Tracking:** **Could not file — Linear at free-issue cap** (see issue #2). Documented as GitHub-ready ticket #1 below. **Deployment intentionally not performed by this review job** — it is a cost-incurring, guest-facing production change and this run is unattended.

### 2. **P1 (new, process) — Linear workspace is at its free issue cap; no new tracking issues can be filed**

- **Severity:** P1 (blocks the team's entire intake path; the direct cause of the "recommended but never filed" pattern in runs #6–#8)
- **Area:** infra / process
- **What happened:** filing the four recommended issues returned `invalid_request: "You've exceeded the free issue limit for this workspace. Please upgrade or contact sales@linear.app for a free trial."` (requestId `a1faa867edd32979` and three siblings).
- **Why it matters:** CLAUDE.md makes Linear the source of truth for active work and directs every deferred audit item over the 30-minute threshold to be filed there. With the cap hit, that workflow is silently dead — three consecutive reviews recommended issues that *couldn't* be created regardless of intent. Every future review inherits the same block.
- **Recommended fix:** upgrade the Linear workspace, or start the free trial, or prune archived/duplicate issues to get back under the cap. Until then, treat this report's ticket list as the interim backlog.
- **Tracking:** self-referential — cannot be filed for the same reason. Documented here and in ticket #2 below.

### 3. **REPEAT P1 (third consecutive week) — Practice launches into a "Breathe in… / Cycle 1 of 3" breathing interstitial before Q1**

- **Severity:** P1 (held; run #8 said promote to P0 by run #9 — holding at P1 only because issue #1 outranks it for the P0 slot this week)
- **Area:** practice / core flow
- **What happened (live, mobile 390×844):** after *Continue practice* → *Start practice*, the app shows a full-screen breathing loop. `innerText` snapshots: t+0.5s / t+1.5s / t+3s all `Breathe in... | Cycle 1 of 3 | Don't show again | Skip`; t+5s `Hold... | Cycle 1 of 3 | …`. Still Cycle 1 at t+5s — no auto-advance; only *Skip* exits. Screenshot: [`assets/2026-07-23/61-m-after-start.png`](./assets/2026-07-23/61-m-after-start.png). Q1 past the gate: [`assets/2026-07-23/64-m-practice-q1.png`](./assets/2026-07-23/64-m-practice-q1.png).
- **Why it matters:** violates *"the current practice question is the hero"* and *"time-to-value beats feature count."* Three gates to reach the first question.
- **Recommended fix (unchanged):** (1) move the interstitial behind an opt-in on practice-setup, off by default; or (2) invert *"Don't show again"* to on; or (3) cap the gate at ≤ 5s and auto-advance.
- **Tracking:** **Could not file — Linear cap.** GitHub-ready ticket #3 below.

### 4. **REPEAT P2 (fourth consecutive week) — Interviews card counter and History disagree**

- **Severity:** P2 (repeat)
- **Area:** history / dashboard consistency
- **What happened (live):** `/interviews` card reads *"In progress · OpenAI · Solutions Architect · 3 of 40 practiced · 8%"* ([`assets/2026-07-23/30-m-interviews.png`](./assets/2026-07-23/30-m-interviews.png)). `/history` renders the empty state *"Ready to start practicing / Your first practice session will appear here…"* ([`assets/2026-07-23/35-m-history.png`](./assets/2026-07-23/35-m-history.png)). Counter held at 8% this run (no completed save, consistent with Save & Continue being disabled on empty — see positives).
- **Why it matters:** two surfaces disagree about whether the user practiced anything; History (the resume surface) reads empty while the card claims progress.
- **Recommended fix (unchanged, option 1 preferred):** (1) render in-progress sessions as an *"In progress · resume"* row in `/history`; or (2) relabel the counter from *"practiced"* to *"answered"* with a tooltip.
- **Tracking:** **Could not file — Linear cap.** GitHub-ready ticket #4 below.

### 5. **P2 (a11y, owed probe now confirmed) — Practice "Favorite" / "Needs work" toggles never update `aria-pressed`**

- **Severity:** P2 (accessibility; WCAG 4.1.2)
- **Area:** practice / accessibility
- **What happened (live, mobile):** on Q1, `aria-pressed` read `false` on both buttons before and after activation — initial `{favorite:false, needsWork:false}`; after *Favorite* `{false,false}`; after also *Needs work* `{false,false}`. Yet the screenshot shows *Needs work* **visually filled/pressed** and *Favorite* outlined ([`assets/2026-07-23/65-m-both-flags.png`](./assets/2026-07-23/65-m-both-flags.png)). So the visual pressed state is real but `aria-pressed` never mirrors it.
- **Why it matters:** the flag state is conveyed by color/fill only — invisible to assistive tech, and a "no info by color alone" failure. Practice is a core repeated flow.
- **Recommended fix:** bind `aria-pressed` to the same per-question boolean that drives the visual fill; add an RTL test asserting each flag flips `aria-pressed` on click.
- **Secondary observation (needs clean probe):** after clicking *Favorite* then *Needs work*, only *Needs work* was filled — *Favorite* was not. This *may* indicate PR #233's flag-coexistence regressed (Needs work deselecting Favorite), or the Favorite tap missed. Run #10 should click each flag independently with a `waitForResponse` barrier and confirm both can be on simultaneously.
- **Tracking:** **Could not file — Linear cap.** GitHub-ready ticket #5 below.

## Notable live observations (not top-5)

### Positives — two small resolutions this week

- **Save & Continue is genuinely disabled on an empty answer.** `button.disabled === true` measured on Q1 with an empty answer ([`assets/2026-07-23/65-m-both-flags.png`](./assets/2026-07-23/65-m-both-flags.png) shows the muted state). This resolves the run-#7 counter-honesty small finding (run #8 left it "possible partial fix, unverified") — the button does not fire on empty. **Count as a shipped cleanup.**
- **Q1 layout past the interstitial is intact.** Verbatim: *"Q1/10 · 00:12 · Final Round · Medium · What are some potential risks in deploying AI technologies at scale? · Aim for 1-2 min · Favorite · Needs work · Answer guide · Record answer · Notes · Quick notes · Saved on this device while you practice. · Saving draft… · Skip · Save & Continue."* Question is the hero, metadata supportive, autosave copy honest.
- **Autosave "Saving draft…"** rendered next to Quick notes during typing — PREPIO-108 healthy, sixth live confirmation.
- **Mobile hamburger 44×44** ([PREPIO-122](https://linear.app/qiuyue/issue/PREPIO-122)) — measured `{x:330,y:10,width:44,height:44}` again.
- **Skip-to-main works** — first Tab on the logged-out landing lands on `A[href="#main-content"]`. Seventh confirmation.
- **Landing hero + static Stripe example** unchanged, still strong — [`assets/2026-07-23/01-d-landing.png`](./assets/2026-07-23/01-d-landing.png). Carrying the funnel while the live preview 404s.
- **Pricing copy** unchanged and honest: *"Research, prep plans, and practice stay free. Paid subscriptions unlock AI feedback on saved practice answers…"* — [`assets/2026-07-23/14-d-pricing.png`](./assets/2026-07-23/14-d-pricing.png).

### Tracked repeats confirmed live (regression table)

- **`/new-interview` marketing hero** ([PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111)) — still *"Prepio · Get insider insights on any company's interview process. Tailored prep for you and your friends."* on desktop. **Ninth audit.** [`assets/2026-07-23/11-d-new-interview.png`](./assets/2026-07-23/11-d-new-interview.png).
- **Nav has no "Interviews" item** ([PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101)) — desktop nav verbatim `Prepio · Home · Dashboard · Practice · Practice History · Pricing · Profile`. **Ninth audit.**
- **`/dashboard` redirect collision** — direct nav to `/dashboard` resolved to `/interviews` again (sixth consecutive live confirmation). Component of PREPIO-101.
- **`/history` "Go to Dashboard" CTA** still routes to `/interviews` — fourth consecutive audit.
- **`/auth` autocomplete still `null`** ([PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123)) — both `#signin-email` and `#signin-password` return `null` for `autocomplete`. Sixth audit.
- **Mobile-only: still no typed *answer* surface distinct from device-local notes on Q1.** The only text input on Q1 is the *Quick notes* textarea (placeholder *"Jot the beats you want to hit…"*, labeled *"Saved on this device while you practice"*). *Record answer* is the primary answer path; a user who wants to *type* a full saved answer has only the on-device notes drawer. Carried from runs #7–#8; still worth a product decision.
- **Minor layout: "Answer guide" clipped.** On Q1 the *Answer guide* control is partially occluded behind the sticky Record/Notes card ([`assets/2026-07-23/65-m-both-flags.png`](./assets/2026-07-23/65-m-both-flags.png)) — related to the known PREPIO-65 "RECOMMENDED row clipped" family. Cosmetic, P3.

## Journey scorecard

Rows marked **↑** improved since run #8, **=** unchanged, **↓** worse. Cells marked **(live)** are live-verified this run.

| Area | Run #8 | Run #9 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | 3 | = | **(live)** Landing hero + static example still strong. Guest preview now root-caused (not deployed) but still broken — fourth week. |
| Research entry | 3 | 3 | = | **(live)** `/new-interview` marketing hero unchanged, ninth audit (PREPIO-111). |
| Research progress/loading | — | — | = | Not reached — no fresh authenticated research run kicked off (guest preview 404s; logged-in run not started). Seventh not-scored cycle. Owed. |
| Generated output clarity | 4 | 4 | = | **(live)** Reviewed via Interviews card (40 questions / 4 stages, OpenAI SA) + Q1. Plan page not re-audited. |
| Practice mode | 3 | 3 | = | **(live)** Breathing interstitial still gates Q1 (third week). Q1 layout intact; Save & Continue now confirmed disabled-on-empty (small +). Net flat. |
| Mobile usability | 3 | 3 | = | **(live)** Hamburger 44×44 holding. Interstitial still ships on mobile; typed-answer path still ambiguous. |
| Resume/profile trust | 4 | 4 | = | Not re-audited in depth (profile carries tester PII — deferred to a synthetic account per run #8 note). |
| Dashboard/history/resume | 3 | 3 | = | **(live)** Counter/History mismatch persists (8% vs empty), fourth week. |
| Error/empty states | 3 | 3 | = | **(live)** Guest preview error honest on the left; right column still silently pre-click. `/history` empty state fine but *Go to Dashboard* still mis-routes. |
| Accessibility | 3 | 3 | = | **(live)** Skip-to-main + hamburger 44×44 confirmed. `aria-pressed` flag bug now confirmed (finding #5). `autocomplete=null` still open. Real keyboard-only + screen-reader pass still owed (seven audits). |
| Copy quality | 4 | 4 | = | **(live)** Hero, unified CTA, honest autosave all holding. "Cycle 1 of 3" interstitial copy still reads as from a different app. |

**Composite trend: 0 net (all rows unchanged).** Third consecutive flat week
in the scorecard — but this run converted the biggest unknown (why the
preview fails) into an actionable P0, and surfaced the Linear cap that was
silently blocking all issue intake.

## Regression check

| Item | State | Note |
|------|-------|------|
| Guest "Preview my prep" broken | **Root cause found — `research-preview` not deployed (404)** | Four consecutive weeks. Promoted to **P0**. One-command fix. Could not file (Linear cap). |
| **NEW: Linear workspace at free-issue cap** | **New blocker** | Directly explains the runs #6–#8 "recommended but never filed" pattern. |
| Breathing interstitial before Q1 | **Still broken — third consecutive week** | Could not file (Linear cap). |
| Interviews counter vs History mismatch | **Still broken — fourth consecutive week** | Held at 8% vs empty. Could not file (Linear cap). |
| `/new-interview` marketing hero | **Still open** ([PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111)) | **Ninth audit unshipped.** |
| Nav has no "Interviews" link + `/dashboard` collision | **Still open** ([PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101)) | **Ninth audit unshipped.** |
| `/history` "Go to Dashboard" → `/interviews` | **Still open** (part of PREPIO-101) | Fourth audit. |
| Password autocomplete missing on `/auth` | **Still open** ([PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123)) | Sixth audit. |
| Practice flag `aria-pressed` never updates | **Confirmed this run** | Owed probe from run #8 now landed. Could not file (Linear cap). |
| Flag coexistence (PR #233) | **Uncertain — possible regression** | Needs clean independent-click probe in run #10. |
| Save & Continue disabled on empty answer | **Resolved** ✅ | `disabled === true` verified. Run-#7 counter-honesty concern closed. |
| Mobile hamburger 44×44 | **Holding** ✅ | Verified. |
| Skip-to-main + focus outline | **Holding** ✅ | Seventh confirmation. |
| Landing hero + static Stripe example | **Holding** ✅ | Unchanged. |
| Autosave "Saving draft…" | **Holding** ✅ | Visible on Q1. |

**One fix resolved (Save & Continue disabled-on-empty). Zero of the
long-running P1/P2 findings shipped.** The dominant new fact is that issue
intake itself is blocked by the Linear cap.

## Recommended tickets

All four previously-recommended tickets plus the two new findings are
listed here in GitHub-ready form because **the Linear workspace is at its
free-issue cap and no new issue could be created this run.** Once the cap
is lifted (ticket 2), file these to Linear per CLAUDE.md conventions.

1. **[P0] Deploy the `research-preview` edge function** — it is absent from
   production (`404 NOT_FOUND`), breaking guest preview for four weeks.
   `npm run functions:deploy-single research-preview`, verify
   `verify_jwt=false`, smoke-test OPTIONS→200 + POST. Add a synthetic
   health check and a frontend static-example fallback on failure.
   *Project: Landing Page Framing · Type: Bug · area:landing.*
2. **[P1] Lift the Linear free-issue cap** (upgrade / trial / prune) so the
   audit→backlog workflow in CLAUDE.md can function again.
   *Project: Quality & Maintenance · Type: Chore · area:infra.*
3. **[P1] Remove the breathing interstitial from the default practice
   start** (or invert "Don't show again" + cap the gate at ≤5s and
   auto-advance). *Project: Quality & Maintenance · Type: Bug · area:practice.*
4. **[P2] Reconcile the Interviews "practiced" counter with History** —
   render in-progress sessions as a resume row in `/history` (preferred),
   or relabel the counter to "answered" with a tooltip.
   *Project: Quality & Maintenance · Type: Bug · area:practice.*
5. **[P2] Fix `aria-pressed` on the practice Favorite / Needs-work
   toggles** — bind it to the visual-fill state; add an RTL test per flag.
   *Project: Quality & Maintenance · Type: Bug · area:practice.*
6. **[P3] Add `autocomplete` attributes to `/auth` email + password
   inputs** — existing [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123),
   already filed; escalate. Sixth audit.

## Next-run focus

1. **Verify the `research-preview` deploy landed** — re-run the OPTIONS→200
   + POST smoke test and the live guest-preview flow. This is the single
   change that recovers the most first-touch value.
2. **Confirm the Linear cap is lifted and file tickets 1–5** — the backlog
   cannot move while intake is blocked.
3. **Clean flag-coexistence probe** — click *Favorite* and *Needs work*
   independently with a `waitForResponse` barrier; confirm both can be on
   at once (PR #233 regression check) and that `aria-pressed` tracks state.
4. **Budget a real authenticated research run end-to-end** — seven audits
   owed. Rotate to a fresh company (Palantir, Amazon).
5. **Real keyboard-only + screen-reader pass** — seven audits owed; fold in
   `aria-pressed` (ticket 5) and `autocomplete` (ticket 6).
6. **Empty-state coverage** — tester account still has one interview, so the
   truly-empty `/interviews` state is unreachable; use a scratch account.

`Capability: live browser verified`
