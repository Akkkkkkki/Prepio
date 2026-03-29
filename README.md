# Hireo - Interview Prep Tool 🎯

A modern, AI-powered interview preparation tool that helps small circles of friends and colleagues quickly learn how target companies run their interviews and prepare effectively.

![License](https://img.shields.io/badge/license-MIT-green)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)

## ✨ Features

### 🔍 **Intelligent Research** 
- **Multi-Source Company Research**: Real-time data from Glassdoor, Levels.fyi, Blind, and more
- **Job Description Analysis**: Automatic extraction and analysis of role requirements
- **AI-Powered CV Analysis**: Intelligent skill extraction and gap analysis
- **Seniority-Based Personalization**: Set your experience level (junior/mid/senior) for tailored questions
- **Personalized Guidance**: Tailored preparation based on your actual background
- **Structured AI Responses**: Comprehensive, accurate interview insights

### 📊 **Comprehensive Question Generation**
- **120-150 questions per search** regardless of experience level
- **Research-driven approach** using actual candidate reports from Glassdoor, Reddit, Blind
- **Experience-level adaptation** - same volume, different complexity for junior/mid/senior
- **User-controlled seniority** - explicitly set target level or auto-detect from CV
- **Company-specific intelligence** - 60%+ questions reference actual company information
- Interview process overview with timeline
- Stage-by-stage preparation guidance

### 🎴 **Practice Mode**
- Flash-card style question review
- Filter questions by interview stage
- Built-in timer for practice sessions
- Answer tracking and session persistence
- Voice/text recording capabilities (Phase 3)

### 📱 **Modern Experience**
- Responsive design for desktop and mobile
- Clean, minimalist interface with fresh green theme
- Real-time status updates during AI research
- Complete search history and session management
- Secure authentication and data protection
- Full CV management with intelligent parsing

## 📚 Documentation Hub

All documentation now lives in a single navigation surface so you don't need to jump into `docs/README.md` anymore.

| Document | Why you need it | Notes |
|----------|-----------------|-------|
| [`CLAUDE.md`](./CLAUDE.md) | End-to-end developer playbook | Start here for architecture, commands, and workflows. |
| [`docs/RESEARCH_PIPELINE_IMPROVEMENTS.md`](./docs/RESEARCH_PIPELINE_IMPROVEMENTS.md) | Pipeline optimization backlog | Use for planning perf work. |
| [`docs/UI_UX_ENHANCEMENT_PLAN.md`](./docs/UI_UX_ENHANCEMENT_PLAN.md) | Design backlog and heuristics | Reference when shipping UI polish. |

### Role-Based Fast Track
- **Developers:** Inspect `supabase/functions/interview-research/index.ts`, then follow `CLAUDE.md` commands.
- **Operations/DevOps:** Follow `docs/DEPLOYMENT_GUIDE.md` in order: DB migration → Edge Functions → smoke tests → monitoring.
- **Product & Stakeholders:** Skim the UI/UX plan for roadmap context.

### Key Files to Know
- `supabase/functions/interview-research/index.ts` – unified synthesis function.
- `supabase/migrations/20251116_redesign_option_b_search_artifacts.sql` – creates `search_artifacts` with indexes + RLS.
- `src/services/searchService.ts` – frontend gateway that now reads from `search_artifacts`.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Modern web browser
- Internet connection for AI research

### Getting Started

1. **Run the App Locally**
   ```
   npm install
   npm run dev
   # Then browse http://localhost:5173
   ```

2. **Create Account**
   - Sign up with email and password
   - No email verification required for quick testing

3. **Start Researching**
   - Enter a company name (e.g., "Google", "Meta", "Stripe")
   - Optionally add role and location details
   - Upload your CV for personalized insights
   - Click "Start Research" and wait for AI research
   - Note: Code Assistant can connect to Supabase via MCP and run read queries directly if you need to validate data during troubleshooting.

4. **Review & Practice**
   - Explore the generated interview stages
   - Read targeted preparation guidance
   - Practice with company-specific questions
   - Save results for future reference

## 📋 MVP Status & Development Backlog

> **Last Updated:** November 23, 2025  
> **Current MVP Completion:** ~86% (research pipeline rewrite shipped; UI polish + research QA outstanding)

### 🎯 Status Snapshot
- ✅ Research pipeline + synthesis rewrite deployed (see `docs/RESEARCH_PIPELINE_IMPROVEMENTS.md`).
- ✅ Practice usability refinements (swipe guard, safe-area padding, nav dots) shipped per `Improve practice usability gestures` commit.
- ✅ Practice setup stepper, presets, voice-recording messaging, and a lightweight interviewer hint shipped; richer hint UX/content deferred for a future iteration.
- ⚠️ UI/UX regressions tracked in `docs/UI_UX_ENHANCEMENT_PLAN.md` block critical onboarding and practice flows.
- ⚙️ Supabase + Edge Functions ready; need final migration + redeploy before reopening sign-ups.
- 🚧 Audio transcription and analytics remain outside MVP scope but stay on deck.

### 🚦 Priority Board (Next 2 Sprints)
| Priority | Initiative | High-Level Goal | Owner | Reference |
| --- | --- | --- | --- | --- |
| **P0** | Rendering & Access Hardening | Fix global glyph bug, gate Hireo landing for logged-out users, always show lightweight nav, surface redirect context. | Frontend | `docs/UI_UX_ENHANCEMENT_PLAN.md#1-access-onboarding--communication` |
| **P0** | Practice Usability (✅ shipped Nov 23) | Increase swipe thresholds, add bottom padding below sticky nav, enlarge nav dots ≥12 px, fix hint overlap. | Frontend | `docs/UI_UX_ENHANCEMENT_PLAN.md#4-practice-experience` |
| **P1** | Forms & Uploads Slimdown | Split research form into required/advanced accordions, add inline validation + counters, disable CV upload until storage ships. | Frontend | `docs/UI_UX_ENHANCEMENT_PLAN.md#2-copy-typography--form-inputs` |
| **P1** | History & IA Refresh | Rename search selector to “Active Research,” add helper text + empty states, ship cross-page history sheet. | Frontend | `docs/UI_UX_ENHANCEMENT_PLAN.md#3-navigation--information-architecture` |
| **P1** | Accessibility & Safe Areas | Define z-index scale (nav 40/dialog 80/toast 100), add aria-labels + stronger focus rings, enforce 44 px touch targets + safe-area padding. | Frontend | `docs/UI_UX_ENHANCEMENT_PLAN.md#5-accessibility--responsiveness` |
| **P1** | Research Pipeline Adoption | Configure `OPENAI_MODEL` secrets, remove temp params, monitor question depth (30–50) + tailoring via new question-first prompt. | Backend | `docs/RESEARCH_PIPELINE_IMPROVEMENTS.md` |
| **P2** | Practice Setup & Guidance (✅ shipped Nov 23) | Convert filters to stepper with presets, clarify voice recording limitations, collapse rationale behind toggle; hint kept intentionally simple until we revisit the UX. | Frontend + Design | `docs/UI_UX_ENHANCEMENT_PLAN.md#4-practice-experience` |
| **P2** | Feedback & Status Consistency | Shared loading pattern (skeletons + progress dialog), inline success states for saves, autosave notes w/ debounce + error CTAs. | Frontend | `docs/UI_UX_ENHANCEMENT_PLAN.md#6-feedback--status-communication` |
| **P3** | Visual Polish & Systemization | Standardize spacing, button sizing, progress + badge variants; fold into design system hygiene. | Design System | `docs/UI_UX_ENHANCEMENT_PLAN.md#prioritized-backlog` |

### 🧪 Research Pipeline Follow-Ups
- **P0:** Set `OPENAI_MODEL` secret to `gpt-5-nano` (or desired default) before redeploying `interview-research`; confirm Edge Functions read new env vars.
- **P1:** Run end-to-end research smoke tests to verify 30–50 deeply tailored questions, per `docs/RESEARCH_PIPELINE_IMPROVEMENTS.md` testing checklist.
- **P1:** Monitor logs for GPT-5 temperature warnings (should be gone) and ensure question-first prompt generates real-question variations.
- **P2:** Backfill analytics that compare question quality pre/post rewrite to quantify lift.

### ⚡ Quick Wins (≤ 1 Week)
- Re-enable Tailwind `font-sans` stack, smoke-test Hireo auth copy.
- Always render nav (Logo + Docs + Support + Sign in) regardless of auth state.
- Gate Hireo form with inline auth prompt + sample data card.
- Disable CV upload (“Coming Soon”) with privacy copy describing roadmap.
- ✅ Increase practice nav dots to 12 px and add `pb-24` (plus safe-area inset) under sticky nav.
- Add redirect-aware banner on `/auth` (“Sign in to resume Practice”).

### 🧪 Testing Backlog
High-level testing initiatives we still need to land before reopening sign-ups. Detailed acceptance notes live in [`docs/TESTING_BACKLOG.md`](./docs/TESTING_BACKLOG.md).

1. **[P0] Search artifact persistence:** regression nets around `search_artifacts` upsert flows, `cv_job_comparisons`, and comparison data surfaced through `searchService`.
2. **[P0] Progress & stall UI:** component coverage for `ProgressDialog`, `useSearchProgress`, and stalled-job retry/telemetry.
3. **[P0] Search creation flow:** integration-level tests for `Home` form validation, `createSearchRecord`/`startProcessing`, and long-running polling UX.
4. **[P1] Practice session pipeline:** sampler math, favorites-only filters, stage selection, and practice session/answer persistence.
5. **[P2] Tavily analytics math:** unit coverage for credit totals, success rates, and company-frequency aggregation in `tavilyAnalyticsService`.

### 📚 Historical Context
- Completed epics (seniority personalization, sampler, favorites, swipe gestures) now live inside the product; see `docs/IMPLEMENTATION_CHANGES.md` for deep dives.
- Audio transcription, timer presets, analytics dashboards stay parked until the above priorities land.

## 🏗️ Architecture

### Tech Stack
- **Frontend:** React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions)
- **AI:** OpenAI GPT-5 series for intelligent research
- **Deployment:** Originally Lovable platform, now TBC (possibly Vercel)

