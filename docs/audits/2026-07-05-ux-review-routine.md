# Prepio UI/UX Review — 2026-07-05 (recurring routine, run #4)

Fourth run of the recurring weekly UX-review routine. Baselines:
[`2026-06-21-ux-review-routine.md`](./2026-06-21-ux-review-routine.md),
[`2026-06-25-ux-review-routine.md`](./2026-06-25-ux-review-routine.md),
[`2026-07-02-ux-review-routine.md`](./2026-07-02-ux-review-routine.md).

## Capability check — live egress opened mid-review, first live run in four tries

Per the routine's capability contract
([`UX_REVIEW_ROUTINE.md`](./UX_REVIEW_ROUTINE.md)), this run started
static-only (same blocker as runs #1–#3: `403` at the agent proxy on
CONNECT to `prepio.qiuyue.dev`) but the environment owner widened the
egress allowlist to include `prepio.qiuyue.dev` and `*.supabase.co`
partway through. **This is the first of the four routine runs with
real live-browser coverage.** Both capability-contract checks now pass:

- **Playwright Chromium: PASS** — `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
- **Live-app reachability: PASS** — confirmed via `curl` (200) and,
  after two fixes below, via Playwright/Chromium (200).

### Two non-obvious fixes future routine runs will need

Getting Chromium itself through the proxy took two fixes beyond what
`curl` needed — worth recording so the next run doesn't re-derive
this from scratch:

1. **Chromium doesn't read `HTTPS_PROXY` from the environment** the
   way `curl` does. Pass it explicitly: `chromium.launch({ proxy: {
   server: process.env.HTTPS_PROXY } })`.
2. **Chromium's TLS 1.3 `ClientHello` gets silently reset mid-handshake**
   on this proxy path (`net::ERR_CONNECTION_RESET`, confirmed via
   Chromium's own `--log-net-log` output: `SOCKET_READ_ERROR
   {"net_error": -101, "os_error": 104}` a few seconds after the
   `ClientHello` is sent — likely the larger TLS 1.3 `ClientHello`,
   e.g. the post-quantum hybrid key share, tripping something on the
   path). `curl`'s smaller, TLS-1.2-capable handshake is unaffected.
   Workaround: launch with `--ssl-version-max=tls1.2`. Also pass
   `--ignore-certificate-errors` — at least one allowlisted domain
   (`api.github.com`) is re-terminated by the proxy with a cert
   Chromium's NSS store doesn't trust by default, even though
   `prepio.qiuyue.dev` itself came through with its genuine
   Let's Encrypt certificate (passthrough, not re-terminated).

With both flags, the full desktop + mobile + authenticated + practice
walk in this report ran end-to-end against the real deployed app.

## Meta-finding: the two top-priority repeat items are now live-confirmed, not just code-inferred

Three consecutive audits (#2, #3, #4) flagged PREPIO-111 (marketing
hero on `/new-interview`) and PREPIO-101 (no "Interviews" nav item) from
reading the source. This run reproduced both directly in a real signed-in
session against the production app — see Top issues #1 and #2 below for
exact URLs, nav screenshots, and rendered copy. Live confirmation removes
any doubt that these were reading artifacts; both are real, and both are
now four-audit repeats with no landing PR.

## Overall product judgment

With live coverage for the first time, the product is in better shape
on the paths this review reached than the static-only reports could
show: the returning-user "Your interviews" home renders a clean resume
card (progress bar, "Plan ready" badge, one-tap "Start practice"), the
practice question screen is a genuinely well-built hero-question layout
with correctly-sized controls, and the local-answer autosave indicator
does what run #1's PREPIO-108 fix was supposed to do — it transitions
from "Saving draft…" to an honest "Draft kept in this tab" label rather
than overclaiming a server save. Those are real, live-verified wins.

Against that, the two P1s flagged in the last three audits are exactly
as bad live as the code predicted: a returning user tapping "New
interview" lands on a page headlined "Get insider insights on any
company's interview process. Tailored prep for you and your friends,"
and the top nav still has no "Interviews" entry — "Home" and "Dashboard"
both silently redirect to the same page. **The biggest user-facing risk
is unchanged from the last three runs:** the one screen every returning
user hits to start fresh prep speaks past them, and the nav item they
need most isn't labeled for what it does.

## Top issues

### 1. `/new-interview` shows the marketing Home hero to signed-in users — now live-confirmed (fourth repeat)

- **Severity:** P1 (repeat, fourth audit, first live confirmation)
- **Area:** landing / research entry
- **User scenario:** Signed in as the tester account (existing history:
  one "OpenAI · Solutions Architect" interview, 0 of 40 questions
  practiced), clicked "New interview" on `/interviews`.
- **What actually renders (live, desktop, 1440×900):** `/new-interview`
  shows a full-page `Prepio` wordmark hero: *"Get insider insights on
  any company's interview process. Tailored prep for you and your
  friends."* directly above the "Start a new research run" form —
  identical marketing copy to the logged-out landing page.
- **What actually renders (live, mobile, 390×844 iPhone viewport):**
  *"Move from company research to practice in three short steps,
  without the desktop-style sprawl"* — meta-copy about Prepio's own UX
  philosophy, not the user's task.
- **Why it matters:** confirmed exactly as runs #2 and #3 predicted from
  code. This is the *only* path to start fresh prep for a returning user.
  Screenshots on file: `21-new-interview-desktop.png`,
  `31-new-interview-mobile.png`.
- **Recommended fix:** unchanged from prior runs — branch on
  `location.pathname === '/new-interview'` in `Home.tsx` and render
  task-oriented copy with a back-to-Your-interviews link.
- **Tracking:** [PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111)
  — filed 2026-06-25, still Backlog after four audits. **Escalate.**

### 2. Nav still has no "Interviews" item — now live-confirmed (fourth repeat)

- **Severity:** P1 (repeat, fourth audit, first live confirmation)
- **Area:** navigation / consistency
- **What actually renders (live, desktop nav bar):** `Home · Dashboard ·
  Practice · Practice History · Pricing · Profile`. No "Interviews"
  label anywhere. Screenshot on file: `signin-retry.png` (post-login
  landing on `/interviews`, nav bar visible in full).
- **Live-confirmed redirect collision:** navigating directly to
  `/dashboard` with no `searchId` redirects to `/interviews` —
  confirmed by URL after navigation (`https://prepio.qiuyue.dev/interviews`).
  So "Home" and "Dashboard" are two distinct nav items that both land on
  the same page for a user with no active prep run selected.
