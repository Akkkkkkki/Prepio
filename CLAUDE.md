# CLAUDE.md

Developer and agent notes for this repo.

## Project Summary

Prepio is an authenticated interview-prep app.

Primary flow:
1. Create a research run on [`src/pages/Home.tsx`](./src/pages/Home.tsx)
2. Review generated stages on [`src/pages/Dashboard.tsx`](./src/pages/Dashboard.tsx)
3. Practice those questions on [`src/pages/Practice.tsx`](./src/pages/Practice.tsx)
4. Manage CV text and seniority on [`src/pages/Profile.tsx`](./src/pages/Profile.tsx)

## Current Product Truth

These points matter because older docs in this repo can drift behind shipped behavior:

- PDF resume upload is supported.
  Signed-in users can upload PDFs from Home and Profile, and Home can still parse a PDF locally before sign-in.
- Profile resume deletion is server-backed.
  Deleting a profile resume removes the saved row and attempts to remove stored files as part of the same flow.
- Practice voice recording is local preview only.
  There is no audio upload or transcription path yet.
- Search history is available in authenticated navigation.
- Practice supports mobile swipes, but users also have explicit button controls.
- Auth shows redirect context when a user is bounced to sign in.
- Sign-in and sign-up fields are stored separately in the UI.

## Commands

### Frontend

```bash
npm install
npm run dev
npm run build
npm run preview
npm run lint
npm test
```

Notes:
- Vite runs on port `5173`.
- `npm run build` is currently the cleanest safety check for UI changes.
- `npm run lint` has repo-wide pre-existing failures. Do not assume a red lint run was caused by your change.

### Supabase

```bash
npm run functions:serve
npm run functions:serve-debug
npm run functions:deploy
npm run functions:deploy-single FUNCTION_NAME
npm run db:push
npm run db:pull
npm run supabase:start
npm run supabase:stop
npm run supabase:status
```

## Environment Variables

Local function work expects `.env.local` with:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
TAVILY_API_KEY=...
```

## Architecture

### Frontend stack
- React 18
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- TanStack Query
- React Router

### Backend stack
- Supabase Auth
- Supabase Postgres
- Supabase Edge Functions

### Edge functions present in this repo
- `company-research`
- `job-analysis`
- `cv-analysis`
- `interview-question-generator`
- `interview-research`

`interview-research` is the orchestration entry point. Shared runtime config lives in [`supabase/functions/_shared/config.ts`](./supabase/functions/_shared/config.ts).

### Model configuration

Model selection is env-driven in shared config. If secrets do not override defaults, the code currently falls back to `gpt-4o` and `gpt-4o-mini`.

## Routes

- `/`: research entry
- `/auth`: sign in / sign up
- `/dashboard`: protected results page
- `/practice`: protected practice page
- `/profile`: protected profile page
- `/search/:searchId`: protected results alias

Protected-route behavior is defined in [`src/App.tsx`](./src/App.tsx).

## Files Worth Reading First

- [`src/pages/Home.tsx`](./src/pages/Home.tsx)
- [`src/pages/Dashboard.tsx`](./src/pages/Dashboard.tsx)
- [`src/pages/Practice.tsx`](./src/pages/Practice.tsx)
- [`src/pages/Profile.tsx`](./src/pages/Profile.tsx)
- [`src/components/Navigation.tsx`](./src/components/Navigation.tsx)
- [`src/services/searchService.ts`](./src/services/searchService.ts)
- [`supabase/functions/interview-research/index.ts`](./supabase/functions/interview-research/index.ts)

## UX Notes That Affect Product Decisions

### Practice
- Swipe threshold is `60px`.
- Vertical gesture suppression kicks in above `12px`.
- Bottom nav already has safe-area padding and 12px progress dots.
- Hint dismissal is session-based.

### Home and auth
- Guests now see sign-in guidance before submit, but the landing page is not fully guest-optimized yet.
- Auth redirect context exists, but forgot-password and resend-verification affordances are still missing.

### Profile
- Resume text paste and PDF upload are both supported entry points.
- If you touch resume deletion semantics, keep file cleanup and row cleanup aligned.

## Schema Workflow

After database changes:

```bash
npm run db:push
npm run db:pull
```

Keep migration history in [`supabase/migrations`](./supabase/migrations) and schema understanding in `supabase/schema.sql` if that snapshot exists in the branch you are working on.

## Docs Map

- [`README.md`](./README.md): current product and setup summary
- [`docs/UI_UX_ENHANCEMENT_PLAN.md`](./docs/UI_UX_ENHANCEMENT_PLAN.md): UX backlog
- [`docs/RESEARCH_PIPELINE_IMPROVEMENTS.md`](./docs/RESEARCH_PIPELINE_IMPROVEMENTS.md): research pipeline notes
- [`docs/TESTING.md`](./docs/TESTING.md): testing priorities

## Practical Guidance

- Prefer aligning product copy to actual behavior over promising future functionality.
- If a control is not wired up, disable it and say so plainly.
- Treat practice mobile interactions as high-risk. Small gesture changes can break trust fast.
- When changing auth or profile UX, check both the screen copy and the route behavior.
