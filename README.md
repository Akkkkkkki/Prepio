# Prepio

Prepio is an AI-assisted interview prep app. A user signs in, researches a company and role, reviews the generated interview stages, then practices against a stage-specific question set.

This README is intentionally narrow. It documents what the product does today, what is still not shipped, and where the source of truth lives.

## Product State

### What works today
- Authenticated users can create a research run from the home page.
- Research results load in the dashboard with interview stages and question counts.
- Practice mode supports:
  - stage-based question selection
  - a setup stepper with presets
  - text notes with local autosave
  - local voice preview only
  - favorites
  - mobile swipe gestures with scroll suppression
  - a bottom progress nav with safe-area padding
- Home and Profile support PDF and DOCX resume upload.
- Profile lets users save CV text, upload PDF or DOCX resumes, delete saved resumes, and manage seniority preferences.
- Search history is available from the authenticated app navigation.

### What is intentionally not shipped yet
- Audio uploads, transcription, and coaching are not shipped. Practice voice recording stays on-device.
- Logged-out onboarding is only partially polished. Guests now get earlier sign-in guidance, but the public marketing/auth shell still needs work.

## Current User Journey

1. Sign in or create an account.
2. Start a research run from `/`.
3. Wait for Supabase-backed processing to finish.
4. Review stages and generated questions in `/dashboard`.
5. Launch `/practice` for selected stages.
6. Save CV text and seniority on `/profile` for future runs.

## Mobile And Practice UX

- Practice currently ships with mobile swipe support through `react-swipeable`.
- Horizontal actions require a 60px threshold.
- Vertical movement greater than 12px suppresses swipe actions so users can scroll long prompts.
- Users can still use explicit Back, Skip, Favorite, and bottom-nav controls if they do not want gestures.
- The mobile practice redesign has shipped and is in follow-up QA. The execution plan and QA expectations live in [`docs/MOBILE_PRACTICE_UX_EXECUTION_PLAN.md`](./docs/MOBILE_PRACTICE_UX_EXECUTION_PLAN.md).

Key files:
- [`src/pages/Practice.tsx`](./src/pages/Practice.tsx)
- [`src/components/practice/BottomPracticeNav.tsx`](./src/components/practice/BottomPracticeNav.tsx)
- [`src/components/practice/HintBanner.tsx`](./src/components/practice/HintBanner.tsx)

## Quick Start

### Prerequisites
- Node.js 18+
- npm
- A Supabase project with the required env vars

### Install

```bash
npm install
```

### Run the frontend

```bash
npm run dev
```

Open `http://localhost:5173`.

### Local env

Create `.env.local` if you need to run functions locally:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
TAVILY_API_KEY=...
```

### Supabase helpers

```bash
npm run functions:serve
npm run functions:serve-debug
npm run functions:deploy
npm run db:push
npm run db:pull
npm run supabase:start
npm run supabase:stop
npm run supabase:status
```

## Auth Notes

- Protected routes are `/dashboard`, `/practice`, `/history`, `/profile`, and `/search/:searchId`.
- The auth screen now shows redirect context like "Sign in to continue to Practice".
- Sign-in and sign-up state are separated in the UI, so switching tabs no longer carries passwords across forms.
- Email confirmation behavior depends on your Supabase project settings. The current UI tells users to check their email after sign-up.

## CV And Resume Notes

- Users can paste CV text or upload PDF/DOCX files from Home and Profile.
- Users can restore previously saved resume text from Profile into the Home form.
- Signed-in uploads update the resume saved on the user's profile.

## Architecture

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- React Router
- TanStack Query

### Backend
- Supabase Auth
- Supabase Postgres
- Supabase Edge Functions

### Edge functions in this repo
- `company-research`
- `job-analysis`
- `cv-analysis`
- `interview-question-generator`
- `interview-research`

`interview-research` is the main orchestration path. Shared configuration lives in [`supabase/functions/_shared/config.ts`](./supabase/functions/_shared/config.ts).

### AI config

Model selection is environment-driven through the shared config layer. The code currently falls back to `gpt-4o` / `gpt-4o-mini` defaults if secrets do not override them.

## Important Files

- [`src/pages/Home.tsx`](./src/pages/Home.tsx): research entry flow
- [`src/pages/Dashboard.tsx`](./src/pages/Dashboard.tsx): results and stage selection
- [`src/pages/Practice.tsx`](./src/pages/Practice.tsx): active practice session UX
- [`src/pages/Profile.tsx`](./src/pages/Profile.tsx): CV text and seniority settings
- [`src/components/Navigation.tsx`](./src/components/Navigation.tsx): app nav, search selector, history
- [`src/services/searchService.ts`](./src/services/searchService.ts): frontend API layer
- [`supabase/functions/interview-research/index.ts`](./supabase/functions/interview-research/index.ts): orchestration
- [`supabase/migrations`](./supabase/migrations): current migration history

## Docs Map

- [`CLAUDE.md`](./CLAUDE.md): developer and agent playbook
- [`docs/MOBILE_PRACTICE_UX_EXECUTION_PLAN.md`](./docs/MOBILE_PRACTICE_UX_EXECUTION_PLAN.md): source of truth for the mobile practice redesign
- [`docs/UI_UX_ENHANCEMENT_PLAN.md`](./docs/UI_UX_ENHANCEMENT_PLAN.md): UX backlog and current usability gaps
- [`docs/RESEARCH_PIPELINE_IMPROVEMENTS.md`](./docs/RESEARCH_PIPELINE_IMPROVEMENTS.md): research pipeline work and follow-ups
- [`docs/IMPLEMENTATION_ROADMAP.md`](./docs/IMPLEMENTATION_ROADMAP.md): future-facing implementation ideas
- [`docs/UI_UX_REDESIGN_ANALYSIS.md`](./docs/UI_UX_REDESIGN_ANALYSIS.md): redesign analysis and tradeoffs
- [`docs/TESTING.md`](./docs/TESTING.md): testing priorities

## Verification

Useful local checks:

```bash
npm run build
npm run lint
```

Current status:
- `npm run build` passes.
- `npm run lint` does not pass on this branch because the repo already has legacy ESLint violations outside this change set.

## Known UX Follow-Ups

- Finish guest-first onboarding and lightweight public nav.
- Complete follow-up QA on the shipped mobile practice redesign.
- Add helper copy around the desktop "Active Research" selector.
- Replace placeholder dashboard overview stats with real data.
- Add forgot-password and resend-verification affordances to auth.
- Add stronger automated coverage for practice mobile interactions.
