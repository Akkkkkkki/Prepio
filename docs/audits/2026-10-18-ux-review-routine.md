# Prepio UI/UX Review — 2026-10-18 (recurring routine, run #21)

Twenty-first run of the recurring weekly UX-review routine. Previous run:
[`2026-09-03`](./2026-09-03-ux-review-routine.md) (run #20). Earlier baselines of note:
[`2026-06-21`](./2026-06-21-ux-review-routine.md),
[`2026-07-30`](./2026-07-30-ux-review-routine.md),
[`2026-08-13`](./2026-08-13-ux-review-routine.md),
[`2026-08-30`](./2026-08-30-ux-review-routine.md).

## Capability check — FRONTEND LIVE, BACKEND NOT REACHABLE THIS RUN

This is a **partial-live** run. The logged-out / static frontend surface was exercised in a real
headless Chromium; the authenticated research→practice loop was **not reachable** because this
session's egress policy does not allow the Supabase backend host.

- **Playwright Chromium: PASS, no shim needed this run.** The pre-installed `chromium-1194`
  (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`) launched with a plain
  `proxy.server=$HTTPS_PROXY` and loaded `https://prepio.qiuyue.dev/` → **`200`**, title
  *"Prepio - Interview Prep Tool"*, **zero console errors**. (The 2026-09-03 run needed a local MITM
  shim for Chromium's TLS; this environment no longer does for the Vercel host. The attempted
  `cdn.playwright.dev` download in the session-start hook still 403s — irrelevant, the 1194 build is
  already on disk.)
- **Frontend (Vercel): PASS** — all logged-out routes below were loaded and screenshotted live.
- **Backend (Supabase): NOT REACHABLE** — `vjwrirrqprjzdorignlz.supabase.co:443` returns **`502` to
  CONNECT at the egress gateway** (the Vercel host returns `200`; `www.google.com` returns the
  gateway's `403`). The in-app sign-in therefore surfaced *"Failed to fetch"* with **no** HTTP
  response captured (a network-layer failure, **not** a `4xx` from Auth). **This is a per-session
  egress restriction, not evidence of a production outage** — the 2026-09-03 run reached the same
  host fine, and nothing in the repo changed the backend URL. Per the proxy contract I did not route
  around it. **Consequence:** login, text-answer save, the Favorite/Needs-work flag write, `/history`
  with real data, and mobile *practice* could **not** be re-verified live this run. Those findings are
  assessed from source + `docs/FREEZE_RELEASE.md` + carried from run #20, and are labelled
  `(code/doc; not live this run)`.

**What IS live-verified this run (frontend):** logged-out landing (desktop 1440×900 + mobile
iPhone-13 390×844), the *View sample plan* static expansion (**no network calls fire**), `/auth`
(the **frontend** signup surface — no Sign Up tab, invite-only copy — plus input autocomplete + labels
measured directly; **backend** signup enforcement was **not** verifiable this run), `/pricing` (now `404`), protected-route
redirect `/practice`→`/auth` (intent banner preserved), `/new-interview` + `/profile` logged-out
behaviour, and mobile touch-target sizes on the landing chrome. Screenshots (all logged-out,
PII-free) under [`assets/2026-10-18/`](./assets/2026-10-18/).

## The headline: the freeze surface-lock shipped — last run's standing P0 is resolved on the frontend

Since run #20 (2026-09-03), the single change every prior review treated as the top blocker **landed**:

- **`9d9b711` / #354 / [PREPIO-27](https://linear.app/qiuyue/issue/PREPIO-27) — "lock Prepio to the
  invite-only frozen core"** (2026-09-22). −1646/+629 lines across `Home`, `Practice`, `Auth`,
  `Navigation`, `App`, plus a new static `GuestSample.tsx` and a hard `src/lib/frozenProduct.ts`
  boundary (`billing/answerFeedback/voice/profile/resumeUpload = false`, "deliberately not overridable
  by a browser or environment flag").
- **`bccb67c` / #360 — "close freeze gaps found by the final audit and UX reviews"** (2026-10-02):
  hardened the invite/recovery auth flow to show an **honest expired-link error** instead of a
  password form for a session-less link (PREPIO-30 acceptance item).
- **`8696991` / #363 / [PREPIO-180](https://linear.app/qiuyue/issue/PREPIO-180)** (2026-10-14): added
  a quiet CV-persistence disclosure under the `/new-interview` paste box.

**Four findings from run #20 are addressed on the frontend and live-verified there** (details in
Regression check): the guest-preview CTA that fired a doomed `research-preview` call and **blanked the
page's best proof** is gone (static sample, zero network calls); the public **Sign Up** tab is gone and
`/auth` shows invite-only copy (**frontend surface only** — whether production Supabase Auth actually
rejects a direct, non-UI signup request is the PREPIO-30 §2 release gate and was **not** verified this
run, since the backend was unreachable); `/auth` inputs now carry `autocomplete="email"` /
`current-password` (the P2 that had repeated for **15 audits**); and the `/pricing` page with dead
checkout CTAs is unrouted (now `404`).

## Overall product judgment

**This is the strongest week in this review's history: the product got better by getting smaller.**
The four-month gap between "shipped in repo" and "what a visitor can actually do" is closed on the
frontend — the guest surface is now a fast, honest, fully static sample that makes **zero** backend
calls, sign-up is invite-only with calm "ask whoever invited you" copy, the dead billing surface is
gone, and the 15-audit autocomplete bug is finally fixed. Nothing a logged-out visitor touches is
broken, which has not been true before. The one real new friction is that the landing now hides its
**only** output proof-point behind a *View sample plan* click, and the revealed sample is a
deliberately generic *"Payments company · Product Manager"* fiction — so a first-time (invited)
visitor gets a flatter "why is this better than ChatGPT" story than the prior build's role-specific
example. The highest-severity *open* defect is unchanged and outside the frontend's reach: the
**Favorite / Needs-work flag write**, last live-confirmed returning `42P10` in production on
2026-09-03. The fixing migration is written and authorised but was still unapplied at the last
recorded production baseline (2026-09-21), gated behind the owner-attended freeze deploy
(PREPIO-124/170), and no commit since has touched the flag path. **Caveat:** a migration can be
applied without any frontend commit, so the repo history cannot prove the *current* (2026-10-18)
production state, and the backend was unreachable this run — this is the **last verified state, not a
confirmed current failure**, and needs a live schema or write check to settle.

## Top 5 issues

### 1. **P1 (carried; code/doc, not live this run) — Favorite/Needs-work flag write last verified returning `42P10` in production; the fixing migration is written and authorised but was unapplied at the last baseline**

- **Severity:** P1 — a core practice-triage affordance that was last live-confirmed failing 100% of
  the time in production (`400 / 42P10`, 2026-09-03), with a red error toast. **Current (2026-10-18)
  production status is unverified** (backend unreachable); a migration could have been applied since
  without any frontend commit, so this severity reflects the last verified state pending a live check.
- **Area:** practice
- **User scenario:** during practice a user taps **Favorite** (or **Needs work**) to mark what to
  revisit.
- **Status this run:** **not live-verified** (backend unreachable). Assessed from source + the freeze
  doc:
  - The upsert (`src/services/searchService.ts:1765`) uses `onConflict: 'user_id,question_id,flag_type'`.
  - The matching migration **exists** —
    `supabase/migrations/20260710203000_question_flags_per_type.sql` drops the two-column key and adds
    `UNIQUE (user_id, question_id, flag_type)`.
  - **No commit since run #20 touches the flag path** — so the only thing that fixes it is *applying*
    that migration, which `docs/FREEZE_RELEASE.md` gates behind the attended deploy (§2.5). The
    doc's "Live baseline checked 2026-09-21" records that production **still** has
    `UNIQUE(user_id, question_id)`, not the three-column key, and CLAUDE.md states production "remains
    unreconciled" until PREPIO-124/170 have verified evidence.
- **Why it matters:** favorites / needs-work is how a time-pressured user decides what to practise
  next; a visible control that never persists erodes trust in whether *anything* persists.
- **Recommended fix:** apply `20260710203000_question_flags_per_type.sql` in the PREPIO-124 freeze
  window (run the `(user_id, question_id, flag_type)` duplicate-group precheck first — do not silently
  dedupe user data); then live-verify both flags persist across a reload on desktop and mobile.
- **Tracking:** [PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170) (Urgent) within
  [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124). No new issue.

### 2. **P2 (new; frontend live-confirmed) — The frozen landing hides its only proof-point behind a click, and the revealed sample is generic — weakening the research differentiator**

- **Severity:** P2 — first-time understanding / top-of-funnel. Not broken, but it under-sells the one
  thing that separates Prepio from a generic chatbot.
- **Area:** landing / first-time understanding
- **User scenario:** an invited user (or anyone with the link) opens `/` before signing in and spends
  ~30s deciding what Prepio is and whether it is worth their time.
- **What happened (live):** the hero is a flat *"Prepare for your next interview"* with a
  *Free · Invite-only* badge and a prose summary. The **only** example of real output sits **collapsed**
  behind a *View sample plan* button; nothing demonstrates the product until the user clicks. When
  expanded, the sample is an *"Illustrative sample · Payments company · Product Manager"* with three
  prompts and a one-line *focus* each, explicitly captioned *"A fictional example … not verified
  questions from a particular employer."* It reads as competent generic interview prep, not as
  *company-and-role-specific, research-driven* prep.
  [`01-d-landing.png`](./assets/2026-10-18/01-d-landing.png) (collapsed, desktop),
  [`01b-d-sample.png`](./assets/2026-10-18/01b-d-sample.png) (expanded, desktop),
  [`04-m-landing.png`](./assets/2026-10-18/04-m-landing.png) (mobile).
- **Why it matters:** run #20's landing showed a **role-specific** example (a named-company Senior PM
  set with stage + difficulty + a concrete *"why it matters"*) **by default**. That was the page's
  strongest asset; its only flaw was that clicking the CTA destroyed it. The freeze correctly removed
  the broken network path — but it also removed the default-visible, role-specific proof. The product
  strategy is explicit that the research pipeline (company + role + CV → questions that feel like
  someone who interviewed there wrote them) is the moat; the landing no longer *shows* that moat
  without a click, and then shows a deliberately generic stand-in. A collection/entry surface should
  give value *before* asking — here the value (the example) is one click further away than it was.
- **Recommended fix (frontend-only, in scope — the surface is already frozen, this is polish on it):**
  default the sample to **expanded** (it's static and free to render), and reframe it so it reads as
  *role-tailored* while staying honestly fictional — e.g. keep the "illustrative/fictional" caption
  but restore the per-question *stage + difficulty + why-it-matters* structure the old example had, so
  a first-timer sees *what personalised output looks like* without signing in. Keep it one fictional
  role; do not add a second collection point.
- **Tracking:** no existing issue covers the post-freeze landing specifically. **GitHub/Linear-ready
  draft in Recommended tickets** (candidate for the PREPIO-27 landing follow-up / Quality &
  Maintenance). Not filed from this automated run — see note there.

### 3. **P3 (carried; frontend live-confirmed) — Sub-44px "Sign in" nav target on mobile**

- **Severity:** P3 — external 44px ergonomic recommendation; passes WCAG 2.5.8 AA (24px).
- **Area:** landing / accessibility (mobile)
- **What happened (live, 390×844):** the header **Sign in** link measures **71×36**. The primary
  **View sample plan** button is fine (149×44). With the pre-freeze nav stripped down, *Sign in* is
  now essentially the only sub-44px control on the pre-signup surface.
  [`04-m-landing.png`](./assets/2026-10-18/04-m-landing.png)
- **Why it matters:** it is the first control a mobile visitor may tap; 36px is a small one-handed
  target. Low impact, cosmetic.
- **Recommended fix:** bump the header auth link to ≥44px min-height. Below the >30-min ticket
  threshold — fold into any landing pass (e.g. the issue #2 fix).

### 4. **P3 (new; frontend live-confirmed) — Old `/pricing` and `/profile` URLs hard-404 rather than a tailored "not part of the current release" page**

- **Severity:** P3 — polish / recognition. Technically satisfies the freeze acceptance gate, which
  only requires these URLs to "show unavailable/404 without backend work" (PREPIO-30).
- **Area:** copy / error states
- **What happened (live):** `/pricing` and `/profile` both render the generic
  *"404 — Oops! Page not found — Return to Home"* (confirmed logged-out; `/profile` is unrouted and
  falls through to `NotFound`). [`03-d-pricing.png`](./assets/2026-10-18/03-d-pricing.png)
- **Why it matters:** an existing/returning account may have bookmarked `/profile` (it was a real
  page) or `/pricing`; a bare 404 reads as "the app is broken" rather than "this isn't part of the
  current free release." The gate accepts a 404, so this is genuinely optional — but a one-line
  tailored message would be warmer and on-brand ("honest about limitations").
- **Recommended fix (optional):** for the specifically-removed routes, a short "This isn't part of the
  current Prepio release" message with a *Return to Home* link, instead of the generic 404. Below the
  ticket threshold; noted for the owner's judgement during the freeze acceptance pass.

### 5. **P3 (carried; NOT re-verified live this run) — `/history` shows the empty state despite real in-progress practice**

- **Severity:** P3 — visibility-of-status / returning-user trust.
- **Area:** history / dashboard
- **Status this run:** **not live-verified** (backend unreachable). Carried from run #20, where
  `/history` rendered *"Ready to start practicing…"* for an account with two in-progress interviews
  and real `practice_answers` rows. Defensible if "history" = *completed* sessions only, but the
  disconnect reads as a bug to a user who has answered questions.
- **Recommended fix:** surface in-progress sessions on `/history`, or make the empty-state copy
  explicit that it lists *completed* sessions and point to `/interviews` for in-progress work.
- **Tracking:** [PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107) (In Progress). No new issue.

## Notable live observations (not top-5)

### Positives — live-verified this run (the frozen frontend is in genuinely good shape)

- **Guest surface is fully static — zero backend calls.** On `/`, *View sample plan* expands the
  fictional example entirely client-side; the request monitor recorded **no** `functions/v1`,
  `supabase.co`, `research-preview`, or any network call, and **zero console errors**, on both desktop
  and mobile. This is exactly the PREPIO-27 intent and the direct fix to run #20's P0.
- **Invite-only auth, honest copy (frontend surface only).** `/auth` has **no Sign Up tab**
  (`hasSignUpWord: false`): *"Prepio
  is free and invite-only. Sign in with your invited account. Ask the person who invited you if you
  need access."* [`02-d-auth.png`](./assets/2026-10-18/02-d-auth.png) **Caveat:** this confirms only
  that the *frontend* exposes no signup path; verifying production Supabase Auth rejects a direct
  (non-UI) signup request is the PREPIO-30 §2 gate and remains **unverified** (backend unreachable).
- **Autocomplete fixed (closes the 15-audit P2).** `#signin-email` → `autocomplete="email"`,
  `#signin-password` → `autocomplete="current-password"`, each with exactly one associated `<label>`.
- **Protected-route redirect preserves intent.** Logged-out `/practice` → `/auth` with the banner
  *"Continue to Practice."*; `/new-interview` → `/auth`. (Captured live.)
- **No horizontal overflow at either breakpoint.** `scrollWidth == clientWidth` at 1440 and at 390;
  single `<h1>` *"Prepare for your next interview"* on both.
- **Billing/profile/voice/import are hard-disabled at the code boundary** (`frozenProduct.ts`) and
  unrouted (`App.tsx` has only `/auth`, `/`, `/interviews`, `/new-interview`, `/dashboard`,
  `/practice`, `/history`, `/search/:searchId`, `*`). `/pricing` and `/profile` 404 live.
- **CV-persistence disclosure is honest and well-judged (#363).** The one remaining CV-collection
  surface (`/new-interview` paste box) now carries *"Your CV text is saved privately with this prep
  plan and used to personalize your questions."* — accurate about persistence, no self-serve-delete
  promise the frozen core can't keep, and no "help us improve" cost-shifting framing. (Code-verified;
  the surface itself is behind auth, not exercised live.)

### Carried / code-confirmed (not reachable live this run)

- **Auth expired/reused invite & recovery links now show an honest link-error instead of a password
  form** (#360, `useAuth.ts` `authLinkError`) — a PREPIO-30 acceptance item. Code-verified; needs a
  live invite/recovery link to confirm end-to-end.
- **Practice heading structure** (question as `<h1>` on both breakpoints, #329/PREPIO-178, Done at
  run #20) and **text-answer save `201`** — carried; not re-verified live (backend).

## Journey scorecard

Frontend-only live coverage this run; rows that depend on the backend are carried and tagged. Two
rows move up on frontend improvements that landed since run #20.

| Area | 2026-09-03 | 2026-10-18 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | **4** | **▲** | **(live)** The P0 broken guest CTA that blanked the example is **gone**; nothing a visitor touches is broken. Held below 5 by the proof-point now being collapsed behind a click and the sample being generic (issue #2). |
| Research entry | 4 | 4 | = | **(code; frozen form not reachable live)** CV-paste surface now discloses persistence (#363); form otherwise unchanged + appropriately trimmed for the freeze. |
| Research progress/loading | 5 | 5 | = | **(carried, code)** Async modal unchanged; not re-triggered (would spend provider budget). |
| Generated output clarity | 5 | 5 | = | **(carried; not live this run)** Plan/stage/question structure strong; last live-verified run #20. |
| Practice mode | 4 | 4 | = | **(carried; not live this run)** Question-as-hero + text save carried; held at 4 by the flag-write `42P10` (issue #1), last verified broken in production (2026-09-03) — current status unverified this run. |
| Mobile usability | 4 | 4 | = | **(landing live-clean; practice carried)** Landing-mobile: no overflow, single `<h1>`, primary CTA ≥44px. Sub-44px *Sign in* nav target remains (issue #3). |
| Resume/profile trust | 4 | 4 | = | **(code)** The one CV surface now has honest persistence copy (+); the standalone profile feature is deliberately frozen out. Net flat. |
| Dashboard/history/resume | 3 | 3 | = | **(carried; not live this run)** `/history` empty-vs-in-progress parity still open (issue #5, PREPIO-107). |
| Error/empty states | 4 | **5** | **▲** | **(live + code)** Guest preview no longer **blanks** anything (the thing holding this at 4 is gone); `/pricing`+`/profile` 404 cleanly; auth now shows an honest expired-link error (#360). Minor: the 404 is generic (issue #4). |
| Accessibility | 4 | 4 | = | **(live)** Autocomplete P2 **fixed** (▲, 15-audit finding closed), focus rings + labels + single-`<h1>` + no-overflow all verified on landing/auth. **Held at 4 only because the practice-screen a11y could not be re-verified live this run** (backend). Sub-44px nav target remains. |
| Copy quality | 4 | 4 | = | **(live + code)** Invite-only, guest-sample, and CV-disclosure copy are calm, specific, honest. Generic 404 on removed routes is the one off-note (issue #4). |

**Composite: up two (First-time understanding 3→4, Error/empty states 4→5), zero regressions.** Both
movers are direct consequences of the freeze surface-lock landing. The practice/flag/history rows are
held flat pending a live backend re-verification once this session (or the owner) can reach Supabase.

## Regression check

Since run #20, the dominant change is the freeze surface-lock (#354) plus follow-ups (#360, #363) and
infra/test/docs chores. **Net: four user-facing fixes, zero code regressions.**

| Item | State | Note |
|------|-------|------|
| Guest preview (was P0: fired `research-preview`, CORS-failed, blanked the example) | **Fixed** ✅ | Now a static `GuestSample`; **zero** network calls, zero console errors (live). (#354 / PREPIO-27) |
| Public Sign Up tab (freeze wanted invite-only) | **Frontend fixed** ✅ | No Sign Up tab; invite-only copy (live). Backend signup enforcement (PREPIO-30 §2) **not verified** this run. (#354) |
| `/auth` autocomplete `null` (P2, **15 audits**) | **Fixed** ✅ | `email` / `current-password` now set (live). (PREPIO-123 direction) |
| `/pricing` dead checkout CTAs | **Fixed** ✅ | `/pricing` unrouted → `404` (live). (#354) |
| Auth expired/reused link → password form | **Fixed** ✅ | Honest link-error instead (#360). Code-verified. |
| CV paste surface had no persistence disclosure | **Fixed** ✅ | Honest one-line disclosure added (#363 / PREPIO-180). Code-verified. |
| Practice question heading structure | **Holding** ✅ | `<h1>` on both breakpoints (carried from #329). |
| Favorite/Needs-work flag write | **Last verified broken** ❌ | `42P10` last confirmed 2026-09-03; migration written + authorised, **unapplied** at the 2026-09-21 baseline (owner-gated deploy). Current status unverified this run. (Issue #1 / PREPIO-170) |
| `/history` vs in-progress parity | **Still open** ⚠️ | Carried; not re-verified live. (Issue #5 / PREPIO-107) |
| Landing proof-point visibility | **New friction** ⚠️ | Role-specific default example replaced by a collapsed, generic fictional sample (issue #2). |

## Recommended tickets

Consistent with run #20 and the CLAUDE.md freeze posture ("Do not add features, recurring audits…"),
and because this is an **unattended scheduled run**, I am **not** unilaterally filing new Linear/GitHub
issues. Existing findings map to open issues; the one genuinely new finding is written below in
GitHub/Linear-ready form for the owner to file or fold into existing work.

1. **[P1] Apply `20260710203000_question_flags_per_type.sql`** in the attended freeze deploy so the
   Favorite/Needs-work upsert stops returning `42P10` (duplicate-group precheck first; no silent
   dedupe). → existing **[PREPIO-170](https://linear.app/qiuyue/issue/PREPIO-170)** within
   **[PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124)**.
2. **[P2] Show the guest sample by default and make it read role-specific (new — draft to file).**
   *Title:* "Default the frozen landing's sample to expanded and restore a role-specific structure."
   *Body:* On `/`, the static `GuestSample` is collapsed behind *View sample plan* and, when opened,
   reads as a generic "Payments company · Product Manager" fiction. Default it to expanded (it is
   static — no cost) and restore the per-question *stage + difficulty + why-it-matters* structure the
   pre-freeze example had, so a first-time/invited visitor sees what *personalised* output looks like
   without signing in — while keeping the honest "illustrative/fictional" caption. Keep it a single
   fictional role; add no second collection point. *Area:* `area:landing`. *Type:* Improvement.
   *Project:* Quality & Maintenance (or fold into the PREPIO-27 landing follow-up). Cross-link this
   review. → **candidate, not filed from this run.**
3. **[P3] `/history` in-progress parity (or clarify empty-state scope).** → existing
   **[PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107)**.

### Deferred / below threshold (per CLAUDE.md hygiene convention)

- Sub-44px *Sign in* mobile nav target (issue #3) and the generic-404-on-removed-routes polish
  (issue #4) are below the >30-min ticket threshold; fold into the issue-#2 landing pass and the
  freeze acceptance pass respectively.
- **No new Linear issues filed this run.** All confirmed findings map to PREPIO-170/124 and
  PREPIO-107; the one new finding (issue #2) is left as a GitHub/Linear-ready draft above for the
  owner, matching run #20's "map to existing, don't fragment" posture.

### Owner follow-up this run specifically asks for

- **Re-verify the authenticated loop live** (login, text save, both flag writes persist across reload,
  `/history` with data, mobile practice) from an environment that can reach Supabase — this run could
  not (per-session egress block, not a known outage). The flag-write `42P10` fix in particular needs a
  post-deploy live check.

---

Capability: frontend live browser verified; backend (Supabase) not reachable this run — authenticated
findings are code/doc-based and carried, labelled inline.
