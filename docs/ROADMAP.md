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

These are well-understood improvements that can be picked up when capacity allows.

### Guest experience
- Value-first landing page with social proof or sample output
- Lightweight public navigation

### Practice polish
- Timer opt-in for practice sessions
- Draft persistence indicator ("Draft saved")
- Quick-resume practice CTA from History page

### Profile improvements
- Profile completeness indicator with motivational copy
- Section navigation for long profile page

### Dashboard
- Research completion celebration
- Replace placeholder overview stats with real data
- Helper copy for desktop "Active Research" selector

### Legal and compliance
- Functional legal links on auth page (requires actual legal content)

## Future Ideas

These require dedicated initiative, more user data, or significant architecture work. They are not committed.

### AI feedback and coaching
- Evaluate practice answers with AI (clarity, relevance, structure scores)
- Gap analysis between CV and job requirements with match scoring
- Practice modes: Deep Dive (fewer questions, immediate feedback) vs Mock Interview (full set, holistic evaluation)

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