### Key Components

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   ├── Navigation.tsx  # Main navigation
│   └── AuthProvider.tsx # Authentication context
├── pages/              # Route components
│   ├── Home.tsx        # Search interface
│   ├── Dashboard.tsx   # Results display
│   ├── Practice.tsx    # Question practice
│   ├── Profile.tsx     # User settings
│   └── Auth.tsx        # Login/signup
├── hooks/              # Custom React hooks
│   └── useAuth.ts      # Authentication logic
├── services/           # API integration
│   └── searchService.ts # Research API calls
└── integrations/       # External services
    └── supabase/       # Database client
```

## 🛠️ Development

### Local Setup

1. **Clone and Install**
   ```bash
   git clone <YOUR_GIT_URL>
   cd <YOUR_PROJECT_NAME>
   npm install
   ```

2. **Environment Configuration**
   ```bash
   # Create .env.local in project root
   cp .env.local.example .env.local  # If example exists
   
   # Add these variables to .env.local:
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-supabase-publishable-key
   SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   OPENAI_API_KEY=your-openai-api-key
   TAVILY_API_KEY=your-tavily-api-key
   ```

3. **Start Development**
   ```bash
   # Start frontend
   npm run dev
   
   # Start Supabase (if using local development)
   npm run supabase:start
   
   # Start functions with proper environment loading
   npm run functions:serve
   ```

4. **Open Browser**
   ```
   http://localhost:5173
   ```

### 🚨 Important: Function Environment Setup

**Critical**: Always use `npm run functions:serve` instead of `supabase functions serve` directly. 

The npm script includes the `--env-file .env.local` flag that loads your API keys. Without this, you'll get placeholder content instead of real AI research.

**Signs of missing environment variables:**
- Seeing "Research in progress" instead of real company data
- No entries in `tavily_searches` table
- Function logs show "🚨 TAVILY_API_KEY missing!"

**Troubleshooting:**
```bash
# Check if functions are getting environment variables
npm run functions:serve-debug

