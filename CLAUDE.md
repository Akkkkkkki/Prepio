# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hireo is an AI-powered platform that helps job candidates prepare for technical interviews by providing comprehensive company research, tailored interview questions, and personalized preparation guidance. The application uses advanced AI to analyze job descriptions, research companies, and generate relevant interview materials.

## Architecture & Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** as build tool (dev server on port 8080)
- **Tailwind CSS** + **shadcn/ui** components
- **TanStack Query** for server state management
- **React Router** for navigation
- **Supabase Client** for backend integration

### Backend
- **Supabase** (PostgreSQL + Edge Functions + Auth)
- **4 Specialized Edge Functions** (microservices pattern):
  - `company-research`: Company analysis with multi-engine search fallbacks
  - `interview-research`: Unified orchestration service (synthesis + question generation)
  - `job-analysis`: Job description analysis
  - `cv-analysis`: Resume/CV analysis and job matching
  - `interview-question-generator`: Enhanced question generation (used by other services)

### AI Integration
- **OpenAI GPT-4o** for analysis and content generation
- **Tavily API** for real-time company research with **DuckDuckGo fallback**
- **URL Deduplication System** for research efficiency and cost optimization
- **Concurrent Processing** for improved performance

### Database
- **PostgreSQL** with Row Level Security (RLS)
- **Auto-generated TypeScript types** via Supabase CLI

## Project Structure

```
├── src/
│   ├── components/        # Reusable UI components
│   ├── pages/            # Route-level components
│   ├── lib/              # Utilities and configurations
│   ├── hooks/            # Custom React hooks
│   └── types/            # TypeScript type definitions
├── supabase/
│   ├── functions/        # Edge Functions (microservices)
│   │   ├── _shared/      # Shared utilities and config
│   │   ├── company-research/
│   │   ├── interview-research/
│   │   ├── job-analysis/
│   │   └── cv-analysis/
│   └── migrations/       # Database schema migrations
├── docs/                 # Project documentation
└── public/              # Static assets
```

## Development Commands

### Frontend Development
```bash
npm run dev          # Start Vite dev server (port 8080)
npm run build        # Build for production
npm run build:dev    # Build for development mode
npm run preview      # Preview production build
npm run lint         # Run ESLint
# Note: No typecheck script exists - use IDE or tsc manually
```

### Supabase Development
```bash
# Generate types from remote database
npx supabase gen types typescript --project-id vjwrirrqprjzdorignlz > src/types/supabase.ts

# Pull current schema snapshot (ALWAYS do this after any database changes)
npx supabase db pull --project-id vjwrirrqprjzdorignlz > supabase/schema.sql

# Local development (if needed)
npx supabase start   # Start local Supabase
npx supabase stop    # Stop local Supabase
npx supabase db reset --db-url YOUR_DATABASE_URL  # Reset database

# Deploy functions (use npm scripts for environment loading)
npm run functions:deploy                    # Deploy all functions
npm run functions:deploy-single FUNCTION_NAME  # Deploy specific function
npm run functions:serve                     # Local function development with .env.local
npm run db:push                             # Push local schema changes to remote
npm run db:pull                             # Pull remote schema to local
```

**IMPORTANT: Schema Management Workflow**

After ANY database operation:
1. Creating migrations
2. Applying migrations to remote
3. Creating/modifying tables, functions, or RLS policies
4. Deploying Edge Functions that use new schema

**Always run:**
```bash
npx supabase db pull --project-id vjwrirrqprjzdorignlz > supabase/schema.sql
git add supabase/schema.sql
git commit -m "Update schema snapshot after [change description]"
```

This keeps `supabase/schema.sql` as a single source of truth for understanding the current database state, complementing the migration history for understanding how we got here.

## Configuration Files

### Core Configuration
- **`supabase/functions/_shared/config.ts`**: Centralized configuration for all Edge Functions
- **`src/lib/supabase.ts`**: Frontend Supabase client setup
- **`vite.config.ts`**: Vite build configuration with React SWC plugin, port 8080, path aliases
- **`tsconfig.json`**: TypeScript configuration (relaxed for rapid development)
- **`eslint.config.js`**: Modern flat config with React hooks and refresh plugins
- **`tailwind.config.ts`**: Tailwind CSS with custom theme and shadcn/ui integration

### Environment Variables
- **Frontend**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (for local dev)
- **Edge Functions**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `TAVILY_API_KEY`
- **Management**: Environment secrets managed via Supabase Dashboard → Edge Functions → Settings

## Environment Setup

### Recommended Approach (Remote Development)
1. Use remote Supabase instance for development
2. Generate types from remote database
3. Deploy functions to remote environment
4. Frontend connects to remote Supabase

