# Product Strategy

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
Sign up → Enter company + role → (Optional: upload resume) → Wait for research
→ Review stages and questions → Select practice configuration → Practice session
→ Review session history → Repeat for next interview
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

## Current Limitations

These are known and intentional:

- **No real-time AI coaching** — Voice recording is local only. No transcription, no live feedback.
- **No audio upload** — Practice answers are text notes only.
- **Limited guest experience** — The full form is visible to guests but non-functional. No social proof or output preview.
- **No analytics** — No telemetry on how users interact with practice sessions.
- **English only** — Research pipeline and question generation are English-focused.