# Verify environment file exists
ls -la .env.local

# Check Supabase status
npm run supabase:status
```

### Database Setup

The project uses Supabase with the following main tables:
- `profiles` - User profile information with auto-creation triggers
- `searches` - Research queries with status tracking (pending/processing/completed/failed)
- `interview_stages` - Structured interview process stages with ordering
- `interview_questions` - Questions for each stage with relationships
- `resumes` - CV content storage with intelligent parsing metadata
- `practice_sessions` - User practice tracking with answer persistence
- `practice_answers` - Individual answer records with timing data

All tables include comprehensive Row Level Security (RLS) policies for data protection and user isolation.

### AI Integration - Microservices Architecture

The app uses a sophisticated microservices architecture with four specialized Edge Functions:

**Microservices Design:**
- **cv-analysis:** Independent CV parsing and skill extraction
- **company-research:** Tavily-powered company interview research  
- **job-analysis:** Job description URL extraction and analysis
- **interview-research:** Synthesis orchestrator that generates final outputs

**OpenAI Integration:**
- **Models:** GPT-4o for research synthesis, GPT-4o-mini for CV analysis
- **Structured Output:** Enforced JSON responses with comprehensive error handling
- **Features:** Company insights, personalized guidance, preparation timelines

**Tavily Expert Integration:**
- **Real-Time Research:** Multi-source company interview data
- **Job Analysis:** Advanced extraction from role description URLs
- **Trusted Sources:** Glassdoor, Levels.fyi, Blind, LinkedIn, Indeed
- **Advanced Search:** Parallel targeted queries for comprehensive coverage

**System Features:**
- **Single Responsibility:** Each function has one clear purpose
- **Error Isolation:** Component failures don't cascade
- **Parallel Processing:** Data gathering runs concurrently
- **Graceful Degradation:** Robust fallbacks for all external services
- **Performance Optimized:** Parallel processing and efficient API usage
- **Security:** All API keys securely stored in Supabase secrets

### 🔄 Interview Research Pipeline (Critical Flow)

The interview research system operates in three distinct stages:

#### **Stage 1: Concurrent Data Gathering** (~20 seconds)
```
┌─────────────────────────────────────────────────────────┐
│         CONCURRENT PARALLEL EXECUTION                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────┐ │
│  │ Company Research│  │  Job Analysis    │  │CV Parse│ │
│  │                 │  │                  │  │        │ │
│  │ • Tavily search │  │ • Extract URLs   │  │ • Parse│ │
│  │ • AI Analysis*  │  │ • AI Parsing*    │  │resume  │ │
│  │                 │  │                  │  │        │ │
│  │ ~18-20s         │  │ ~18-20s          │  │ ~12-15s│ │
│  └────────┬────────┘  └────────┬─────────┘  └───┬────┘ │
│           │                    │                 │       │
└───────────┼────────────────────┼─────────────────┼──────┘
            │                    │                 │
            └────────────────────┴─────────────────┘
                         ↓
            Returns: CompanyInsights + JobRequirements + CVAnalysis
            Stores: scraped_urls (cached content), tavily_searches (logs)