### Local Development (Alternative)
1. Set up local Supabase with `npx supabase start`
2. Apply migrations locally
3. Use local environment variables

## Database Schema (Optimized & Simplified)

### Understanding the Database

**Quick references:**
- **Current schema:** `supabase/schema.sql` - Updated after every database change
- **Evolution history:** `supabase/migrations/` - How the schema got to current state

The snapshot in `schema.sql` provides a single source of truth for understanding the current database state, complementing the migration history which shows how the schema evolved.

### Core Tables
- **`searches`**: User search sessions and status tracking
- **`search_artifacts`**: Centralized storage for all research data (raw + synthesized) - **NEW**
- **`interview_stages`**: AI-generated interview stage structures
- **`interview_questions`**: **Enhanced** questions with comprehensive metadata and guidance
- **`scraped_urls`**: Consolidated URL storage with embedded content (optimized)
- **`tavily_searches`**: Simplified API call logging
- **`resumes`**: User resume/CV storage
- **`profiles`**: User profile information with seniority level
- **`practice_sessions`**: Practice interview sessions
- **`practice_answers`**: User practice responses
- **`user_question_flags`**: User question personalization (favorites, needs_work, skipped)

### Key Features
- **Research-Driven Question Generation**: 120-150 questions per search with research-first approach
- **Consistent Volume, Adaptive Complexity**: Same quantity for all experience levels, different sophistication
- **Enhanced Company Research**: Prioritized extraction of actual interview questions from candidate reports
- **Experience-Level Adaptation**: Questions calibrated to junior/mid/senior complexity without quantity variation
- **Company-Specific Intelligence**: 60%+ questions reference company-specific information when available
- **Consolidated Architecture**: Single source of truth for interview questions
- **Quality Scoring**: Automated content assessment (0-1 scale) and question confidence scoring
- **Cost Optimization**: Intelligent URL deduplication reduces API costs by 40%
- **Performance**: Optimized indexes and simplified RLS policies
- **Row Level Security (RLS)** on all essential tables

## Enhanced Question Generation System

### **Research-Driven Question Architecture**

The question generation system has been significantly enhanced to provide comprehensive, company-specific interview preparation:

**Core Principles:**
- **Research-First Approach**: Actual questions from candidate reports form the foundation
- **Consistent Volume**: 120-150 total questions regardless of experience level
- **Adaptive Complexity**: Same quantity, different sophistication based on candidate seniority
- **Company Intelligence**: 60%+ questions incorporate company-specific research when available

**Question Generation Workflow:**
1. **Company Research Enhancement**: Extract 15-25+ actual questions from Glassdoor, Reddit, Blind reports
2. **Experience-Level Calibration**: Adapt question complexity (not quantity) to candidate's experience
3. **Category Distribution**: 18-22 questions across 7 core categories
4. **Research Integration**: Use extracted questions as foundation, generate contextual variations
5. **Gap Filling**: Ensure comprehensive coverage with industry-standard and role-specific questions

**Question Categories & Targets:**
- **Behavioral**: 18-22 questions (STAR method focus)
- **Technical**: 18-22 questions (complexity adapted to experience level)
- **Situational**: 18-22 questions (role-specific scenarios)
- **Company-Specific**: 18-22 questions (culture, values, recent news)
- **Role-Specific**: 18-22 questions (job requirements focus)
- **Experience-Based**: 18-22 questions (past projects, achievements)
- **Cultural Fit**: 18-22 questions (working style, team dynamics)

**Experience-Level Differentiation:**
- **Junior (0-2 years)**: Fundamentals, learning ability, basic problem-solving
- **Mid-Level (3-7 years)**: Project ownership, technical depth, team collaboration
- **Senior (8+ years)**: Strategic thinking, architecture, organizational impact

**Quality Assurance:**
- Minimum 60% research-derived questions when company data available
- Question diversity requirements (no similar phrasing)
- Company context validation for relevance
- Automated confidence scoring (0.0-1.0 scale)

## AI Integration (Microservices)

### Shared Infrastructure (`_shared/`)
- **`config.ts`**: Centralized configuration
- **`logging.ts`**: Comprehensive logging system
- **`tavily-client.ts`**: Tavily API integration
- **`duckduckgo-fallback.ts`**: Multi-engine search with fallbacks (Aston AI inspired)
- **`url-deduplication.ts`**: Smart caching for research with enhanced quality scoring

### Service Functions
1. **Company Research**: Multi-source company analysis with enhanced interview question extraction
2. **Interview Research**: Unified orchestration service that synthesizes all data sources and generates questions (Option B redesign)
3. **Job Analysis**: Job description breakdown and requirement extraction
4. **CV Analysis**: Resume parsing with intelligent skill extraction
5. **Interview Question Generator**: Research-driven comprehensive question generation (120-150 questions per search)

