# Implementation Roadmap: UI/UX Redesign + Enhanced Features

**Date**: December 9, 2025
**Status**: Planning Phase
**Scope**: Adopt new UI/UX design and select features while preserving robust backend architecture
**Excluded**: Live AI interview feature (parked for future consideration)

> For the current mobile practice execution plan, use [`docs/MOBILE_PRACTICE_UX_EXECUTION_PLAN.md`](./MOBILE_PRACTICE_UX_EXECUTION_PLAN.md). This roadmap stays broader and includes older planning context.

---

## Table of Contents

1. [Overview](#overview)
2. [Features to Add](#features-to-add)
3. [Features to Modify](#features-to-modify)
4. [Features to Delete](#features-to-delete)
5. [Implementation Phases](#implementation-phases)
6. [Detailed Component Breakdown](#detailed-component-breakdown)
7. [Database Schema Changes](#database-schema-changes)
8. [API/Backend Changes](#apibackend-changes)
9. [Timeline & Milestones](#timeline--milestones)
10. [Success Metrics](#success-metrics)

---

## Overview

### Goal
Modernize Prepio's UI/UX with the new design's visual language and enhanced features while maintaining the current production-ready architecture (Supabase, PostgreSQL, auth, microservices).

### Core Principles
✅ **Keep**: Robust backend (Supabase, PostgreSQL, Edge Functions, RLS)
✅ **Keep**: User authentication and data persistence
✅ **Keep**: Question generation system (120-150 questions)
✅ **Keep**: Multi-step practice workflow
✅ **Add**: Gap analysis and match scoring
✅ **Add**: Enhanced research dashboard with visual gauges
✅ **Add**: Real-time AI feedback (text-based, no audio streaming)
✅ **Add**: Improved onboarding flow
✅ **Update**: Visual design (slate/indigo color scheme)
✅ **Update**: Enhanced data visualizations
❌ **Exclude**: Live interview with audio streaming (future feature)

### Estimated Timeline
**12-16 weeks** (3-4 months) for full implementation

---

## Features to Add

### 1. Gap Analysis System ⭐ HIGH PRIORITY

**What**: Analyze alignment between user's CV and job requirements, provide match score and strategic recommendations.

**Components**:
- **Match Score Calculation** (0-100%)
  - Skill overlap analysis
  - Experience level alignment
  - Industry/domain match
  - Role-specific competency coverage

- **Visual Match Gauge**
  - SVG circular gauge with color coding
  - Green (75-100%): Strong match
  - Amber (50-74%): Moderate match
  - Rose (<50%): Weak match

- **Gap Identification**
  - Missing keywords/skills
  - Experience gaps
  - Certification/education requirements
  - Technical stack mismatches

- **Strategic Pivots**
  - Actionable recommendations to bridge gaps
  - Transferable skills to highlight
  - Experience framing suggestions
  - Learning recommendations

**Implementation Details**:
- **New Edge Function**: `gap-analysis` (or integrate into `interview-research`)
- **AI Prompt**: Structured comparison of CV vs. job description using GPT-4o
- **Database Table**: New `gap_analyses` table
  ```sql
  CREATE TABLE gap_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    search_id UUID REFERENCES searches(id) ON DELETE CASCADE,
    match_score DECIMAL(5,2) NOT NULL, -- 0.00 to 100.00
    missing_keywords TEXT[],
    missing_skills JSONB, -- [{skill, importance, category}]
    strategic_pivots JSONB, -- [{title, description, priority}]
    strengths JSONB, -- [{area, description}]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
  ```

**UI Changes**:
- Add "Gap Analysis" section to Dashboard
- Create `GapAnalysisCard.tsx` component
- Create `MatchScoreGauge.tsx` component
- Show strategic pivots in expandable cards

**Files to Create**:
- `src/components/GapAnalysisCard.tsx`
- `src/components/MatchScoreGauge.tsx`
- `supabase/functions/gap-analysis/index.ts` (or integrate into existing)
- `supabase/migrations/[timestamp]_add_gap_analysis.sql`

**Effort**: 30-40 hours

---

### 2. Enhanced Research Dashboard with Visual Gauges ⭐ HIGH PRIORITY

**What**: Transform the current text-heavy dashboard into a visually rich, card-based layout with data visualizations.

**Components**:
- **Company Summary Card**
  - Company logo/icon
  - Industry and size
  - Core values (visual chips/badges)
  - Culture summary

- **Interview Process Visualization**
  - Stage cards with descriptions
  - Timeline/funnel visualization
  - Question count per stage
  - Visual progress indicators

- **Recent News Section**
  - Card-based news items with thumbnails
  - Published dates
  - External link indicators
  - "Company Updates" badge

- **Industry Context Card**
  - Market trends relevant to role
  - Competitive landscape
  - Growth indicators

**Implementation Details**:
- Refactor existing Dashboard.tsx into modular card components
- Add data visualization library (e.g., Recharts for charts, custom SVG for gauges)
- Enhanced AI prompt to extract more structured company data
- Store additional metadata in `search_artifacts` table

**UI Changes**:
- Multi-column grid layout (1 → 2 → 3 columns responsive)
- Card-based design with shadows and hover effects
- Visual hierarchy with icons and badges
- Collapsible sections for detailed information

**Files to Create/Modify**:
- `src/components/dashboard/CompanySummaryCard.tsx` (new)
- `src/components/dashboard/InterviewProcessCard.tsx` (new)
- `src/components/dashboard/NewsCard.tsx` (new)
- `src/components/dashboard/IndustryContextCard.tsx` (new)
- `src/pages/Dashboard.tsx` (modify - break into modular cards)
- `src/lib/visualizations.ts` (new - reusable chart/gauge utilities)

**Effort**: 40-50 hours

---

### 3. Real-Time AI Feedback System (Text-Based) ⭐ MEDIUM PRIORITY

**What**: Provide immediate AI-generated feedback on practice session answers (text notes, no audio).

**Components**:
- **Answer Evaluation Metrics**
  - Clarity score (0-100%)
  - Relevance score (0-100%)
  - Structure score (0-100%)
  - Overall score (0-10 scale)

- **Feedback Categories**
  - Strengths identified
  - Areas for improvement
  - Missing key points
  - Suggested additions

- **Improved Answer Examples**
  - AI-generated enhanced version of user's answer
  - Highlights what was added/improved
  - Shows better structure/framing

- **Holistic Session Feedback** (for completed sessions)
  - Overall performance assessment
  - Consistency across questions
  - Top strengths and growth areas
  - Hiring recommendation simulation (Strong Hire/Hire/etc.)

**Implementation Details**:
- **New Edge Function**: `answer-evaluation`
- **AI Prompt**: Evaluate user's text answer against question context
- **Database Schema Updates**:
  ```sql
  ALTER TABLE practice_answers ADD COLUMN evaluation JSONB;
  -- Structure: {
  --   clarity_score, relevance_score, structure_score,
  --   overall_score, strengths[], improvements[],
  --   improved_example, evaluated_at
  -- }

  ALTER TABLE practice_sessions ADD COLUMN holistic_feedback JSONB;
  -- Structure: {
  --   hiring_decision, overall_strengths[], growth_areas[],
  --   consistency_score, generated_at
  -- }
  ```

**UI Changes**:
- Add "Get Feedback" button on practice answer cards
- Create `AnswerFeedbackPanel.tsx` component
- Show evaluation metrics with visual indicators (progress bars, scores)
- Display improved example in highlighted box
- Session summary includes holistic feedback

**Files to Create/Modify**:
- `src/components/practice/AnswerFeedbackPanel.tsx` (new)
- `src/components/practice/SessionFeedbackSummary.tsx` (new)
- `src/pages/Practice.tsx` (modify - add feedback UI)
- `supabase/functions/answer-evaluation/index.ts` (new)
- `supabase/migrations/[timestamp]_add_answer_evaluation.sql`

**Effort**: 50-60 hours

---

### 4. Improved Onboarding Flow ⭐ LOW PRIORITY

**What**: Dedicated onboarding component with contextual help and better UX for first-time users.

**Components**:
- **Welcome Screen** (first-time users only)
  - Brief product overview (2-3 sentences)
  - Key benefits highlighted
  - "Get Started" CTA

- **Guided Input Form**
  - Step indicators (optional multi-step)
  - Contextual help tooltips
  - Example placeholders
  - Field validation with helpful errors

- **Feature Highlights** (optional tour)
  - Highlight key features after first search
  - Dismissible tooltips
  - "Skip Tour" option

**Implementation Details**:
- Check if user has completed searches (use `searches` table count)
- Show onboarding overlay/modal for first-time users
- Store onboarding completion in user preferences

**UI Changes**:
- Create `OnboardingModal.tsx` or `WelcomeScreen.tsx`
- Add tooltip library (e.g., React Joyride or custom)
- Update Home.tsx to trigger onboarding check

**Files to Create/Modify**:
- `src/components/onboarding/WelcomeScreen.tsx` (new)
- `src/components/onboarding/FeatureTour.tsx` (new)
- `src/pages/Home.tsx` (modify - add onboarding trigger)
- `src/hooks/useOnboarding.ts` (new)

**Effort**: 20-30 hours

---

### 5. Practice Session Mode Selection 🔄 MEDIUM PRIORITY

**What**: Offer two practice modes with different focuses (similar to Deep Dive vs. Mock Interview, but without audio).

**Modes**:
- **Deep Dive Mode**
  - Focus on 10-20 questions
  - Detailed feedback on each answer
  - Encourages thorough text responses
  - Immediate AI evaluation per question
  - Iterative improvement

- **Mock Interview Mode**
  - Full question set (30-50 questions)
  - Timed (optional)
  - Realistic interview simulation
  - Minimal interruptions
  - Holistic feedback at end

**Implementation Details**:
- Add mode selection to practice setup wizard (step 1)
- Different UI flows based on mode
- Store mode in `practice_sessions.metadata` JSONB

**UI Changes**:
- Add mode selection cards in practice setup
- Preset configurations for each mode
- Different feedback display based on mode
- Timer display for Mock Interview mode (optional)

**Files to Modify**:
- `src/pages/Practice.tsx` (add mode selection)
- `src/types/practice.ts` (add mode enum)
- Practice setup wizard components

**Effort**: 30-40 hours

---

### 6. On-Demand Question Generation 🔄 LOW PRIORITY

**What**: Allow users to generate additional questions on-demand for specific stages/categories.

**Components**:
- **Question Generator Panel** (on Dashboard or Preparation page)
  - Select interview stage
  - Select question category
  - Specify quantity (5-20)
  - "Generate" button

- **Generated Question Preview**
  - Show newly generated questions
  - "Add to Practice" option
  - Save to question bank

**Implementation Details**:
- Reuse existing `interview-question-generator` function
- Store generated questions in `interview_questions` table
- Link to existing search_id

**UI Changes**:
- Add "Generate More Questions" section to Dashboard
- Create `QuestionGeneratorPanel.tsx`
- Show loading state during generation
- Success notification with count

**Files to Create/Modify**:
- `src/components/dashboard/QuestionGeneratorPanel.tsx` (new)
- `src/pages/Dashboard.tsx` (add generator panel)
- Reuse existing API function

**Effort**: 20-30 hours

---

## Features to Modify

### 1. Visual Design System Overhaul 🎨 HIGH PRIORITY

**Current**: Fresh Green (#28A745) primary color, white backgrounds, shadcn/ui components

**New**: Slate/indigo professional palette, richer visual hierarchy, enhanced iconography

**Changes**:

#### Color Scheme Update
```css
/* Current */
--primary: hsl(134, 61%, 41%); /* Fresh Green */
--accent: hsl(125, 54%, 24%); /* Deep Green */

/* New */
--primary: hsl(217, 91%, 60%); /* Indigo */
--accent: hsl(215, 16%, 47%); /* Slate */
--success: hsl(142, 71%, 45%); /* Emerald */
--warning: hsl(32, 95%, 56%); /* Amber */
--destructive: hsl(0, 84%, 60%); /* Rose */
```

#### Component Updates
- Update all primary buttons to indigo
- Add more semantic color usage (success, warning, info)
- Enhance card shadows and borders
- Add hover states with color transitions
- Update badge variants

#### Iconography Enhancement
- Increase icon usage throughout app (currently selective)
- Add icons to all section headers
- Use icons in navigation
- Add status icons (checkmarks, warnings, info)
- Consistent icon sizing (lucide-react already used)

**Files to Modify**:
- `src/index.css` (color variables)
- `tailwind.config.ts` (theme colors)
- All component files using primary color classes
- `src/components/ui/button.tsx` (update variants)
- `src/components/ui/badge.tsx` (update variants)
- `src/components/Navigation.tsx` (add icons)

**Effort**: 40-50 hours (touch many files)

---

### 2. Dashboard Layout Transformation 📊 HIGH PRIORITY

**Current**: Linear list of stages with checkboxes, simple question counts

**New**: Card-based grid layout with visual richness

**Changes**:
- Replace list view with card grid
- Add visual gauges for match score
- Multi-column responsive layout (1 → 2 → 3 cols)
- Enhanced stage cards with icons and descriptions
- Add gap analysis section (from Features to Add #1)
- Add company summary card (from Features to Add #2)
- Collapsible sections for detailed information

**Files to Modify**:
- `src/pages/Dashboard.tsx` (major refactor into card layout)
- Create new dashboard card components (see Features to Add #2)

**Effort**: 30-40 hours (included in Features to Add #2)

---

### 3. Practice Session UI Enhancement 🎯 MEDIUM PRIORITY

**Current**: Full-screen question with swipe gestures, bottom navigation

**New**: Add feedback panels, evaluation UI, enhanced visual design

**Changes**:
- Keep existing swipe gesture functionality
- Add "Get Feedback" button per question
- Integrate `AnswerFeedbackPanel` component (from Features to Add #3)
- Enhanced visual design (slate/indigo colors)
- Add timer display (optional, for Mock Interview mode)
- Better empty states and loading states
- Session summary includes holistic feedback

**Files to Modify**:
- `src/pages/Practice.tsx` (add feedback UI integration)
- `src/components/practice/QuestionFrame.tsx` (visual updates)
- `src/components/practice/SessionSummary.tsx` (add holistic feedback)
- `src/components/practice/BottomPracticeNav.tsx` (visual updates)

**Effort**: 25-35 hours (combined with Features to Add #3)

---

### 4. Home Page Search Form Enhancement 🏠 LOW PRIORITY

**Current**: Standard form fields, functional but minimal

**New**: More visually appealing, better guidance, contextual help

**Changes**:
- Enhanced visual design with icons
- Contextual tooltips for fields
- Better placeholder examples
- Visual separation of required vs optional fields
- Loading state improvements
- Success/error state enhancements

**Files to Modify**:
- `src/pages/Home.tsx` (visual enhancements)
- Form input styling updates

**Effort**: 15-20 hours

---

### 5. Navigation Enhancement 🧭 MEDIUM PRIORITY

**Current**: Clean but minimal navigation

**New**: Enhanced with icons, better visual hierarchy, improved mobile UX

**Changes**:
- Add icons to nav items (Home, Dashboard, Practice, Profile)
- Enhanced active state styling
- Better mobile menu design
- Breadcrumb-style indicators
- Visual separation between sections

**Files to Modify**:
- `src/components/Navigation.tsx` (add icons, enhance styling)

**Effort**: 10-15 hours

---

### 6. Profile Page Enhancement 👤 LOW PRIORITY

**Current**: CV editor and parsed display, functional

**New**: Better visual design, clearer sections, enhanced UX

**Changes**:
- Card-based layout for parsed CV sections
- Visual icons for each section (experience, skills, education)
- Enhanced seniority level selector (visual cards vs. dropdown)
- Better side-by-side layout
- Add profile completion indicator

**Files to Modify**:
- `src/pages/Profile.tsx` (visual enhancements, layout improvements)

**Effort**: 20-25 hours

---

## Features to Delete

### 1. None (Strategic Decision) ✅

**Rationale**: All current features provide value and should be preserved. The new design doesn't have features that conflict with existing ones - it's additive.

**Features to Preserve**:
- ✅ Swipe gestures (mobile-friendly, unique feature)
- ✅ Keyboard shortcuts (power user feature)
- ✅ Multi-step practice setup wizard (provides flexibility)
- ✅ Question insights panel (comprehensive guidance)
- ✅ Search history (valuable for returning users)
- ✅ Persistent data storage (core architecture strength)
- ✅ shadcn/ui component library (maintain consistency)

**Optional Simplifications** (Consider After Implementation):
- Could simplify practice setup wizard if mode selection provides sufficient presets
- Could reduce number of filter options if rarely used
- Could consolidate some dashboard sections if information overlaps with gap analysis

**Recommendation**: **Keep all features initially**, then consider simplifications based on user analytics after 3-6 months.

---

## Implementation Phases

### Phase 1: Foundation & Core Features (6-7 weeks)

**Goals**:
- Establish new visual design system
- Implement gap analysis system
- Transform dashboard to card-based layout

**Tasks**:
1. **Week 1-2: Visual Design System**
   - Update color scheme (slate/indigo)
   - Update component library variants
   - Enhance iconography throughout app
   - Create reusable visualization utilities

2. **Week 3-4: Gap Analysis System**
   - Design and implement AI prompt for gap analysis
   - Create database schema and migration
   - Build Edge Function (or integrate into existing)
   - Create UI components (MatchScoreGauge, GapAnalysisCard)
   - Integrate into Dashboard

3. **Week 5-7: Dashboard Transformation**
   - Refactor Dashboard.tsx into card-based layout
   - Create new dashboard card components
   - Implement enhanced research visualization
   - Add company summary, industry context cards
   - Testing and refinement

**Deliverables**:
- ✅ Updated design system applied across app
- ✅ Functional gap analysis with match scoring
- ✅ Enhanced visual dashboard with cards and gauges
- ✅ Database schema updated
- ✅ All changes tested and deployed

---

### Phase 2: Enhanced Practice Experience (4-5 weeks)

**Goals**:
- Add AI feedback system for practice answers
- Implement practice mode selection
- Enhance practice UI/UX

**Tasks**:
1. **Week 1-3: AI Feedback System**
   - Design and implement answer evaluation prompts
   - Create `answer-evaluation` Edge Function
   - Update database schema for evaluations
   - Build AnswerFeedbackPanel component
   - Implement holistic session feedback
   - Integration and testing

2. **Week 4-5: Practice Mode Selection & UI Enhancement**
   - Add mode selection to practice setup (Deep Dive vs. Mock)
   - Update practice flow for different modes
   - Visual enhancements (new color scheme)
   - Enhanced session summary with feedback
   - Testing and refinement

**Deliverables**:
- ✅ Functional AI feedback on practice answers
- ✅ Two distinct practice modes available
- ✅ Enhanced practice UI with new design
- ✅ Holistic session feedback
- ✅ All changes tested and deployed

---

### Phase 3: Onboarding & Polish (2-3 weeks)

**Goals**:
- Improve first-time user experience
- Add on-demand question generation
- Polish and refinement

**Tasks**:
1. **Week 1: Onboarding Flow**
   - Create welcome screen for new users
   - Build feature tour (optional)
   - Implement onboarding completion tracking
   - Testing with new user scenarios

2. **Week 2: On-Demand Question Generation**
   - Build QuestionGeneratorPanel component
   - Integrate with existing question generator function
   - Add to Dashboard
   - Testing

3. **Week 3: Final Polish & Testing**
   - Cross-browser testing
   - Mobile responsiveness verification
   - Performance optimization
   - Bug fixes and refinements
   - Documentation updates

**Deliverables**:
- ✅ Onboarding flow for new users
- ✅ On-demand question generation feature
- ✅ All features polished and tested
- ✅ Performance optimized
- ✅ Documentation updated

---

### Phase 4: Testing & Deployment (1-2 weeks)

**Goals**:
- Comprehensive QA testing
- Beta testing with select users
- Gradual production rollout

**Tasks**:
1. **Week 1: QA Testing**
   - Feature testing (all new features)
   - Regression testing (ensure existing features work)
   - Performance testing (load times, API latency)
   - Security review (especially new AI endpoints)
   - Accessibility audit

2. **Week 2: Beta & Rollout**
   - Beta testing with 5-10 users
   - Collect feedback and make adjustments
   - Feature flag setup (optional)
   - Gradual rollout (10% → 50% → 100%)
   - Monitor metrics and errors

**Deliverables**:
- ✅ All features thoroughly tested
- ✅ Beta feedback incorporated
- ✅ Production deployment complete
- ✅ Monitoring and analytics in place

---

## Detailed Component Breakdown

### New Components to Create

| Component | Path | Purpose | Priority |
|-----------|------|---------|----------|
| `GapAnalysisCard` | `src/components/dashboard/GapAnalysisCard.tsx` | Display gap analysis with match score | HIGH |
| `MatchScoreGauge` | `src/components/dashboard/MatchScoreGauge.tsx` | SVG circular gauge for match score | HIGH |
| `CompanySummaryCard` | `src/components/dashboard/CompanySummaryCard.tsx` | Company overview with core values | HIGH |
| `InterviewProcessCard` | `src/components/dashboard/InterviewProcessCard.tsx` | Enhanced stage visualization | HIGH |
| `NewsCard` | `src/components/dashboard/NewsCard.tsx` | Recent company news display | MEDIUM |
| `IndustryContextCard` | `src/components/dashboard/IndustryContextCard.tsx` | Market trends and context | MEDIUM |
| `AnswerFeedbackPanel` | `src/components/practice/AnswerFeedbackPanel.tsx` | Display AI evaluation of answers | HIGH |
| `SessionFeedbackSummary` | `src/components/practice/SessionFeedbackSummary.tsx` | Holistic session evaluation | MEDIUM |
| `QuestionGeneratorPanel` | `src/components/dashboard/QuestionGeneratorPanel.tsx` | On-demand question generation UI | LOW |
| `WelcomeScreen` | `src/components/onboarding/WelcomeScreen.tsx` | First-time user welcome | LOW |
| `FeatureTour` | `src/components/onboarding/FeatureTour.tsx` | Optional guided tour | LOW |

### Existing Components to Modify

| Component | Path | Changes | Priority |
|-----------|------|---------|----------|
| `Dashboard` | `src/pages/Dashboard.tsx` | Refactor to card-based layout, integrate new cards | HIGH |
| `Practice` | `src/pages/Practice.tsx` | Add feedback UI, mode selection, visual updates | HIGH |
| `Navigation` | `src/components/Navigation.tsx` | Add icons, enhance styling | MEDIUM |
| `Home` | `src/pages/Home.tsx` | Visual enhancements, onboarding trigger | MEDIUM |
| `Profile` | `src/pages/Profile.tsx` | Visual enhancements, better layout | LOW |
| `QuestionFrame` | `src/components/practice/QuestionFrame.tsx` | Visual updates (colors) | MEDIUM |
| `SessionSummary` | `src/components/practice/SessionSummary.tsx` | Add holistic feedback display | MEDIUM |
| `Button` | `src/components/ui/button.tsx` | Update color variants | HIGH |
| `Badge` | `src/components/ui/badge.tsx` | Update color variants | HIGH |

### Utility Files to Create

| File | Path | Purpose |
|------|------|---------|
| `visualizations.ts` | `src/lib/visualizations.ts` | Reusable gauge/chart utilities |
| `useOnboarding.ts` | `src/hooks/useOnboarding.ts` | Onboarding state management |
| `feedback-scoring.ts` | `src/lib/feedback-scoring.ts` | Answer evaluation utilities |

---

## Database Schema Changes

### New Tables

#### 1. `gap_analyses` Table

```sql
CREATE TABLE gap_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  search_id UUID NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
  match_score DECIMAL(5,2) NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
  missing_keywords TEXT[],
  missing_skills JSONB,
  -- Structure: [{skill: string, importance: 'critical'|'important'|'nice-to-have', category: string}]
  strategic_pivots JSONB,
  -- Structure: [{title: string, description: string, priority: 'high'|'medium'|'low'}]
  strengths JSONB,
  -- Structure: [{area: string, description: string}]
  experience_gaps JSONB,
  -- Structure: [{gap: string, suggestion: string}]
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_gap_analyses_search_id ON gap_analyses(search_id);

-- RLS Policies
ALTER TABLE gap_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own gap analyses"
  ON gap_analyses FOR SELECT
  USING (
    search_id IN (
      SELECT id FROM searches WHERE user_id = auth.uid()
    )
  );
```

### Schema Modifications

#### 1. `practice_answers` Table - Add Evaluation

```sql
ALTER TABLE practice_answers ADD COLUMN evaluation JSONB;

-- Structure:
-- {
--   clarity_score: number (0-100),
--   relevance_score: number (0-100),
--   structure_score: number (0-100),
--   overall_score: number (0-10),
--   strengths: string[],
--   improvements: string[],
--   missing_points: string[],
--   improved_example: string,
--   evaluated_at: timestamp
-- }

COMMENT ON COLUMN practice_answers.evaluation IS 'AI-generated evaluation of the answer';
```

#### 2. `practice_sessions` Table - Add Mode and Holistic Feedback

```sql
ALTER TABLE practice_sessions ADD COLUMN mode VARCHAR(50) DEFAULT 'standard';
ALTER TABLE practice_sessions ADD COLUMN holistic_feedback JSONB;

-- mode values: 'deep_dive', 'mock_interview', 'standard'

-- holistic_feedback structure:
-- {
--   hiring_decision: 'strong_hire' | 'hire' | 'hold' | 'no_hire',
--   overall_strengths: string[],
--   growth_areas: string[],
--   consistency_score: number (0-100),
--   top_answers: number[], -- question IDs
--   needs_work: number[], -- question IDs
--   generated_at: timestamp
-- }

COMMENT ON COLUMN practice_sessions.mode IS 'Practice session mode: deep_dive, mock_interview, or standard';
COMMENT ON COLUMN practice_sessions.holistic_feedback IS 'Overall session evaluation';
```

#### 3. `profiles` Table - Add Onboarding Status

```sql
ALTER TABLE profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN onboarding_completed_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN profiles.onboarding_completed IS 'Whether user has completed onboarding flow';
```

### Migration Files to Create

1. `supabase/migrations/[timestamp]_add_gap_analysis.sql`
2. `supabase/migrations/[timestamp]_add_answer_evaluation.sql`
3. `supabase/migrations/[timestamp]_add_practice_modes.sql`
4. `supabase/migrations/[timestamp]_add_onboarding_tracking.sql`

---

## API/Backend Changes

### New Edge Functions

#### 1. `gap-analysis` Function (Optional - Can integrate into `interview-research`)

**Endpoint**: `POST /functions/v1/gap-analysis`

**Input**:
```typescript
{
  searchId: string;
  resume: string;
  jobDescription: string;
  role: string;
  company: string;
}
```

**Output**:
```typescript
{
  matchScore: number; // 0-100
  missingKeywords: string[];
  missingSkills: Array<{
    skill: string;
    importance: 'critical' | 'important' | 'nice-to-have';
    category: string;
  }>;
  strategicPivots: Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  strengths: Array<{
    area: string;
    description: string;
  }>;
  experienceGaps: Array<{
    gap: string;
    suggestion: string;
  }>;
}
```

**Implementation**:
- Use GPT-4o with structured prompt for gap analysis
- Calculate match score based on skill overlap, experience alignment
- Identify missing keywords from job description
- Generate strategic recommendations
- Store in `gap_analyses` table

**Alternative**: Integrate this logic into existing `interview-research` function to reduce API calls and improve efficiency.

---

#### 2. `answer-evaluation` Function

**Endpoint**: `POST /functions/v1/answer-evaluation`

**Input**:
```typescript
{
  answerId: string;
  questionText: string;
  questionContext: string; // Interviewer focus, good signals, etc.
  userAnswer: string;
  role: string;
  company: string;
}
```

**Output**:
```typescript
{
  clarityScore: number; // 0-100
  relevanceScore: number; // 0-100
  structureScore: number; // 0-100
  overallScore: number; // 0-10
  strengths: string[];
  improvements: string[];
  missingPoints: string[];
  improvedExample: string;
}
```

**Implementation**:
- Use GPT-4o to evaluate answer quality
- Score based on clarity, relevance to question, structure (STAR format)
- Provide constructive feedback
- Generate improved version of answer
- Update `practice_answers.evaluation` field

---

#### 3. `holistic-session-evaluation` Function

**Endpoint**: `POST /functions/v1/holistic-session-evaluation`

**Input**:
```typescript
{
  sessionId: string;
  answers: Array<{
    questionText: string;
    answer: string;
    evaluation: object; // Individual evaluation
  }>;
  role: string;
  company: string;
}
```

**Output**:
```typescript
{
  hiringDecision: 'strong_hire' | 'hire' | 'hold' | 'no_hire';
  overallStrengths: string[];
  growthAreas: string[];
  consistencyScore: number; // 0-100
  topAnswers: number[]; // Question indices
  needsWork: number[]; // Question indices
}
```

**Implementation**:
- Analyze all answers in session holistically
- Identify patterns, strengths, weaknesses
- Provide hiring decision simulation
- Update `practice_sessions.holistic_feedback` field

---

### Modifications to Existing Functions

#### 1. `interview-research` Function Enhancement

**Changes**:
- **Add gap analysis logic** (option A: integrate here to reduce API calls)
- Return additional structured data for enhanced dashboard cards
- Extract more company information (core values, industry context)
- Enhanced recent news extraction

**Output Additions**:
```typescript
{
  // Existing fields...
  gapAnalysis: {
    matchScore: number;
    missingSkills: [...];
    strategicPivots: [...];
    // etc.
  };
  companyDetails: {
    coreValues: string[];
    industryContext: string;
    marketTrends: string[];
  };
}
```

---

## Timeline & Milestones

### Overall Timeline: 12-16 Weeks (3-4 Months)

```
Week 1-2:   Visual Design System Overhaul
            ✅ Color scheme update
            ✅ Component variant updates
            ✅ Iconography enhancement

Week 3-4:   Gap Analysis System
            ✅ AI prompt design
            ✅ Database schema
            ✅ Edge Function
            ✅ UI components

Week 5-7:   Dashboard Transformation
            ✅ Card-based layout
            ✅ New dashboard components
            ✅ Visual gauges and charts
            ✅ Integration testing

Week 8-10:  AI Feedback System
            ✅ Answer evaluation function
            ✅ Database schema updates
            ✅ UI components
            ✅ Holistic feedback

Week 11-12: Practice Enhancement
            ✅ Mode selection
            ✅ Practice UI updates
            ✅ Session summary enhancements
            ✅ Integration testing

Week 13:    Onboarding & Question Generator
            ✅ Welcome screen
            ✅ Feature tour
            ✅ On-demand generation
            ✅ Testing

Week 14:    Polish & Bug Fixes
            ✅ Cross-browser testing
            ✅ Mobile responsiveness
            ✅ Performance optimization
            ✅ Bug fixes

Week 15-16: QA, Beta Testing & Deployment
            ✅ Comprehensive QA
            ✅ Beta user testing
            ✅ Gradual rollout
            ✅ Monitoring
```

### Key Milestones

| Milestone | Week | Deliverable |
|-----------|------|-------------|
| **M1: Design System Complete** | Week 2 | New visual design applied across all pages |
| **M2: Gap Analysis Live** | Week 4 | Functional gap analysis with match scoring |
| **M3: Dashboard V2 Complete** | Week 7 | Enhanced dashboard with all new cards and visualizations |
| **M4: AI Feedback Live** | Week 10 | Answer evaluation and feedback system functional |
| **M5: Practice V2 Complete** | Week 12 | Enhanced practice with modes and feedback |
| **M6: Feature Complete** | Week 13 | All features implemented |
| **M7: Production Ready** | Week 14 | Polished, tested, ready for deployment |
| **M8: Live in Production** | Week 16 | Full rollout to all users |

---

## Success Metrics

### Quantitative Metrics

| Metric | Current Baseline | Target (3 months post-launch) | Measurement |
|--------|------------------|-------------------------------|-------------|
| **User Engagement** | N/A | +30% increase in session duration | Analytics |
| **Feature Adoption** | N/A | 60% of users use gap analysis | Feature tracking |
| **Practice Completion** | N/A | +20% increase in sessions completed | Database queries |
| **User Satisfaction** | N/A | 4.2+ / 5.0 rating | In-app surveys |
| **Return Users** | N/A | +25% increase in 7-day retention | Analytics |
| **AI Feedback Usage** | N/A | 50% of practice sessions use feedback | Feature tracking |
| **Page Load Performance** | N/A | <2s initial load, <500ms navigation | Lighthouse, RUM |

### Qualitative Metrics

- **User Feedback**: Collect via in-app surveys and support channels
- **Visual Appeal**: A/B test with before/after screenshots
- **Ease of Use**: User testing sessions with 5-10 participants
- **Feature Discovery**: Track how quickly users find and use new features

### Success Criteria

✅ **Must Have** (Launch Blockers):
- All core features functional (gap analysis, AI feedback, enhanced dashboard)
- No critical bugs in production
- Performance metrics within targets (<2s load time)
- Mobile responsiveness verified on iOS/Android
- Security review passed for new AI endpoints

✅ **Should Have** (Post-Launch Priority):
- Onboarding flow complete
- Feature tour available
- On-demand question generation working
- 90% of UI/UX polish items complete

⚠️ **Nice to Have** (Future Iterations):
- Advanced visualizations (charts, graphs)
- Customizable dashboard layouts
- Export functionality for gap analysis reports

---

## Next Steps

### Immediate Actions (This Week)

1. **Review & Approve Roadmap**
   - Stakeholder review of this document
   - Prioritization confirmation
   - Budget approval

2. **Technical Setup**
   - Create feature branches in git
   - Set up project tracking (Jira, Linear, etc.)
   - Prepare development environment

3. **Design Finalization**
   - Create high-fidelity mockups for key screens (optional)
   - Finalize color palette and component specs
   - Create design tokens document

### Phase 1 Kickoff (Next Week)

1. **Week 1 Sprint Planning**
   - Break down Week 1-2 tasks into tickets
   - Assign development resources
   - Set up daily standups

2. **Begin Development**
   - Start visual design system overhaul
   - Update color scheme and component variants
   - Create migration branches

3. **Parallel Work Streams**
   - Design: Gap analysis UI mockups
   - Backend: Database schema design
   - Frontend: Color scheme updates

---

## Appendix: File Change Summary

### Files to Create (50+)

**Components** (11 new):
- `src/components/dashboard/GapAnalysisCard.tsx`
- `src/components/dashboard/MatchScoreGauge.tsx`
- `src/components/dashboard/CompanySummaryCard.tsx`
- `src/components/dashboard/InterviewProcessCard.tsx`
- `src/components/dashboard/NewsCard.tsx`
- `src/components/dashboard/IndustryContextCard.tsx`
- `src/components/dashboard/QuestionGeneratorPanel.tsx`
- `src/components/practice/AnswerFeedbackPanel.tsx`
- `src/components/practice/SessionFeedbackSummary.tsx`
- `src/components/onboarding/WelcomeScreen.tsx`
- `src/components/onboarding/FeatureTour.tsx`

**Utilities** (3 new):
- `src/lib/visualizations.ts`
- `src/lib/feedback-scoring.ts`
- `src/hooks/useOnboarding.ts`

**Edge Functions** (2 new):
- `supabase/functions/answer-evaluation/index.ts`
- `supabase/functions/holistic-session-evaluation/index.ts`
- (Optional: `supabase/functions/gap-analysis/index.ts`)

**Migrations** (4 new):
- `supabase/migrations/[timestamp]_add_gap_analysis.sql`
- `supabase/migrations/[timestamp]_add_answer_evaluation.sql`
- `supabase/migrations/[timestamp]_add_practice_modes.sql`
- `supabase/migrations/[timestamp]_add_onboarding_tracking.sql`

**Types** (updates):
- `src/types/gap-analysis.ts` (new)
- `src/types/feedback.ts` (new)

### Files to Modify (30+)

**Pages** (5):
- `src/pages/Dashboard.tsx` (major refactor)
- `src/pages/Practice.tsx` (add feedback UI, modes)
- `src/pages/Home.tsx` (visual updates, onboarding)
- `src/pages/Profile.tsx` (visual updates)
- `src/pages/Auth.tsx` (minor visual updates)

**Components** (10+):
- `src/components/Navigation.tsx` (icons, styling)
- `src/components/ProgressDialog.tsx` (visual updates)
- `src/components/practice/QuestionFrame.tsx` (visual updates)
- `src/components/practice/QuestionInsightsPanel.tsx` (visual updates)
- `src/components/practice/SessionSummary.tsx` (add feedback)
- `src/components/practice/BottomPracticeNav.tsx` (visual updates)
- `src/components/ui/button.tsx` (color variants)
- `src/components/ui/badge.tsx` (color variants)
- `src/components/ui/card.tsx` (visual updates)
- All other UI components for color scheme

**Configuration** (3):
- `src/index.css` (color variables)
- `tailwind.config.ts` (theme colors)
- `tsconfig.json` (possibly, for new paths)

**Backend** (1):
- `supabase/functions/interview-research/index.ts` (enhance output, optional gap analysis integration)

### Total Estimated File Changes
- **New files**: ~50
- **Modified files**: ~30
- **Total**: ~80 files

---

**Document Version**: 1.0
**Last Updated**: December 9, 2025
**Status**: Ready for Review
**Next Review**: After stakeholder approval