```

**Functions Called:**
- `company-research`: Searches Tavily for interview data, analyzes with OpenAI
- `job-analysis`: Extracts and parses job description from provided URLs
- `cv-analysis`: Parses resume for skills and experience

**Important**: These functions perform initial AI analysis on their respective domains (company insights, job requirements parsing). Raw research data is not persisted separately—results are structurally analyzed immediately.

---

#### **Stage 2: AI Synthesis** (~8-15 seconds)

```
┌──────────────────────────────────────────────────────┐
│     UNIFIED SYNTHESIS (Single AI Call)               │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Input: CompanyInsights + JobRequirements + CV     │
│         ↓                                            │
│  OpenAI GPT-4o generates:                          │
│  ├─ Interview Stages (4-6 stages from research)   │
│  ├─ Personalized Guidance (role-specific tips)    │
│  ├─ Preparation Timeline (day-by-day schedule)    │
│  └─ Overall Fit Assessment                        │
│                                                      │
│  Output: AIResearchOutput JSON                     │
│                                                      │
│  ~8-15s total                                       │
└──────────────────┬───────────────────────────────────┘
                   ↓
         Stores: interview_stages table
         (4-6 rows, one per interview stage)
```

**Key Detail**: Interview stages are sourced from company research results. If Tavily extraction found the actual interview process from candidate reports, those stages are used directly. Otherwise, AI generates generic stages based on company/role.

---

#### **Stage 3: Parallel Post-Processing** (~10-25 seconds)

```
┌──────────────────────────────────────────────────────┐
│    TWO PARALLEL OPERATIONS (no dependencies)         │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────────┐      ┌──────────────────────┐│
│  │ CV-Job Analysis  │      │ Question Generation  ││
│  │                  │      │                      ││
│  │ • Skill gaps     │      │ Per Interview Stage: ││
│  │ • Experience gaps│      │ • Behavioral Qs      ││
│  │ • Fit assessment │      │ • Technical Qs       ││
│  │ • Prep strategy  │      │ • Situational Qs     ││
│  │                  │      │ • Company-specific   ││
│  │ ~5-10s           │      │ • Role-specific      ││
│  │                  │      │ • Experience-based   ││
│  └────────┬─────────┘      │ • Cultural fit       ││
│           │                │                      ││
│           │                │ Total: 120-150 Qs   ││
│           │                │ ~10-20s (per stage) ││
│           │                └────────┬─────────────┘│
│           │                         │              │
└───────────┼─────────────────────────┼──────────────┘
            │                         │
            └─────────────┬───────────┘
                          ↓
           Stores: cv_job_comparisons table
                  interview_questions table
                  (120-150 question rows)