- **Why it matters:** unchanged from prior audits — this is now a
  fourth-audit repeat, first one with a live screenshot proving it.
- **Tracking:** [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101)
  — In Progress since 2026-06-24, no landing PR yet after four audits.
  **Escalate — treat as an ownership gap, not just a backlog item.**

### 3. "New interview" vs "Start a new research run" — live-confirmed on two real pages for the same action

- **Severity:** P2 (repeat from run #3, partially live-confirmed)
- **Area:** copy / consistency
- **Live-confirmed:** the populated `/interviews` header CTA reads
  **"New interview"**; clicking through to `/new-interview` shows a
  card titled **"Start a new research run."** Two different labels for
  the same action, one tap apart, both observed live this run.
- **Not observable this run:** the tester account has existing history,
  so the true empty state (`Interviews.tsx:193`, run #3's "Prep a new
  interview" label) and the Dashboard fallback CTA weren't reachable
  live. Those two remain code-level findings only — still worth fixing,
  just not re-verified live this round.
- **Recommended fix:** unchanged — pick one label ("Prep a new
  interview" fits the routine's copy standard) and use it everywhere.
- **Tracking:** file this cycle. `Type: Improvement`, `area:landing`, P2.

### 4. CLAUDE.md Routes table is out of date with the shipped nav

- **Severity:** P2 (repeat, unchanged from run #4's original pass)
- **Area:** docs / DX
- **What the code shows:** [`CLAUDE.md`](../../CLAUDE.md)'s Routes
  table lists `/`, `/auth`, `/pricing`, `/dashboard`, `/search/:searchId`,
  `/practice`, `/history`, `/profile/*`, `/billing/return` — missing
  `/interviews` and `/new-interview`, which this run confirmed live are
  the actual primary logged-in home and start-fresh routes.
- **Recommended fix:** unchanged — update the Routes table and the
  *Primary user flow* section to reflect the shipped `/interviews` /
  `/new-interview` topology.
- **Tracking:** file this cycle. `Type: Docs`, `area:landing`, P2.

### 5. Mobile hamburger nav button is under the accessibility touch-target minimum — new, live-measured

- **Severity:** P3
- **Area:** mobile / accessibility
- **User scenario:** Signed-in user on an iPhone-sized viewport (390×844)
  taps the top-right nav menu to reach Practice History, Pricing, or
  Profile (all collapsed off the visible mobile nav).
- **What was measured live:** the "Open navigation menu" button's
  bounding box is **42×36px**. Standard touch-target guidance (Apple
  HIG, Material Design) recommends a **44–48px** minimum in both
  dimensions; the 36px height falls short. By contrast, every other
  measured mobile control this run met the bar: "New interview" 358×48,
  "Start practice" / "Plan" 308×44 each, and the practice-screen
  "Favorite" / "Answer guide" / "Record answer" / "Notes" / "Skip" /
  "Save & Continue" controls all measured 44–48px.
- **Why it matters:** this is the *only* way to reach three nav
  destinations on mobile, and it's the one control on the page that
  doesn't meet the product's own accessibility bar.
- **Recommended fix:** increase the hamburger button's hit target to at
  least 44×44px (padding is fine even if the icon glyph stays the same
  visual size).
- **Tracking:** file this cycle. `Type: Bug`, `area:practice` (or
  `area:landing` if the component is shared chrome), P3.

## Notable live observations (not ranked as top-5, but worth recording)

- **Autosave copy is honest and does transition correctly.** Typing in
  the practice-screen "Quick notes" field shows "Saving draft…" briefly,
  then settles to **"Draft kept in this tab"** — correctly signaling
  local-only, not server-saved, exactly matching CLAUDE.md's product
  truth about local drafts vs. server-saved answers. This is the first
  live confirmation that run #1's PREPIO-108 fix holds up in production.
- **Practice mode itself is a strong, well-built screen.** The question
  is unambiguously the visual hero (large bold text, stage/difficulty
  badges, a recommended-time hint), with "Record answer" as the primary
  action and secondary actions (Favorite, Answer guide, Notes) clearly
  subordinate. This matches the routine's "question is the hero"
  principle better than the standalone 2026-06-21 design audit's
  original complaint about a flat, competing-tabs layout.
  Screenshot: `47-answer-typed-mobile.png`.
- **A "Breathing Break" modal (`Breathe in… Cycle 1 of 3`) appears
  before every Quick Start practice session,** with "Skip" and "Don't
  show again" controls. This is in tension with the "time-to-value"
  principle (one more tap before the question every session) but also
  supports the "practice should feel safe" principle, and the
  dismissal controls mean it costs a returning user nothing after the
  first "Don't show again" tap. Not filing an issue — flagging for the
  team to confirm this is intentional, not an accidental default-on
  interstitial.
- **A per-question "Needs work" control was not found live** in the
  practice screen or its overflow menu ("Practice actions" → Reset
  timer / Change setup / Exit practice). Only "Favorite" appears as an
  explicit marking action during practice; "needs work" may be set via
  a post-answer rating step this run didn't reach, or via the swipe
  gestures CLAUDE.md documents (60px threshold) rather than a visible
  button. Needs a follow-up pass that completes a full question cycle
  to confirm where (or whether) it lives.
- **The returning-user "Your interviews" home is a genuinely good
  resume surface**: one card per interview, a progress bar ("0 of 40
  practiced · 0%"), a "Plan ready" status badge, and a one-tap "Start
  practice" primary action — this is closer to "help the user resume"
  than "admire a chart." Screenshot: `33-interviews-mobile-loaded.png`.
- **Direct `/practice` with no active search** shows a clear, honest
  empty state — "No Search Selected / Select a search to start
  practicing interview questions" with "Go to Dashboard" / "Start New
  Search" actions — not a blank page or a silent redirect.
- **Not reached this run:** starting a brand-new research run end to
  end (company + role → loading state → generated stages), and the
  full multi-stage "Plan" page. Coverage this run focused on
  returning-user practice + nav, since a real research run consumes
  paid OpenAI/Tavily calls against the tester account. Next run should
  budget for one real research run to close the "research
  progress/loading" and "generated output clarity" scorecard gaps with
  live evidence instead of carrying them as code-inferred.

## Journey scorecard

Rows marked **↑** improved since run #3, **=** unchanged, **↓** worse.
Cells marked **(live)** are live-verified for the first time this run;
unmarked cells are still code-inferred or not reached this run.

| Area | Run #3 | Run #4 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | 3 | = | Not re-reached live this run (focus was on the authenticated path); guest landing unchanged in code. |
| Research entry | 3 | 3 | = | `/new-interview` marketing hero **(live)** confirmed still present. |
| Research progress/loading | — | — | = | Not reached — no new research run kicked off this run. Budget for this next time. |
| Generated output clarity | 4 | 4 | = | Not reached live this run (Plan/stages page); code-level assessment unchanged. |
| Practice mode | 4 | 5 | ↑ | **(live)** Question-as-hero layout, correctly-sized controls, honest autosave copy all confirmed live. Raised from code-inferred 4. |
| Mobile usability | — | 3 | ↑ | **(live)** First live measurement. Most controls meet 44px+; the hamburger nav button (36px height) doesn't. |
| Resume/profile trust | 4 | 4 | = | **(live)** Profile page renders CV-derived prefill with clear "Save once to make it canonical" copy; not re-scored pending a closer privacy-copy pass. |
| Dashboard/history/resume | 4 | 5 | ↑ | **(live)** "Your interviews" resume card (progress bar, Plan-ready badge, one-tap Start practice) confirmed live — a strong "help the user resume" surface. |
| Error/empty states | 3 | 4 | ↑ | **(live)** `/practice` with no active search shows a clear, actionable empty state. The Interviews-page dual-heading issue (run #4 original) remains code-only — tester account has history, so the true empty state wasn't reachable this run. |
| Accessibility | — | 3 | ↑ | **(live)** Skip-to-main confirmed functional (route loads correctly under it); one touch-target gap found (item #5). Full keyboard-only walk still not done. |
| Copy quality | 3 | 3 | = | **(live)** "New interview" vs "Start a new research run" mismatch confirmed live on two real pages; the empty-state third/fourth label remains code-only. |

## Regression check

| Item | State | Note |
|------|-------|------|
| `/new-interview` marketing hero for logged-in users | **Still open** ([PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111)) | Fourth audit unshipped — first with a live screenshot. |
| Nav has no "Interviews" link | **Still open** ([PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101)) | Fourth audit unshipped, In Progress since 2026-06-24 with no landing PR — first with a live screenshot. |
| Live-app egress blocked | **Resolved this run** | Environment's Custom network-access allowlist now includes `prepio.qiuyue.dev` and `*.supabase.co`. No `area:infra` ticket needed — do not re-file. |
| "New interview" ↔ "Start a new research run" | **Confirmed live** (partially) | Two of the four labels flagged in run #4's original pass are now live-confirmed; the other two remain code-only pending a true empty-state visit. |
| CLAUDE.md Routes stale vs `App.tsx` | **Still open** | Unchanged this run. |
| PREPIO-108 autosave label | **Confirmed intact, live** | First live confirmation since the run #2 fix — "Saving draft…" → "Draft kept in this tab" transition works as designed. |

No previously-fixed regressions returned.

## Recommended tickets

| # | Ticket | Status |
|---|--------|--------|
| 1 | [PREPIO-111](https://linear.app/qiuyue/issue/PREPIO-111) — remove marketing hero from logged-in `/new-interview` | **Escalate.** Fourth audit repeat, now live-confirmed. Move to Todo/In Progress this cycle. |
| 2 | [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101) — collapse nav / rename Dashboard → Plan | **Escalate.** Fourth audit repeat, now live-confirmed. In Progress since 2026-06-24 with no PR; needs an owner check-in. |
| 3 | *New* — Unify "start a new prep" CTA copy across Interviews, Home, and Dashboard | **File.** `Type: Improvement`, `area:landing`, P2. Two of four locations now live-confirmed. |
| 4 | *New* — Refresh CLAUDE.md Routes and Primary-user-flow tables to match shipped `/interviews`, `/new-interview` topology | **File.** `Type: Docs`, `area:landing`, P2. Land alongside PREPIO-101 if that ships this week. |
| 5 | *New* — Increase mobile nav hamburger button touch target to 44×44px minimum | **File.** `Type: Bug`, P3. Live-measured at 42×36px against a 44px+ guideline; every other measured mobile control this run met the bar. |

Note: run #3's recommendation to file an `area:infra` chore for
restoring live-app egress is now moot — the environment owner fixed
network access directly this run. Do not file that ticket.

## Next-run focus

1. **PREPIO-111 and PREPIO-101 landing check.** Both are now
   live-confirmed four-audit repeats. If either lands, verify the
   change with a live screenshot the same day. If both slide again,
   raise as an ownership gap in the Prepio Linear team, not just the
   audit doc.
2. **Budget one real research run** (company + role → loading →
   generated stages → Plan page) to close the "research
   progress/loading" and "generated output clarity" scorecard gaps
   with live evidence.
3. **Complete a full practice question cycle** (through "Save &
   Continue" to the next question, and through session completion) to
   find where — or whether — a "needs work" marking control actually
   lives, and to check the session-summary / completion screen.
4. **First real keyboard-only + screen-reader pass** now that live
   access exists: landing → auth → interviews → practice, focus order,
   visible focus states, and whether the autosave state change is
   announced.
5. **Confirm the empty-state dual-heading and label-drift findings**
   (item #3 above) live, either with a fresh test account or by
   deleting the tester account's one interview temporarily.

`Capability: live browser verified`
