# Roadmap

What's shipped, what's next, and what's on the horizon.

## Shipped

### Core product

- [x] Research pipeline: Tavily search + extraction, company research, job analysis, CV analysis, question generation
- [x] AI-powered question synthesis with company/role/CV context
- [x] Interview stages generated from research data
- [x] Quality-over-quantity question generation (30-50 tailored questions, not 150 generic)
- [x] Environment-based model configuration with GPT-4o/GPT-4o-mini defaults

### Practice

- [x] Stage-based question selection with setup presets (Quick / Deep)
- [x] Text notes with local autosave
- [x] Local voice recording preview (no upload or transcription)
- [x] Favorites and skip tracking
- [x] Mobile swipe gestures with scroll suppression and explicit button controls
- [x] Bottom progress nav with safe-area padding
- [x] Session completion summary with stats
- [x] Keyboard shortcut hints on desktop
- [x] Coaching modal with insights panel
- [x] Practice session history with overview stats

### Resume and profile

- [x] PDF and DOCX resume upload from Home and Profile
- [x] Local file parsing before sign-in
- [x] Resume-to-search handshake (database trigger snapshots latest resume per search)
- [x] Structured candidate profile with AI-powered import and merge
- [x] Server-backed resume deletion (row + file cleanup)
- [x] Seniority preferences

### Auth and navigation

- [x] Email/password auth with forgot-password, resend-verification, password-recovery
- [x] Redirect context on auth bounce ("Sign in to continue to Practice")
- [x] Separate sign-in/sign-up field state
- [x] Search history in authenticated navigation
- [x] Offline detection banner
- [x] PWA support

### Code quality

- [x] Fisher-Yates shuffle replacing biased sort
- [x] AlertDialog for destructive actions (replacing window.confirm)
- [x] Proper routing (Link components, no raw anchors)
- [x] Accessible navigation (button elements, landmarks, skeleton fallbacks)
- [x] Dead code cleanup (unused components, dead state, Sonner toast removal)

## Near-Term

These are ordered by current product strategy, not by implementation convenience.

### Now

#### 1. AI answer feedback
- Evaluate submitted practice answers with question, role, company, and candidate context
- Return structured coaching: answer quality, missing specifics, STAR guidance, next-step suggestions
- Show a lightweight free teaser and reserve detailed feedback for paid access
- Persist feedback so users can revisit it in history and session summaries

#### 2. Pricing and monetization
- Ship a visible pricing surface
- Start with **Free + Interview Sprint**, not a full pricing matrix on day one
- Add entitlement checks and natural upgrade prompts around high-value moments
- Meter research and practice usage based on plan rules

#### 3. Landing-page framing
- Rework `/` into a real marketing page while keeping research entry prominent
- Add outcome-focused hero copy, trust framing, and sample output/demo states
- Keep route churn minimal. Do not move the core workflow to `/new` unless a later IA change clearly justifies it.

### Next

#### 4. Readiness and progress reporting
- Build readiness scoring only after answer feedback exists
- Add category-level strengths/weaknesses based on actual feedback data
- Improve history and dashboard views with meaningful progress, not vanity stats

#### 5. Lifecycle messaging
- Research complete notifications
- Post-practice follow-up with clear next step
- Re-engagement messages during active interview windows

#### 6. Landing-page and public-surface polish
- Public navigation
- Social proof once available
- Legal pages and functional public footer

### Later

#### 7. SEO and content engine
- Public company interview pages
- Blog / editorial content
- Sitemap, robots, and crawlable rendering

This is intentionally later because it requires content operations plus a rendering strategy, not just UI work.

## Future Ideas

These require dedicated initiative, more user data, or significant architecture work. They are not committed.

### Practice and coaching expansion
- Gap analysis between CV and job requirements with match scoring
- Practice modes: Deep Dive (fewer questions, immediate feedback) vs Mock Interview (full set, holistic evaluation)
- Speech-pattern feedback once transcription quality and cost are proven

### Live AI interview
- Real-time conversational practice with bidirectional audio
- Requires WebRTC infrastructure and a different latency model

### Data and analytics
- Practice telemetry (scoring, transcript metadata, feedback loops)
- Progress visualization with charts (session trends, coverage, readiness)
- User interaction analytics

### Pipeline improvements
- Taxonomy columns on questions (vertical, competency, sub-skill, seniority band)
- Signal provenance (linking sources to questions with confidence scores)
- Question stacks (anchor + probe ladder + stress variants + rubric)
- Vertical-specific presets (Tech PM, Investment Banking, Consulting)

### Architecture
- Migrate core data fetching to TanStack Query hooks for caching and dedup
- Normalize `search_artifacts` JSON blobs into relational tables
- Schema normalization for progress tracking

## Decision Log

These are current calls the team should treat as default unless new user evidence changes them.

### Keep the research-first wedge
- The product moat is the research pipeline. New features should reinforce that, not dilute it.

### Feedback before scoring
- Do not ship a headline readiness score before answer feedback exists.
- Otherwise the score is just activity math and users will notice.

### Sprint before subscription
- Package the first paid offer around short, intense prep windows.
- Revisit monthly plans after we have evidence that users return between interview cycles.

### Frame the wizard, do not hide it
- The current home page under-explains the product.
- The fix is better framing and demo states, not necessarily moving the core flow away from `/`.

## Deferred on Purpose

These are valid ideas, just not current priorities:

- Conversational AI mock interviews
- Browser extension / ATS import
- Referrals and social sharing
- Team / enterprise packaging