```

**Functions Called:**
- `cv-job-comparison`: Analyzes CV against job requirements, generates prep strategy
- `interview-question-generator`: Generates categorized questions for each interview stage

**Critical Note**: These operations run in parallel—not sequentially. They don't depend on each other, only on Stage 1 data.

---

#### **Stage 4: Database Finalization** (~5-10 seconds)

```
Insert all collected data into database:
├─ interview_stages (4-6 rows from synthesis)
├─ interview_questions (120-150 rows, organized by stage)
├─ cv_job_comparisons (1 row, comprehensive analysis)
├─ resumes (1 row, parsed CV data)
└─ searches (update status to 'completed')
```

---

### Complete Pipeline Summary

| Stage | Duration | Operation | Output |
|-------|----------|-----------|--------|
| **1. Gather** | ~20s | Parallel: company research, job analysis, CV parsing | CompanyInsights, JobRequirements, CVAnalysis |
| **2. Synthesize** | ~8-15s | Single OpenAI call combining all data | AIResearchOutput (interview stages + guidance) |
| **3. Analyze** | ~10-25s | Parallel: CV-job comparison + question generation | Comparison + 120-150 questions |
| **4. Store** | ~5-10s | Batch insert all data | Complete database records |
| **TOTAL** | **50-80s** | All stages execute with optimal parallelization | Full interview preparation package |

---

### Data Flow Diagram

```
User Input
└─ Company, Role, CV, Target Seniority
    ↓
┌─────────────────────────────────────────┐
│  Stage 1: Concurrent Gathering (20s)   │
│  ├─ Company Research (Tavily + AI)     │
│  ├─ Job Analysis (URL extraction)      │
│  └─ CV Analysis (resume parsing)       │
└─────────────┬───────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Stage 2: AI Synthesis (8-15s)          │
│  └─ OpenAI combines all data            │
│     → Interview stages structure         │
│     → Personalized guidance             │
└─────────────┬───────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Stage 3: Parallel Analysis (10-25s)    │
│  ├─ CV-Job Comparison                   │
│  └─ Question Generation (per stage)     │
└─────────────┬───────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Stage 4: Store Results (5-10s)         │
│  ├─ Interview stages                    │
│  ├─ Interview questions (120-150)       │
│  ├─ CV-job comparison                   │
│  └─ CV analysis                         │
└─────────────┬───────────────────────────┘
              ↓
         Status: "completed"
         Frontend displays results
