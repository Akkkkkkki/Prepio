# Prepio UI/UX Review — 2026-06-21 (recurring routine, first run)

First run of the recurring weekly UX-review routine. **Coincides with the
standalone product UX review delivered earlier the same day** —
[`2026-06-21-ux-review.md`](./2026-06-21-ux-review.md) /
[`2026-06-21-ux-review.html`](./2026-06-21-ux-review.html), tracked as epic
[PREPIO-99](https://linear.app/qiuyue/issue/PREPIO-99) (children
PREPIO-100–107). The structural diagnosis (nav, IA, plan density, fake-AI
panels, visual system) is covered there and not re-derived here.

This routine's job is the recurring weekly check. With the structural
review just landed, the question for this run narrows to: *what tactical,
code-level UX issues are not covered by the structural epic that a
weekly routine should still surface?*

## Method limitation — flag for next run

The routine could not perform the live/visual checks the brief calls for.
The remote execution environment blocks:

- `prepio.qiuyue.dev` (HTTP 403 to both WebFetch and curl-with-browser-UA)
- `cdn.playwright.dev` (Playwright Chromium install fails with
  `Host not in allowlist`)

So no real browser was driven, no screenshots, no mobile-viewport check,
no slow-network simulation, no keyboard/focus walk. Findings below are
code-level only: read the user-facing pages and infer what the rendered
behaviour does. Confidence is correspondingly lower than a live review;
each finding includes file:line evidence so the next live-capable run
can confirm in seconds.

Next-run focus: either (a) the environment gains egress to
`cdn.playwright.dev` so the routine can drive a real browser, or
(b) the routine accepts that it can only do the code-level half each
week and the visual half is delivered out of band (as it was today by
the standalone review).

## Overall product judgment

The structural UX review delivered today is a step-change improvement on
the navigation + IA story — six peer tabs collapse to two, three "which
run" controls collapse to one, the Plan is calmed, and a "Your
interviews" home gives the post-login landing a real identity. None of
that is shipped yet (PREPIO-100–107 all `Backlog` at routine time), so
the user experience today is unchanged from yesterday. The single
highest-leverage tactical issue that the structural restructure does
**not** address is a label-correctness bug in Practice: a "Saved
locally" + green-check badge is shown both for sessionStorage-only
drafts and for server-saved answers, conflating two trust-states under
one label. A stressed candidate who closes their laptop after seeing
"Saved" can lose the draft. Filed as PREPIO-108.

## Top issues

### 1. Practice autosave label conflates two different saved-states

- **Severity:** P2
- **Area:** practice
- **User scenario:** A user types an answer in Practice. After 600ms the
  badge changes to a green check + "Saved locally". The user either
  presses **Save & Continue** (server-saves) or closes the tab.
- **What happens:** Both code paths set `autosaveState = 'saved'` →
  identical "Saved locally" + green check. The first path (sessionStorage
  write, `Practice.tsx:853-858`) is **not** server-saved; the second
  path (`Practice.tsx:1391-1392`, after `handleSaveAnswer` succeeds)
  **is**. The badge can't be used to tell which.
- **Why it matters:** Trust. Closing a tab with the green "Saved" badge
  showing loses the draft. This is exactly the kind of overpromise
  `docs/DESIGN_PRINCIPLES.md` warns against ("no fake confidence").
- **Recommended fix:** Either relabel (cheapest: `'Draft kept in this
  tab — Save & Continue to keep it'` vs. drop the badge after server
  save) or split `autosaveState` into `draft` and `serverSaved`.
- **Evidence:**
  [`src/pages/Practice.tsx:255,853-858,1391-1392,1519-1520,2727,3110`](../../src/pages/Practice.tsx).
  Confirmed by code read; static — not observed in a live browser.
- **Tracking:** [PREPIO-108](https://linear.app/qiuyue/issue/PREPIO-108).

### 2 – n. (Not added)

The other tactical candidates this run looked at —
icon-button aria-labels on mic/stop/start (turned out to have visible
text next to the icon), preview-expiry handling
(`InterviewBriefPreview.tsx:131` shows the date but no expired-state
behaviour), recording-time aria-live announcement, focus management on
question advance — would need a live browser run to assess user impact
honestly. Deferring them rather than filing low-confidence tickets.

## Journey scorecard

Code-level only; no live checks. Same scoring rubric (1–5) so trends
become visible from run #2 onward. Where a row is dominated by an open
PREPIO-99 child issue, the score reflects today's experience (the work
isn't shipped yet) not the future state.

| Area | Score | Notes |
|------|-----:|-------|
| First-time understanding | 3 | Hero copy is honest and outcome-framed (PREPIO-15, shipped). PREPIO-100 will replace today's post-login landing. |
| Research entry | 4 | Wizard is prominent; resume parse local-first; offline copy is honest. |
| Research progress/loading | — | Not assessable without live testing. |
| Generated output clarity | 3 | Structure is real (stages, signals, evidence) but density and duplication tracked in PREPIO-103. |
| Practice mode | 3 | Core loop works in code; one trust bug filed (PREPIO-108). Setup friction tracked in PREPIO-105. |
| Mobile usability | — | `useMobileFooterHeight` + safe-area padding are present; reachability needs a real device run. |
| Resume/profile trust | 4 | AlertDialog on destructive delete; honest privacy copy (PREPIO-37 shipped). |
| Dashboard/history/resume | 2 | Three overlapping "which run" controls (PREPIO-102) + empty state explains the menu (called out in 2026-06-21 review). |
| Error/empty states | 3 | Most error strings are specific (`Practice.tsx` microphone/recording errors are good); the empty-state-explains-menu pattern lowers the score (PREPIO-99 review #4). |
| Accessibility | — | Static read shows aria-labels on most icon buttons and AlertDialog usage on destructive actions; full audit needs keyboard/focus walk in a browser. |
| Copy quality | 4 | Direct and specific overall; "Saved locally" is the standout exception. |

## Regression check

First run of the routine — no prior baseline to regress from. Set this
table up so run #2 has something to compare against.

## Recommended tickets

One new ticket from this run; the rest of the actionable UX backlog is
covered by [PREPIO-99](https://linear.app/qiuyue/issue/PREPIO-99) and
its eight children.

| # | Ticket | Status |
|---|--------|--------|
| 1 | [PREPIO-108](https://linear.app/qiuyue/issue/PREPIO-108) — Practice autosave label conflates sessionStorage draft with server-saved answer | Filed this run |

## Next-run focus

1. **Confirm PREPIO-108 in a real browser** if egress to the live app
   or to `cdn.playwright.dev` is restored. The fix is small but worth
   verifying the user-visible flow before merging.
2. **Watch PREPIO-99 progress.** The structural restructure is the main
   UX lever this quarter; the routine should check at week +1 whether
   PREPIO-100/101/102 have moved out of Backlog and whether any
   regressions slipped in alongside them.
3. **Tactical deferred items** (preview expiry, recording-time
   aria-live, focus management on question advance) — pick up on the
   first run that has live-browser capability.
