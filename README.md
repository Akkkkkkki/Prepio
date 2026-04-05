# Prepio

AI-powered interview preparation. Research a company and role, review tailored interview stages, and practice with questions generated from real company data and your resume.

## What It Does

1. **Research** — Enter a company name, role, and optionally your resume. Prepio scrapes public interview data, analyzes the job, and synthesizes everything into a structured interview prep plan.
2. **Review** — See generated interview stages (behavioral, technical, case study, etc.) with tailored questions that reference the specific company, role, and your background.
3. **Practice** — Work through questions with notes, voice recording (local preview), favorites, and coaching insights. Mobile-first with swipe support and explicit controls.
4. **Profile** — Save your CV (paste, PDF, or DOCX upload), set seniority level, and have it automatically applied to future research runs.

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- A Supabase project with auth, database, and edge functions configured

### Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Environment

Create `.env.local` for local development:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
TAVILY_API_KEY=...
```

### Common commands

```bash
npm run dev              # Start dev server (port 5173)
npm run build            # Production build — best safety check for changes
npm run lint             # ESLint (has pre-existing failures)
npm test                 # Run frontend tests (Vitest)
npm run functions:serve  # Serve edge functions locally
npm run functions:deploy # Deploy all edge functions
npm run db:push          # Push migrations to Supabase
npm run db:pull          # Pull remote schema
```

## Routes

| Path | Access | Purpose |
|------|--------|---------|
| `/` | Public | Research entry form |
| `/auth` | Public | Sign in, sign up, password reset, resend verification |
| `/dashboard` | Protected | Research results with stages and questions |
| `/search/:searchId` | Protected | Direct link to a specific research result |
| `/practice` | Protected | Practice session with question navigation |
| `/history` | Protected | Past practice sessions and stats |
| `/profile` | Protected | CV management and seniority settings |

## Documentation

| Document | Purpose |
|----------|---------|
| [CLAUDE.md](./CLAUDE.md) | Developer and AI agent reference — commands, conventions, guardrails |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Technical architecture — stack, data model, edge functions, data flows |
| [docs/PRODUCT_STRATEGY.md](./docs/PRODUCT_STRATEGY.md) | Product vision, target users, competitive positioning |
| [docs/ROADMAP.md](./docs/ROADMAP.md) | What's shipped, what's next, and longer-term ideas |
| [docs/DESIGN_PRINCIPLES.md](./docs/DESIGN_PRINCIPLES.md) | UX principles, design tokens, interaction patterns |
| [docs/TESTING.md](./docs/TESTING.md) | Test coverage, how to run tests, and priorities |
