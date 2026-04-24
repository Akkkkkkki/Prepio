# Product Strategy

Updated April 2026 from prioritized product feedback. This document reflects what
the team should build next, not just what exists today.

## Vision

Prepio makes interview preparation research-driven and personalized. Instead of generic question lists, every question is grounded in real company data, the specific role, and the candidate's own background.

## Problem

Job seekers preparing for interviews face three core problems:

1. **Generic prep** — Most resources offer the same recycled questions regardless of company or role.
2. **Scattered research** — Candidates manually dig through Glassdoor, Blind, LinkedIn, and company sites to piece together what to expect.
3. **No structured practice** — Even with good questions, there's no guided way to practice, track progress, or identify weak spots.

## Solution

Prepio automates the research phase and delivers a structured, personalized practice experience:

- **Automated research** — Scrapes public interview data (Glassdoor, Blind, Reddit, company sites) using Tavily search and extraction, then synthesizes findings with GPT.
- **Tailored questions** — Every generated question references specific company details, role requirements, or the candidate's CV. No generic filler.
- **Structured stages** — Questions are organized into interview stages (behavioral, technical, case study, etc.) that mirror actual interview processes.
- **Practice mode** — Guided practice with notes, local voice recording, coaching insights, favorites, and progress tracking.
- **Resume integration** — CV data flows through the pipeline so questions target the candidate's actual experience.

## Strategic Reality

The product thesis is working. The gap is the business layer around it.

What is already differentiated:

- **Research-first workflow** — Prepio starts by figuring out what this company and role are likely to ask, then turns that into practice. Most competitors skip that step.
- **Personalization with evidence** — Questions are grounded in company research, the job description, and the candidate's own resume.
- **Useful practice UX** — The app already supports structured sessions, saved history, and mobile-first practice.

What is missing:

- **A paid reason to upgrade** — Today practice is useful, but it still behaves more like a self-quiz than a coach.
- **A monetization surface** — No pricing page, no visible packaging, no entitlements, no upgrade path.
- **A conversion funnel** — The home page explains too little too late for cold traffic.
- **Lifecycle retention** — No structured re-engagement once a user leaves the session.

## Target Users

### Primary: Active job seekers

- Preparing for specific interviews at known companies
- Typically mid to senior level (the product's tailoring provides more value at higher seniority)
- Willing to invest 30-60 minutes in structured prep
- Value depth over volume — prefer 30 great questions over 150 generic ones

### Secondary: Career explorers

- Researching what interviews look like at target companies
- Using the tool to understand role requirements before applying

## User Journey

```
Visit landing page → Start research for a real interview → (Optional: upload resume)
→ Wait for research → Review stages and questions → Start practice
→ Get answer feedback → Continue until interview-ready → Repeat for next interview
```

## What Makes This Different

| Traditional prep | Prepio |
|-----------------|--------|
| Same 50 behavioral questions for every company | Questions reference specific company values, products, and interview patterns |
| Candidate does their own research | Research is automated from multiple public sources |
| No connection between resume and questions | CV analysis shapes question generation and coaching |
| Practice is unstructured | Stage-based practice with notes, favorites, and progress |
| One-size-fits-all difficulty | Seniority-adjusted question generation |

## Product Principles

1. **Depth over breadth** — 30-50 deeply tailored questions beat 150 generic ones.
2. **Research-first** — The AI pipeline's value comes from real data synthesis, not prompt tricks.
3. **Honest about limitations** — Voice recording is labeled "local preview." Unshipped features are disabled, not promised.
4. **Mobile-first practice** — Job seekers practice on phones. The mobile experience must be excellent.
5. **Persistence is a feature** — Saved CVs, practice history, and favorites make repeat usage better. This is a competitive advantage over session-only tools.

## Competitive Positioning

Prepio sits between two extremes:

- **Question banks** (LeetCode, InterviewBit) — Wide coverage but zero personalization. Prepio is narrower but deeply tailored.
- **AI coaching tools** (mock interview apps) — Focus on real-time conversation. Prepio focuses on research and structured practice, which most candidates need first.

The defensible moat is the research pipeline: scraping real interview data, synthesizing it with job analysis and CV context, and delivering questions that feel like they came from someone who actually interviewed there.

That moat should stay at the center of positioning:

> The interview prep tool that researches the company for you first.

## What Users Should Pay For

The first premium feature is not more research — it is better outcomes from practice. Prepio becomes meaningfully more valuable once it can evaluate an answer in context: did the candidate answer what was asked, use a strong example from their background, structure it clearly, and what should they tighten before the real interview?

**AI answer feedback** is the anchor paid feature.

- **Free tier:** full access to research, stages, questions, and practice. Answers are saved. **No AI feedback is generated.**
- **Paid subscription:** unlimited AI feedback on every practice answer, using the best-class models available.

Pricing is a recurring subscription with three cadences — monthly, quarterly (~50% off vs rolling monthly), annual (~70% off vs rolling monthly) — to reward longer commitments while keeping the low-barrier entry point. A future credit-pack option for free users is on the horizon but not part of v1.

For implementation contract see [BILLING.md](./BILLING.md). For the ordered priority list, deferred ideas, and decision log, see [ROADMAP.md](./ROADMAP.md).

## Current Limitations

These are known and intentional:

- **No AI answer feedback** — Voice recording is local only. No transcription-backed coaching yet.
- **No monetization layer** — No pricing page, entitlements, or upgrade prompts exist today.
- **No audio upload** — Practice answers are text notes only.
- **Limited guest experience** — The home page does not yet explain the value proposition clearly enough for cold traffic.
- **No lifecycle outreach** — Research completion and return reminders are not wired up.
- **No analytics** — No telemetry on how users interact with practice sessions.
- **English only** — Research pipeline and question generation are English-focused.
