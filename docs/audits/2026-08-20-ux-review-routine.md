# Prepio UI/UX Review — 2026-08-20 (recurring routine, run #16)

Sixteenth run of the recurring weekly UX-review routine. Baselines:
[`2026-06-21`](./2026-06-21-ux-review-routine.md),
[`2026-06-25`](./2026-06-25-ux-review-routine.md),
[`2026-07-02`](./2026-07-02-ux-review-routine.md),
[`2026-07-05`](./2026-07-05-ux-review-routine.md),
[`2026-07-09`](./2026-07-09-ux-review-routine.md),
[`2026-07-12`](./2026-07-12-ux-review-routine.md),
[`2026-07-16`](./2026-07-16-ux-review-routine.md),
[`2026-07-19`](./2026-07-19-ux-review-routine.md),
[`2026-07-23`](./2026-07-23-ux-review-routine.md),
[`2026-07-26`](./2026-07-26-ux-review-routine.md),
[`2026-07-30`](./2026-07-30-ux-review-routine.md),
[`2026-08-02`](./2026-08-02-ux-review-routine.md),
[`2026-08-06`](./2026-08-06-ux-review-routine.md),
[`2026-08-09`](./2026-08-09-ux-review-routine.md),
[`2026-08-13`](./2026-08-13-ux-review-routine.md).

## Capability check — PARTIAL LIVE (frontend reachable, backend blocked)

This run is a **partial-live** review. Read the scope honestly before trusting any
verdict below:

- **Playwright Chromium: PASS** — `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
  (explicit `executablePath` + `--ssl-version-max=tls1.2` + `--ignore-certificate-errors`
  + explicit `proxy.server` from `HTTPS_PROXY`; standing gotchas).
- **Frontend (Vercel) reachability: PASS** — `curl … https://prepio.qiuyue.dev/` → `200`.
  All logged-out frontend surfaces rendered and were fully testable.
- **Backend (Supabase) reachability: FAIL — environment egress policy.** The Supabase
  project host `vjwrirrqprjzdorignlz.supabase.co` is **unreachable from this review
  session**: the agent egress proxy answered **`502 to CONNECT vjwrirrqprjzdorignlz.supabase.co:443`**
  (`curl … /__agentproxy/status` → `recentRelayFailures`), and every direct request to
  `…/auth/v1/health`, `…/rest/v1/`, and all 12 `…/functions/v1/*` endpoints returned
  `000` (connection refused at the tunnel) across repeated retries. In the browser this
  surfaces as `net::ERR_TUNNEL_CONNECTION_FAILED`. Per the environment README this is an
  **organization egress-policy / upstream condition to report, not retry around** — never
  disable TLS or unset `HTTPS_PROXY`.