```

---

### Performance Notes

- **Why so fast?** Stages 1-3 use aggressive parallelization and timeout management
- **Bottlenecks?** Usually Tavily API (Stage 1) and Question generation (Stage 3)
- **Configurable?** See [.env.example](.env.example) for timeout and Tavily limits
- **Adjusting duration?** Reduce `CONCURRENT_TIMEOUTS` in config.ts or `tavily.maxResults` in .env

### Monitoring & Debugging

To monitor a search in progress:
1. **Frontend**: ProgressDialog shows real-time `progress_step` updates
2. **Logs**: Check Supabase Functions logs for each stage timing
3. **Database**: Query `searches` table for `progress_percentage` and `progress_step`

To debug failures:
1. Check `searches.error_message` for the stage that failed
2. Review function logs in Supabase Dashboard → Functions → Logs
3. Verify environment variables are set in Supabase Edge Functions settings

## 🎯 Usage Examples

### Basic Company Research
```
Company: Meta
Role: Software Engineer
Country: United States
Target Level: Auto-detect (or select Junior/Mid/Senior)
```

### Advanced Research with Context
```
Company: Stripe
Role: Senior Frontend Engineer
Country: Ireland
Target Level: Senior (override auto-detection)
Role Links: 
- https://stripe.com/jobs/listing/senior-frontend-engineer
- https://careers.stripe.com/jobs/12345

CV: [Upload your resume for personalized insights]
```

### Using Seniority Levels
```
Profile Settings:
- Set your current experience level (Junior/Mid/Senior)
- Questions adapt to your background

