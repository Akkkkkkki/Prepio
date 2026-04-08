# CLAUDE.md

Developer and agent reference for Prepio. Read this first before making changes.

## Project Summary

Prepio is an authenticated interview-prep app. Users research a company/role, review AI-generated interview stages and questions, and practice against them.

Primary user flow:
1. Create a research run — [`src/pages/Home.tsx`](./src/pages/Home.tsx)
2. Review generated stages — [`src/pages/Dashboard.tsx`](./src/pages/Dashboard.tsx)
3. Practice questions — [`src/pages/Practice.tsx`](./src/pages/Practice.tsx)
4. Manage CV and preferences — [`src/pages/Profile.tsx`](./src/pages/Profile.tsx)

## Current Product Truth

These points override anything in older docs or code comments:

- **Resume upload**: PDF and DOCX supported. Signed-in users upload from Home and Profile. Home can parse files locally before sign-in.
- **Resume deletion**: Server-backed. Deleting a profile resume removes the saved row and stored files together.
- **Voice recording**: Local preview only. No audio upload or transcription.
- **Search history**: Available in authenticated navigation.
- **Practice gestures**: Mobile swipe (60px threshold, 12px vertical suppression) plus explicit button controls.
- **Auth**: Redirect context shown when bounced to sign-in. Sign-in and sign-up fields are stored separately.

## Commands

### Frontend

```bash
npm install          # Install dependencies
npm run dev          # Dev server on port 5173
npm run build        # Production build — cleanest safety check
npm run lint         # ESLint (has pre-existing failures, don't assume yours caused them)
npm test             # Vitest test suite
npm run preview      # Preview production build
```

### Supabase

```bash
npm run functions:serve          # Serve edge functions locally
npm run functions:serve-debug    # Serve with debug logging
npm run functions:deploy         # Deploy all edge functions
npm run functions:deploy-single FUNCTION_NAME
npm run db:push                  # Push migrations
npm run db:pull                  # Pull remote schema
npm run supabase:start           # Start local Supabase
npm run supabase:stop
npm run supabase:status
```

### After database changes

```bash
npm run db:push
npm run db:pull
```

Keep migration files in [`supabase/migrations`](./supabase/migrations).

## Environment Variables

`.env.local` for local development:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
TAVILY_API_KEY=...
```

## Routes

| Path | Access | Component |
|------|--------|-----------|
| `/` | Public | `Home` |
| `/auth` | Public | `Auth` |
| `/dashboard` | Protected | `Dashboard` |
| `/search/:searchId` | Protected | `Dashboard` |
| `/practice` | Protected | `Practice` |
| `/history` | Protected | `History` |
| `/profile` | Protected | `Profile` |

Protected-route behavior: [`src/App.tsx`](./src/App.tsx).

## Files Worth Reading First

| File | What it does |
|------|-------------|
| [`src/pages/Home.tsx`](./src/pages/Home.tsx) | Research entry form, draft persistence, resume upload |
| [`src/pages/Dashboard.tsx`](./src/pages/Dashboard.tsx) | Research results, stages, question counts |
| [`src/pages/Practice.tsx`](./src/pages/Practice.tsx) | Practice session UX, mobile layout, gestures |
| [`src/pages/Profile.tsx`](./src/pages/Profile.tsx) | CV management, seniority, structured profile |
| [`src/pages/History.tsx`](./src/pages/History.tsx) | Practice session history and stats |
| [`src/services/searchService.ts`](./src/services/searchService.ts) | All Supabase API calls from the frontend |
| [`src/components/Navigation.tsx`](./src/components/Navigation.tsx) | App nav, search selector, history |
| [`supabase/functions/interview-research/index.ts`](./supabase/functions/interview-research/index.ts) | Research pipeline orchestrator |
| [`supabase/functions/_shared/config.ts`](./supabase/functions/_shared/config.ts) | Model selection, Tavily config, feature flags |

## Conventions and Guardrails

- **Align copy to reality.** Prefer describing what works over promising what's planned.
- **Disable unwired controls.** If a button isn't connected, disable it with honest copy.
- **Practice gestures are high-risk.** Small changes to swipe thresholds or scroll suppression break trust. Test on real devices.
- **Auth + profile changes need both screen copy and route behavior checked.**
- **Resume deletion must keep file cleanup and row cleanup in sync.**
- **Model config is env-driven.** Falls back to `gpt-4o` / `gpt-4o-mini` if `OPENAI_MODEL` is not set.
- **Edge functions use service role.** All substantive DB writes from edge functions bypass RLS via `SUPABASE_SERVICE_ROLE_KEY`.

## Docs Map

| Document | Purpose |
|----------|---------|
| [`README.md`](./README.md) | Product overview, quick start, routes |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Stack, data model, edge functions, data flows |
| [`docs/PRODUCT_STRATEGY.md`](./docs/PRODUCT_STRATEGY.md) | Vision, users, positioning |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md) | Shipped work, near-term, future ideas |
| [`docs/DESIGN_PRINCIPLES.md`](./docs/DESIGN_PRINCIPLES.md) | UX principles, design tokens, patterns |
| [`docs/TESTING.md`](./docs/TESTING.md) | Test coverage, priorities, how to run |