**What this means for scope:** anything that depends on Supabase could **not** be
exercised or verified this run — this includes **login** (`signInWithPassword` fails at
the network layer, so no authenticated coverage at all), the **guest preview** result,
**research runs**, **practice**, **flag writes**, **profile/CV**, **history**, **checkout**,
and — critically — the **P0 backend-deploy state itself** (last run's OPTIONS-preflight
probe is impossible here because the host won't `CONNECT`). Those items are **carried
forward as "unverified this run — backend unreachable,"** neither confirmed fixed nor
re-confirmed broken.

**What IS live-verified this run:** everything client-side on the Vercel frontend —
logged-out landing (desktop 1440×900 + mobile 390×844), guest form validation, `/auth`
(field/label/autocomplete DOM, redirect-context copy), `/pricing`, `/404`, all
protected-route → `/auth` redirects, heading semantics across four routes, mobile layout
(overflow, touch-target geometry), keyboard tab order + focus-visible styling, text
contrast sampling, and 200%-zoom reflow. Findings from source code are labelled as such.
Screenshots (all logged-out, no PII) under [`assets/2026-08-20/`](./assets/2026-08-20/).

## Overall product judgment

**A frontend-only week by necessity — the review environment could not reach the
Supabase backend, so the entire authenticated core loop (login → research → practice)
and the standing P0 deploy question are unverifiable this run; the logged-out frontend,
however, is in good shape and the review surfaced a cluster of concrete, fixable
accessibility gaps on the highest-traffic page.** The landing page remains strong and
on-message — the "Research-first interview prep / Walk into your next interview knowing
exactly what to expect" hero, the honest *"No resume needed. No account needed for
preview,"* the *disabled-until-a-company-is-typed* Preview CTA (good error prevention),
the strong static Stripe example, the excellent contextual redirect copy
(*"Sign in to access your interview research, practice history, and saved prep. …
Continue to Practice."*), and honest three-cadence pricing all hold. But the landing
page — the one surface a first-time job seeker judges before signing up — has three
real, independently-fixable accessibility defects: **it ships no `<h1>` at all** (the
hero is an `<h3>` and the heading order runs h3→h3→h2), its **muted body copy sits at or
just below the 4.5:1 AA contrast floor** (measured 4.35–4.42 on the off-white cards, on the very "why it matters"
lines that carry the personalization proof), and several **mobile controls fall below the
44px touch-target baseline**. None block use, but together they weaken the first
impression for keyboard/screen-reader/low-vision users and one-handed mobile users — the
exact audience this product courts. The `/auth` autocomplete gap is **still unfixed and
re-confirmed live (11th audit)** with PR #244 still unmerged. The highest-value action
remains what it has been for weeks — **one attended backend deploy** — but this run
cannot re-attest its state; the most valuable action *within this run's reach* is the
landing-page accessibility cluster, which is small, self-contained, and improves the
first thing every new user sees.

## Top 5 issues

### 1. **P0 (carried, UNVERIFIED this run) — Production backend deploy state could not be checked; the environment cannot reach Supabase**

- **Severity:** P0 if still broken (it gates guest conversion, monetization, and the
  practice flag write) — but this run neither confirmed nor refuted it.
- **Area:** infra / deployment (fans out to landing guest-preview, billing, practice)
- **What happened (this run):** the Supabase host `vjwrirrqprjzdorignlz.supabase.co` is
  unreachable from the review session (egress proxy `502 to CONNECT`; all direct probes
  `000`). The guest-preview POST *did* fail in-browser (*"We couldn't build the preview.
  Try again, or sign in…"* + `ERR_TUNNEL_CONNECTION_FAILED` on `research-preview`), **but
  that failure is indistinguishable from the environment block** — it is not usable as
  evidence that the function is undeployed this run. The 2026-08-13 run's clean
  OPTIONS-preflight technique (5×200 / 7×404 gateway split) is impossible here because the
  gateway won't complete a `CONNECT` to the host at all.
- **Why it matters:** the standing P0 (guest→signup and free→paid funnels + the practice
  flag write dead in production, on record for 8 weeks as of 2026-08-13) remains the
  highest-severity item — but honesty requires marking it **unverified this run**, not
  carrying its status as if freshly checked.
- **Recommended fix (maintainer, attended):** unchanged from 2026-08-13 issue #1 —
  reconcile migration history + pre-check duplicate `(user_id, question_id, flag_type)`
  rows, `npm run db:push`, `npm run functions:deploy`, smoke-test each recovered surface,
  add a deploy-parity/health check.
- **Tracking:** [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124) (Urgent, Backlog).
- **Next-run action:** re-probe from an environment that can reach `*.supabase.co`
  (OPTIONS preflight or `list_edge_functions`/`list_migrations`) before re-asserting the
  freeze as current.

### 2. **P2 (NEW, live-verified) — Landing page has no `<h1>` and a broken heading hierarchy**

- **Severity:** P2 (WCAG 2.4.6 Headings and Labels / 1.3.1 Info and Relationships; degrades
  screen-reader navigation on the single most important first-impression page)
- **Area:** accessibility / landing
- **User scenario:** A screen-reader or keyboard user lands on `/` logged out and tries to
  orient by pulling up the page's headings.
- **What happened (live, `/`):** the page contains **zero `<h1>` elements**
  (`document.querySelectorAll('h1').length === 0`, measured on desktop and mobile). The
  visual hero *"Walk into your next interview knowing exactly what to expect"* is an
  `<h3>`; the static-example title *"How Stripe Senior Product Manager questions look in
  Prepio"* is also `<h3>`; *"How it works"* is an `<h2>`. So the document has **no top-level
  heading and the levels run h3 → h3 → h2** (a jump that skips h1/h2 then goes *up* a level).
  By contrast `/pricing` does it correctly (`<h1>` = *"Add AI feedback when practice needs a
  sharper coach"*), and `/404` and `/auth` each expose one `<h1>` — so the landing page is
  the isolated outlier. [`01-d-landing.png`](./assets/2026-08-20/01-d-landing.png).
- **Why it matters:** heading navigation is a primary screen-reader wayfinding tool; a page
  with no `<h1>` announces no title-level anchor, and an out-of-order hierarchy misrepresents
  the page structure. This is the page that decides whether a new user trusts the product.
- **Recommended fix:** promote the hero headline to `<h1>` and normalise the outline
  (`<h1>` hero → `<h2>` "How Stripe … look in Prepio" and "How it works" → `<h3>` for the
  per-question stage labels). Mirror the pattern `/pricing` already uses.
- **Evidence:** Desktop Chrome 1440×900 + mobile 390×844, `/`, heading-enumeration probe.

### 3. **P2 (NEW, live-verified) — Muted landing body copy sits at/below the 4.5:1 AA contrast floor**

- **Severity:** P2 (WCAG 1.4.3 Contrast Minimum, AA; affects the personalization-proof copy)
- **Area:** accessibility / landing / copy
- **User scenario:** A low-vision user, or anyone on a dim phone screen outdoors, reads the
  landing page to decide whether Prepio is worth signing up for.
- **What happened (live, `/`):** the warm-grey muted text color `rgb(127, 117, 108)`
  (`--muted-foreground`) is used both on **pure white** (the hero column / `--card #fff`) and
  on the **slightly off-white** card/`--background` (`rgb(251,251,250)`–`rgb(253,253,252)`).
  With alpha-composited backgrounds measured directly, the split is:
  - **On pure white — borderline PASS:** the sub-hero *"Tell us the company…"* (16px) and the
    *"No resume needed…"* line (12px) both measure **4.50:1** — meeting the 4.5 AA floor by a
    hair.
  - **On the off-white card/background — genuine AA FAIL:** the static-example lead *"Each
    question comes with the stage, difficulty, and why it matters…"* (14px) = **4.35:1**, the
    *"Why it matters — …"* explanation bodies (12px) = **4.42:1**, and *"Generated from public
    signals · Glassdoor, LinkedIn…"* (12px) = **4.35:1**. All three fall below 4.5:1 for
    normal-weight text this size.
  - (The bolded *"Why it matters —"* lead-in is a darker `rgba(45,41,37,0.7)` at ~14:1 and is
    fine — it is the explanatory *body* that falls short.)
- **Correction / evidence note:** an earlier draft of this finding reported **4.06:1** for the
  static-example lead and framed the range as "4.06–4.50 across the page." That 4.06 figure was
  a **compositing artifact** — the first-pass probe treated the element's translucent
  `rgba(244,243,241,0.2)` background as opaque instead of compositing it (≈ white). Re-measured
  with proper alpha compositing, that element is **4.35:1**. **Thanks to Codex (PR #303 review)
  for catching this.** The finding is accordingly narrowed: the muted token *passes on pure
  white (4.50)* and *fails only on the off-white card/`--background` (4.35–4.42)* — so this is a
  targeted contrast bug on those surfaces, not a blanket page-wide failure.
- **Why it matters:** the "why it matters" and "generated from public signals" lines are exactly
  where Prepio proves its research is specific rather than generic; on the off-white cards they
  are the hardest text on the page to read, so the product's core differentiator is the first
  thing to disappear for low-vision users.
- **Recommended fix (targeted):** darken `--muted-foreground` by one step for body text on the
  card/`--background` surfaces (target ≥4.5:1 with margin — e.g. move `rgb(127,117,108)` toward
  `rgb(112,103,94)` or darker), or reserve the current grey for ≥18px / bold text. A small,
  token-level change scoped to the failing surfaces clears all three without touching the
  already-passing white-background text.
- **Evidence:** Desktop Chrome 1440×900, `/`, computed-style contrast sampling with per-element
  alpha compositing of the effective background.

### 4. **P2 (REPEAT, 11th audit, live-verified) — `/auth` sign-in fields still have no `autocomplete` attributes**

- **Severity:** P2 (held; genuine unfixed bug in `main`, not deploy lag)
- **Area:** auth / accessibility
- **What happened (live, `/auth`):** both `#signin-email` (`type=email`) and
  `#signin-password` (`type=password`) return `autocomplete = null` (measured directly this
  run). Fields *are* real-labelled (`<label for="signin-email">Email</label>` /
  `Password`), so this is narrowly the autofill/password-manager hint, not a labelling gap.
  [`20-d-auth.png`](./assets/2026-08-20/20-d-auth.png).
- **Why it matters:** browsers and password managers can't reliably offer credential
  autofill; WCAG 1.3.5 (Identify Input Purpose) / OWASP ASVS V2.1.9. A returning user under
  time pressure types both fields by hand.
- **Recommended fix:** add `autocomplete="email"` / `autocomplete="current-password"` to the
  sign-in fields (and `new-password` on sign-up). **PR #244 already implements this but was
  never merged** — merging it closes this outright.
- **Tracking:** [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123) (Low, Backlog).

### 5. **P3 (NEW/refined, live-verified) — Several mobile controls fall below the 44px touch-target baseline**

- **Severity:** P3 (above the WCAG 2.5.8 AA 24px floor, but below the 44px / Material-48dp
  comfortable baseline the design principles cite; usability friction, not a blocker)
- **Area:** accessibility / mobile
- **User scenario:** A user prepping one-handed on a phone taps landing/auth controls.
- **What happened (live, mobile 390×844):** measured control heights — landing **company /
  role inputs 308×40**, top-nav **"Sign in or create account" 193×36**, **Pricing link 71×36**;
  `/auth` **email/password inputs 308×40**, the **Sign In / Sign Up tab switchers 150×32**
  (`role=tab`), **"Forgot password?" / "Resend verification email" 308×36**. The **primary
  submit button is fine (308×44)** and there is **no horizontal overflow** and **no h-scroll
  at 200% zoom** — so this is specifically the *height* of inputs, tabs, and secondary
  text-links, not layout breakage. [`40-m-landing.png`](./assets/2026-08-20/40-m-landing.png),
  [`41-m-auth-redirect.png`](./assets/2026-08-20/41-m-auth-redirect.png).
- **Why it matters:** 32–40px targets are tappable but error-prone one-handed, especially the
  32px auth tab switcher that toggles the whole form's mode.
- **Recommended fix:** raise input/tab/secondary-link min-height to 44px on mobile (a token or
  a `min-h-11` utility on the shared input + tab + text-button components).
- **Evidence:** Mobile 390×844 (`isMobile`+`hasTouch`), `/` and `/auth`, bounding-box sweep.

## Notable live observations (not top-5)

### Positives — holding (live-verified this run)

- **Landing hero + static example strong and on-message** — *"Research-first interview prep
  / Walk into your next interview knowing exactly what to expect,"* the honest *"No resume
  needed. No account needed for preview,"* and the full static Stripe · Senior PM example
  (stage / difficulty / *why it matters*, *"Generated from public signals · Glassdoor,
  LinkedIn, engineering blogs, and company values"*). [`01-d-landing.png`](./assets/2026-08-20/01-d-landing.png).
- **Preview CTA is disabled until a company is entered** — good error prevention; the button
  renders greyed with no company typed. [`01-d-landing.png`](./assets/2026-08-20/01-d-landing.png).
- **Guest form inputs are properly labelled** — `<label for="guest-company">Company *</label>`
  and `<label for="guest-role">Role (optional)</label>` (real `for`-associated labels, not
  placeholder-only).
- **Redirect-context copy is excellent** — bouncing from `/practice` to `/auth` shows
  *"Sign in to access your interview research, practice history, and saved prep."* plus a
  *"Continue to Practice."* affordance. All six protected routes (`/dashboard`, `/interviews`,
  `/practice`, `/history`, `/profile`, `/new-interview`) redirect cleanly to `/auth` with a
  *"Back to home"* escape. [`41-m-auth-redirect.png`](./assets/2026-08-20/41-m-auth-redirect.png).
- **Pricing copy honest** — three cadences (monthly / quarterly / annual), *"Research, prep
  plans, and practice stay free. Paid subscriptions unlock AI feedback on saved practice
  answers…"*, and a clear free-vs-paid breakdown. [`35-d-pricing.png`](./assets/2026-08-20/35-d-pricing.png).
- **Keyboard tab order + focus-visible healthy on landing** — first Tab lands on
  `A[href="#main-content"]` (skip link); order is skip-link → logo → Pricing → Sign-in →
  guest-company → guest-role, matching visual order. Links show a visible amber focus outline
  (`outline: auto 1px rgb(229,151,0)`); inputs show a focus ring (box-shadow).
- **No horizontal overflow on mobile; no h-scroll at 200% zoom** — reflow passes
  (WCAG 1.4.10). [`45-d-zoom200.png`](./assets/2026-08-20/45-d-zoom200.png).

### Lower-severity frontend copy notes (verifiable this run)

- **P3 — `/404` uses off-voice copy.** The not-found page reads *"404 / Oops! Page not found
  / Return to Home."* *"Oops!"* is the vague, jokey register the design principles steer away
  from; a calmer, Prepio-voiced line (*"That page doesn't exist. Head back to your
  interviews."*) would match the rest of the product. Route: `/zzz-nonexistent`.
- **P3 — Auth surfaces the raw `"Failed to fetch"` string on a network-level failure.**
  `src/pages/Auth.tsx:143` renders `err instanceof Error ? err.message : "Authentication
  failed…"`, so a transport failure that isn't caught by the `navigator.onLine` guard
  (`Auth.tsx:120`) leaks Supabase's *"Failed to fetch"* to the user (reproduced live this run,
  though the trigger here was the environment block). The offline path *is* handled honestly
  (*"Reconnect to continue with authentication."*); this is the narrower reachable-but-failing
  case. Map fetch/`TypeError` failures to honest copy (e.g. *"Couldn't reach Prepio. Check
  your connection and try again."*) rather than the raw message. Source: `src/pages/Auth.tsx:142-143`.

### Carried — could NOT be verified this run (backend unreachable)

These remain on record from 2026-08-13 but were **not testable** because login and all
authenticated data go through the blocked Supabase host:

- **Practice Favorite/Needs-work write `400 / 42P10`** (P1, [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124)) — untestable; behind auth.
- **`/history` empty vs in-progress interview card** (P2, [PREPIO-107](https://linear.app/qiuyue/issue/PREPIO-107)/[PREPIO-99](https://linear.app/qiuyue/issue/PREPIO-99)) — untestable; behind auth.
- **Nav has no "Interviews" item + `/dashboard`→`/interviews` collision** (P3, [PREPIO-101](https://linear.app/qiuyue/issue/PREPIO-101)) — the logged-in nav could not be loaded; `/dashboard` did redirect to `/auth` (logged out), consistent with the guard but not a check of the authenticated nav.
- **PREPIO-40 async-research progress UI, PREPIO-126 breathing-gate removal, PREPIO-136 flag toast, PREPIO-59 profile next-action, PREPIO-57 story linking** — all shipped/verified in prior runs but **not re-exercised** this run.

## Journey scorecard

Only rows whose evidence is fully client-side are scored **(live)** this run. Backend-gated
rows are marked **n/a — backend unreachable** and their last-scored value is shown in
parentheses for continuity; they carry **no trend arrow** because they were not re-measured.

| Area | 2026-08-13 | 2026-08-20 | Trend | Notes |
|------|------:|------:|------|-------|
| First-time understanding | 3 | 3 | = | **(live)** Landing hero + static example strong; guest-preview *result* unverifiable (backend blocked), so the "see value before signup" promise is only partially demonstrable this run. |
| Research entry | 4 | n/a (4) | — | Form renders + validates client-side, but a real run can't be started (backend blocked). Not re-scored. |
| Research progress/loading | — | n/a | — | Backend blocked. 12th owed cycle. |
| Generated output clarity | 4 | n/a (4) | — | Behind auth; not re-measured. |
| Practice mode | 4 | n/a (4) | — | Behind auth; not re-measured. |
| Mobile usability | 4 | 3 | ↓ | **(live)** Landing/auth mobile: no overflow, clean reflow, but inputs 40px / auth tabs 32px / secondary links 36px below the 44px baseline (issue #5). Scored on the *reachable* surfaces only — practice-mode mobile (last run's basis for 4) was not testable, so this is a different, narrower measurement, not a practice-mode regression. |
| Resume/profile trust | 4 | n/a (4) | — | Behind auth; not re-measured. |
| Dashboard/history/resume | 3 | n/a (3) | — | Behind auth; not re-measured. |
| Error/empty states | 3 | 3 | = | **(live)** Redirect-context + disabled-CTA + honest offline copy are strong; `/404` "Oops!" and raw "Failed to fetch" are off-voice (P3s). Authenticated empty states not testable. |
| Accessibility | 3 | 2 | ↓ | **(live)** Skip-link + tab order + labelled forms + 200% reflow hold, but the landing page ships **no `<h1>`** (issue #2), muted copy **<4.5:1** (issue #3), sub-44px mobile targets (issue #5), and `autocomplete=null` persists (issue #4, 11th audit). More defects surfaced under a closer client-side pass than the score had reflected. |
| Copy quality | 4 | 4 | = | **(live)** Landing / pricing / redirect-context / offline copy honest and specific; `/404` + auth-error raw-string are the only off-notes (P3). |

**Composite note:** the two moved rows (Mobile 4→3, Accessibility 3→2) are **not
regressions in shipped behaviour** — they reflect a closer *client-side* accessibility pass
plus a narrower reachable surface, not code that got worse. Treat them as a corrected,
more honest baseline for the frontend, to be reconciled with a full authenticated pass once
the backend is reachable again.

## Regression check

| Item | State | Note |
|------|-------|------|
| Landing hero + static example + disabled Preview CTA | **Holding** ✅ | Unchanged, strong, on-message. |
| Redirect-context copy on protected → `/auth` | **Holding** ✅ | *"…Continue to Practice."* excellent. |
| Pricing three-cadence honest copy | **Holding** ✅ | Unchanged. |
| Skip-link + tab order + 200% reflow | **Holding** ✅ | No h-scroll at 200%; tab order matches visual order. |
| Landing `<h1>` / heading hierarchy | **Newly flagged** ⚠️ | Zero `<h1>`; h3→h3→h2. Not a *new* regression (likely long-standing) but newly measured. **P2**, issue #2. |
| Landing muted-copy contrast | **Newly flagged** ⚠️ | Muted `rgb(127,117,108)` fails AA on the off-white cards (4.35–4.42:1 on ≤14px body text); borderline pass (4.50) on pure white. **P2**, issue #3. (First-pass 4.06 was an alpha-compositing artifact — corrected per Codex PR #303 review.) |
| Sub-44px mobile touch targets (inputs/tabs/links) | **Newly flagged** ⚠️ | Primary submit OK (44px); inputs 40 / tabs 32 / links 36. **P3**, issue #5. |
| `/auth` autocomplete missing | **Still unfixed — 11th audit** | `autocomplete=null` on both sign-in fields. [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123); PR #244 never merged. |
| `/404` "Oops!" + auth raw "Failed to fetch" | **Off-voice (P3)** | Copy notes above. |
| Backend deploy P0 + flag write + history/nav items | **UNVERIFIED this run** | Supabase host unreachable from review env; carried, not re-attested. See scope banner + issue #1. |

**Net: no shipped-behaviour regressions detected on the reachable frontend; three new
accessibility findings surfaced on the landing page (all small and self-contained), the
autocomplete gap persists for an 11th audit, and the entire authenticated loop plus the P0
deploy state are unverified this run because the review environment cannot reach Supabase.**

## Recommended tickets

New this run are the three landing-page accessibility findings — small, isolated, and on
the highest-traffic page. **Linear was unauthenticated in this session, so these could not
be filed directly; they are specified GitHub/Linear-ready below and the filing is owed to
the next session that has Linear access.**

1. **[P2] Landing page: add an `<h1>` and fix heading order** — promote the hero to `<h1>`,
   demote the two section titles to `<h2>`/`<h3>` to form a valid outline; mirror
   `/pricing`'s existing correct pattern. Area: `area:landing` + accessibility. (Issue #2.)
2. **[P2] Landing page: raise muted body-copy contrast to ≥4.5:1 on the off-white cards** —
   darken the `rgb(127,117,108)` `--muted-foreground` token (or restrict it to ≥18px/bold) so
   the static-example lead, the "why it matters" bodies, and the "generated from public signals"
   line (currently **4.35–4.42:1** on `rgb(251–253,…)`) clear AA; the pure-white text is a
   borderline 4.50 and benefits from the same nudge. Area: `area:landing` + accessibility. (Issue #3.)
3. **[P2] Merge PR #244 to ship `autocomplete` on `/auth`** — still `null` live, 11th audit.
   **Update [PREPIO-123](https://linear.app/qiuyue/issue/PREPIO-123).** (Issue #4.)
4. **[P3] Raise mobile touch targets to 44px** — landing/auth inputs (40px), auth tab
   switchers (32px), and secondary text-links (36px). Area: `area:landing`/`area:auth` +
   accessibility. (Issue #5.)
5. **[P3] Honest copy for `/404` and auth network-error** — replace *"Oops! Page not found"*
   and the raw *"Failed to fetch"* (`src/pages/Auth.tsx:143`) with calm, Prepio-voiced,
   recoverable messages. Area: `area:auth`/copy.
6. **[P0, carried] Re-verify + deploy the production backend** — **Update [PREPIO-124](https://linear.app/qiuyue/issue/PREPIO-124)**;
   unverifiable this run (Supabase unreachable). Re-probe from a network-enabled environment
   before re-asserting the freeze.

## Next-run focus

1. **Re-establish backend reachability first.** Confirm `*.supabase.co` is reachable (OPTIONS
   preflight → 200/404 split, or `list_edge_functions`/`list_migrations`) before trusting any
   guest-preview / login / practice verdict. If it is still blocked, declare partial-live
   again up front rather than mid-report.
2. **Full authenticated pass** (12th+ owed cycle) once login works — real research run on a
   fresh company (Palantir / Amazon / Vitol), PREPIO-40 async progress UI, practice save +
   flag write (`42P10`?), `/history` vs interview-card parity, authenticated nav (PREPIO-101).
3. **Land the three landing-page a11y fixes** (issues #2/#3/#5) and merge PR #244 (#4) — all
   are within frontend reach and don't wait on the deploy.
4. **Real keyboard-only + screen-reader pass** — still owed; now with the missing-`<h1>`
   finding as a concrete thing to confirm a SR user hits.

`Capability: live browser verified (frontend only — Supabase backend unreachable from review environment; authenticated flows and the P0 deploy state unverified this run)`