Per-Search Override:
- Applying for senior role as mid-level? Select "Senior" in search
- Questions will match the target level, not your current level
```

### Practice Session
1. Complete a company research first
2. Select specific interview stages from Dashboard
3. Navigate to Practice mode with selected questions
4. Use flash-card interface to review questions
5. Time your responses and save answers
6. Track progress across multiple sessions

## 🔒 Security & Privacy

- **Data Encryption:** All user data encrypted at rest and in transit
- **Access Control:** Row Level Security ensures user data isolation
- **Privacy First:** No data sharing with third parties
- **User Control:** Full data export and deletion capabilities

## 📖 Documentation

### Core Documentation
- **[Product Design Document](docs/PRODUCT_DESIGN.md)** - Product vision, features, and user journeys
- **[Technical Design Document](docs/TECHNICAL_DESIGN.md)** - Complete system architecture and implementation details
- **[Development Guide](docs/DEVELOPMENT_GUIDE.md)** - Practical patterns and day-to-day development workflows
- **[Implementation Changes](docs/IMPLEMENTATION_CHANGES.md)** - Development progress tracking and phase completions

### Quick Start for Developers
1. **New to the project?** Start with [Product Design](docs/PRODUCT_DESIGN.md) for context
2. **Setting up development?** Follow [Development Guide - Getting Started](docs/DEVELOPMENT_GUIDE.md#getting-started)
3. **Understanding the architecture?** See [Technical Design](docs/TECHNICAL_DESIGN.md)
4. **Daily development?** Use [Development Guide](docs/DEVELOPMENT_GUIDE.md) as your reference

---

### 🛠️ Contributing to the Backlog
**Before Starting Work**
1. Check the priority board above and confirm ownership in Slack.
2. Read the full PRD in `docs/PRODUCT_DESIGN.md` and relevant deep dives.
3. Review technical design in `docs/TECHNICAL_DESIGN.md`.
4. Create a branch (`feature/<initiative>-short-slug`).

**During Development**
1. Keep README backlog tables in sync (check off items or adjust owners).
2. Document deviations inside the relevant doc (`docs/UI_UX_ENHANCEMENT_PLAN.md`, etc.).
3. Write or update automated tests when changing behavior.
4. Update any affected docs/diagrams before opening a PR.

**After Completion**
1. Mark the initiative as shipped with a date in this README.
2. Append a short summary to `docs/IMPLEMENTATION_CHANGES.md`.
3. Link QA notes or Supabase logs in the PR description.
4. Tag product/design for sign-off when UI or copy changed.

---

## 🎨 Design System

The app uses a custom design system based on fresh green colors:
- **Primary:** #28A745 (Fresh Green)
- **Accent:** #1B5E20 (Deep Green)  
- **Backgrounds:** #FFFFFF, #F8F9FA
- **Typography:** System default sans-serif fonts

All components follow accessibility guidelines and responsive design principles.


## 🔧 Troubleshooting

### Common Issues

**Authentication Errors**
- Check Supabase URL configuration in auth settings
- Verify redirect URLs include your domain
- Ensure email verification is disabled for testing

**AI Research Failures**
- Verify OpenAI API key is set in Supabase secrets
- Check Edge Function logs for detailed errors
- Ensure sufficient OpenAI credits

**Performance Issues**
- Check network connection for AI API calls
- Clear browser cache and localStorage
- Verify Supabase service status

### Getting Help

- **Documentation:** Check the technical design document
- **Logs:** Use browser dev tools and Supabase dashboard
- **Community:** Join the project discussions

## 📈 Roadmap

### Phase 2 Features (Planned)
- **AI Interview Coach:** Real-time feedback on practice answers
- **Advanced Recording:** Audio/video practice with analysis
- **Community Features:** Anonymous sharing of interview experiences
- **Enhanced Analytics:** Personal progress tracking and insights

### Phase 3 Vision
- **Mobile Apps:** Native iOS and Android applications
- **Enterprise Features:** Team-based preparation workflows
- **Integration APIs:** Connect with job boards and ATS systems
- **Advanced AI:** Multi-modal research and preparation

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **OpenAI** for providing powerful AI research capabilities
- **Supabase** for the robust backend infrastructure  
- **shadcn/ui** for beautiful, accessible components
- **Lovable** for the development and hosting platform

---

**Built with ❤️ for better interview preparation**

*Ready to ace your next interview? Start your research now!*

## 🚀 Development Approaches

You have **two ways** to develop this app:

### 🌟 **Option 1: Remote-Only Development (Recommended)**
- ✅ Frontend → Remote Supabase (already configured)
- ✅ Functions → Deploy to Remote Supabase Edge Functions  
- ✅ Database → Remote Supabase Database
- ❌ **No `.env.local` needed**
- ❌ **No `supabase start` needed**

### ⚙️ **Option 2: Local Development** 
- ✅ Frontend → Remote Supabase
- ✅ Functions → Run locally for testing
- ✅ Database → Local Supabase
- ⚠️ **Requires `.env.local` for local function testing**

---

## 🌟 **Remote-Only Setup (Recommended)**

### 1. **Configure Environment Variables in Supabase Dashboard**
   ```
   Go to: Supabase Dashboard → Project Settings → Edge Functions → Environment Variables
   
   Add these secrets:
   OPENAI_API_KEY=your-openai-api-key
   TAVILY_API_KEY=your-tavily-api-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

### 2. **Deploy Functions to Remote**
   ```bash
   # Deploy all functions to remote Supabase
   npm run functions:deploy
   
   # Or deploy a single function
   supabase functions deploy company-research
   ```

### 3. **Start Frontend Development**
   ```bash
   # Only need to run this - connects to remote everything
   npm run dev
   ```

### 4. **Push Database Changes**
   ```bash
   # Push schema changes to remote database  
   npm run db:push
   ```

**✅ Benefits:**
- No local setup complexity
- Real production environment
- No `.env.local` needed
- Faster development cycle

---

## ⚙️ **Local Development Setup**

Only use this if you need to test function changes locally before deploying.

### 1. **Create .env.local (Required for local functions)**
   ```bash
   # Create .env.local in project root
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your-supabase-publishable-key
   SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   OPENAI_API_KEY=your-openai-api-key
   TAVILY_API_KEY=your-tavily-api-key
   ```

### 2. **Start Local Services**
   ```bash
   # Start frontend
   npm run dev
   
   # Start local Supabase (optional)
   npm run supabase:start
   
   # Start functions locally with environment loading
   npm run functions:serve
   ```

**⚠️ Only needed when:**
- Testing function changes before deployment
- Debugging function logic locally
- Working offline

---