**Note**: CV-Job comparison functionality has been consolidated into the unified synthesis within `interview-research` as part of the November 2025 redesign.

## Design System

### Theme
- **Primary Color**: Fresh Green (#28A745)
- **Component Library**: shadcn/ui
- **Styling**: Tailwind CSS with custom utilities
- **Icons**: Lucide React

### Key Components
- **`ProgressDialog`**: Multi-step process visualization
- **Navigation**: Responsive header with auth integration
- **Forms**: Consistent styling with validation

## Authentication

### Setup
- **Supabase Auth** with email/password
- **Protected routes** via React Router
- **Auth state management** with Supabase client

### Implementation
- Login/signup flows in dedicated pages
- Auth context for global state
- Route guards for protected content

## Error Handling

### Patterns
- **Centralized logging** in Edge Functions
- **User-friendly error messages** in frontend
- **Error boundaries** for React components
- **Graceful degradation** for AI service failures

## Development Workflow

### Documentation Principles
1. **Simplicity over completeness** - Avoid over-engineering documentation
2. **Centralize documentation** - Use `docs/` folder, not scattered files
3. **Update existing files first** - Extend README.md or docs files before creating new ones
4. **Link from CLAUDE.md** - This file is the navigation hub for developers
5. **Keep it readable** - Short, clear files beat long technical manuals

### Best Practices
1. **Remote-first development** recommended
2. **Type safety** with generated Supabase types
3. **Microservices** pattern for Edge Functions
4. **Comprehensive logging** for debugging
5. **Environment-specific configuration**

### Making Changes to the Database

**Complete workflow for any database changes:**

1. **Create migration** (if adding schema changes):
   ```bash
   npx supabase migrations new add_feature_description
   # Edit: supabase/migrations/[timestamp]_add_feature_description.sql
   ```

2. **Update local schema and test**:
   ```bash
   npx supabase db push          # Apply to remote
   ```

3. **Regenerate TypeScript types**:
   ```bash
   npx supabase gen types typescript --project-id vjwrirrqprjzdorignlz > src/types/supabase.ts
   ```

4. **Pull and commit schema snapshot** (CRITICAL):
   ```bash
   npx supabase db pull --linked > supabase/schema.sql
   git add supabase/schema.sql supabase/migrations/[your_migration].sql src/types/supabase.ts
   git commit -m "Add [feature]: Update schema and types"
   ```

5. **Update Edge Functions** if needed to use new schema

6. **Deploy functions to remote**:
   ```bash
   npm run functions:deploy
   ```

**Key principle:** Always update `supabase/schema.sql` after database changes so developers have a clear reference of the current state.

## Key Architectural Patterns

### **Async Job Processing Pattern (New - Critical)**
```typescript
// Fire-and-forget pattern with real-time progress updates
export default async function handler(req: Request) {
  const { searchId, company, role } = await req.json();
  
  // Initialize progress tracker
  const tracker = new ProgressTracker(searchId);
  await tracker.updateStep('INITIALIZING');
  
  // Start background processing (don't await)
  processResearchAsync(company, role, searchId, tracker)
    .catch(error => tracker.markFailed(error.message));
  
  // Return immediately (202 Accepted)
  return new Response(JSON.stringify({
    searchId,
    status: 'processing',
    estimatedTime: '20-30 seconds'
  }), { status: 202 });
}
```

### **Concurrent Processing Pattern (Enhanced)**
```typescript
// ALWAYS use concurrent execution in microservices with timeout protection
const [companyInsights, jobRequirements, cvAnalysis] = await Promise.all([
  tracker.withProgress(
    () => executeWithTimeout(gatherCompanyData(...), 15000, 'Company Research'),
    'COMPANY_RESEARCH_START', 'COMPANY_RESEARCH_COMPLETE'
  ),
  tracker.withProgress(
    () => executeWithTimeout(gatherJobData(...), 15000, 'Job Analysis'),
    'JOB_ANALYSIS_START', 'JOB_ANALYSIS_COMPLETE'
  ),
  tracker.withProgress(
    () => executeWithTimeout(gatherCVData(...), 10000, 'CV Analysis'),
    'CV_ANALYSIS_START', 'CV_ANALYSIS_COMPLETE'
  )
]);
```

### **Multi-Engine Search with Fallbacks**
```typescript
// Primary (Tavily) → Fallback (DuckDuckGo) → Graceful degradation
const result = await searchWithFallback(tavilyApiKey, query, maxResults);
```

### **Timeout Protection Pattern**
```typescript
// All external calls MUST have timeouts
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 25000); // Max 25s
const response = await fetch(url, { signal: controller.signal });
clearTimeout(timeoutId);
```

### **Real-time Progress Polling Pattern (Frontend)**
```typescript
// Automatic polling with TanStack Query
export function useSearchProgress(searchId: string | null) {
  return useQuery({
    queryKey: ['search-progress', searchId],
    queryFn: () => fetchSearchProgress(searchId!),
    enabled: !!searchId,
    refetchInterval: (data) => {
      // Stop polling when completed/failed
      if (!data || ['completed', 'failed'].includes(data.status)) {
        return false;
      }
      return 2000; // Poll every 2 seconds
    }
  });
}

// Usage in components
const { data: search } = useSearchProgress(searchId);
const isProcessing = search?.status === 'processing';
```

### **Progressive Enhancement Pattern**
```typescript
// Always provide fallbacks for AI/API failures
const aiResult = await generateWithAI(prompt);
return aiResult || fallbackStructure;
```

## Common Tasks

### Adding New Features
1. Update database schema via migrations in `supabase/migrations/`
2. Regenerate TypeScript types: `npx supabase gen types typescript --project-id PROJECT_ID > src/types/supabase.ts`
3. Deploy Edge Functions: `npx supabase functions deploy FUNCTION_NAME --project-ref PROJECT_ID`
4. Implement frontend components following existing patterns
5. Test end-to-end functionality with real API calls

### Performance Considerations
- **Async Job Processing**: All long-running operations use fire-and-forget pattern
- **Concurrent Processing**: All microservice calls run in parallel with timeout protection
- **Timeout Management**: Optimized for concurrent execution (15s per service, 25s total)
- **Real-time Updates**: Progress polling every 2s with automatic completion detection
- **Quality Assessment**: Use pattern matching for content relevance scoring
- **Graceful Degradation**: Always provide fallbacks for external service failures

### Debugging
- **Edge Function Logs**: Supabase Dashboard → Functions → Logs
- **Database Issues**: Check RLS policies and query performance
- **API Failures**: Verify environment variables in Supabase Dashboard → Settings → Edge Functions
- **Performance**: Monitor response times and implement caching where appropriate

## Recent Architecture Changes

### Option B Redesign (November 2025)

The system underwent a major architectural redesign to improve reliability and performance:

- **Unified Synthesis**: Single OpenAI call generates all outputs (stages, questions, comparison, guidance)
- **search_artifacts Table**: Centralized storage for all research data (raw + synthesized)
- **Reduced Operations**: Database operations reduced from 126-157 to 5-7 per search (97% reduction)
- **Improved Performance**: Database write time reduced from 30-180+ seconds to < 3 seconds
- **Better Reliability**: Failure points reduced from 6+ to 2-3

**For detailed information**, see:
- `docs/RESEARCH_PIPELINE_IMPROVEMENTS.md` - Pipeline optimization backlog and deep dives
- `docs/DEPLOYMENT_GUIDE.md` - Deployment procedures
- `README.md` (Documentation Hub) - Single navigation surface

**Key Changes**:
- `cv-job-comparison` microservice removed (functionality consolidated into `interview-research`)
- New `search_artifacts` table for centralized data storage
- Unified synthesis pattern replaces multiple separate AI calls

## Troubleshooting

### Common Issues
- **CORS errors**: Check Supabase configuration
- **Type errors**: Regenerate types after schema changes: `npx supabase gen types typescript --project-id vjwrirrqprjzdorignlz > src/types/supabase.ts`
- **Auth issues**: Verify Supabase project settings
- **AI API failures**: Check API keys and rate limits in Supabase Dashboard → Edge Functions → Settings
- **Function deployment**: Use `npm run functions:deploy` or `npx supabase functions deploy FUNCTION_NAME --project-ref vjwrirrqprjzdorignlz`
- **Database errors**: Check RLS policies and query performance in Supabase Dashboard

### Performance
- **URL Deduplication**: Consolidated content storage in `scraped_urls` table reduces API costs by 40%
- **TanStack Query**: Caches API responses on frontend
- **Concurrent Processing**: All microservices run in parallel with timeout protection
- **Optimized builds** via Vite

### Getting Help
- **Documentation**: See the Documentation Hub in `README.md` for navigation to all guides
- **Architecture**: Review the “Recent Architecture Changes” section above or `docs/RESEARCH_PIPELINE_IMPROVEMENTS.md` for system design details
- **Deployment**: See `docs/DEPLOYMENT_GUIDE.md` for deployment procedures
- **Logs**: Check Supabase Dashboard → Functions → Logs for detailed error information

## Security

### Implementation
- **Row Level Security** on all database tables
- **Environment variables** for sensitive data
- **API key management** via Supabase secrets
- **Input validation** on all user inputs

### Best Practices
- Never commit API keys or secrets
- Use Supabase RLS for data access control
- Validate all inputs server-side
- Follow OWASP security guidelines