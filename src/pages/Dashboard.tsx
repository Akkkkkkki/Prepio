import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams, useParams, Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileStageCard } from "@/components/dashboard/MobileStageCard";
import {
  PlayCircle,
  ArrowRight,
  Brain,
  AlertCircle,
  RefreshCw,
  Search,
  AlertTriangle,
  CheckCircle2,
  Target,
  Shield,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  ExternalLink,
} from "lucide-react";
import { searchService } from "@/services/searchService";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMobileFooterHeight } from "@/hooks/useMobileFooterHeight";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import type {
  PrepPlanRow,
  StagePlan,
  AssessmentSignal,
  PrepPriority,
  CandidatePositioning,
  EvidenceItem,
  EvidenceSourceType,
  Confidence,
  Priority,
} from "@/types/prepPlan";

// ── Types ────────────────────────────────────────────────────

interface InterviewQuestion {
  id: string;
  question: string;
  created_at: string;
}

interface InterviewStage {
  id: string;
  name: string;
  duration: string | null;
  interviewer: string | null;
  content: string | null;
  guidance: string | null;
  order_index: number;
  search_id: string;
  created_at: string;
  confidence?: Confidence | null;
  what_it_tests?: string[] | null;
  why_likely?: string | null;
  prep_priority?: Priority | null;
  question_themes?: string[] | null;
  prep_actions?: string[] | null;
  low_confidence_guidance?: string | null;
  questions: InterviewQuestion[];
  selected: boolean;
}

interface SearchData {
  id: string;
  company: string;
  role: string | null;
  country: string | null;
  status: string;
  created_at: string;
  banner_dismissed?: boolean;
}

const MOBILE_FOOTER_CLEARANCE_PX = 16;
// Floor used before the footer ref measures (first paint / jsdom) so the
// scroll content never sits under the fixed Start-practice bar. Matches the
// previous static pb-28 clearance.
const MOBILE_FOOTER_FALLBACK_PX = 112;

// ── Helpers ──────────────────────────────────────────────────

const confidenceColor = (c?: Confidence | null) => {
  if (c === "high") return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
  if (c === "medium") return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
};

const priorityColor = (p?: Priority | null) => {
  if (p === "high") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  if (p === "medium") return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
};

const priorityIcon = (p?: Priority | null) => {
  if (p === "high") return <Target className="h-3.5 w-3.5" />;
  if (p === "medium") return <TrendingUp className="h-3.5 w-3.5" />;
  return <Shield className="h-3.5 w-3.5" />;
};

// Maps an evidence source to a human label and trust framing. First-party means
// the user or the employer supplied it directly (their note, CV, the job post, or
// the company's own materials) — as opposed to a community report or a role norm.
const evidenceSourceMeta = (
  sourceType: EvidenceSourceType,
): { label: string; firstParty: boolean; badgeClass: string } => {
  const firstPartyBadge = "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
  switch (sourceType) {
    case "official_company":
      return { label: "Company source", firstParty: true, badgeClass: firstPartyBadge };
    case "official_job":
      return { label: "Job description", firstParty: true, badgeClass: firstPartyBadge };
    case "user_note":
      return { label: "Your note", firstParty: true, badgeClass: firstPartyBadge };
    case "cv":
      return { label: "Your CV", firstParty: true, badgeClass: firstPartyBadge };
    case "public_report":
      return {
        label: "Community report",
        firstParty: false,
        badgeClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
      };
    case "market_heuristic":
    default:
      return {
        label: "Role norm",
        firstParty: false,
        badgeClass: "bg-muted text-muted-foreground",
      };
  }
};

// Evidence URLs are model-generated (synthesizePrepPlan) and stored without
// validation, so a malformed or injected javascript:/data: value must never be
// rendered as a clickable link. Only absolute http(s) URLs are treated as safe.
const isSafeHttpUrl = (url: string | null): url is string => {
  if (!url) return false;
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

const formatSearchStatus = (status?: string) => {
  switch (status) {
    case "completed": return "Ready";
    case "processing": return "Processing";
    case "pending": return "Queued";
    case "failed": return "Failed";
    default: return null;
  }
};

// ── Skeleton ─────────────────────────────────────────────────

const DashboardSkeleton = ({ isMobile }: { isMobile: boolean }) => (
  <div id="main-content" className="min-h-screen bg-background">
    <Navigation />
    <div className={isMobile ? "px-4 py-5" : "container mx-auto px-4 py-8"}>
      <div className="space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-72 max-w-full" />
          <Skeleton className="h-4 w-56 max-w-full" />
        </div>
        <div className={isMobile ? "grid grid-cols-2 gap-3" : "grid gap-4 md:grid-cols-3"}>
          <Skeleton className="h-24 rounded-3xl" />
          <Skeleton className="h-24 rounded-3xl" />
          {!isMobile && <Skeleton className="h-24 rounded-3xl" />}
        </div>
        <div className="space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-36 rounded-3xl" />
          <Skeleton className="h-36 rounded-3xl" />
        </div>
      </div>
    </div>
  </div>
);

// ── Sub-components ───────────────────────────────────────────

function CompletionBanner({ company, onDismiss }: { company: string; onDismiss: () => void }) {
  return (
    <Alert className="mb-6 border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
      <CheckCircle2 className="h-4 w-4 text-green-600" />
      <AlertDescription className="flex items-center justify-between">
        <span>Research for <strong>{company}</strong> is complete. Your prep plan is ready.</span>
        <Button variant="ghost" size="sm" onClick={onDismiss} className="ml-4 shrink-0">
          Dismiss
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function WeakSignalNotice() {
  return (
    <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertDescription>
        <strong>Best-guess plan.</strong> Limited employer-specific evidence was available, so this
        plan leans on role norms. Treat stage order as approximate and focus on cross-stage practice
        first.
      </AlertDescription>
    </Alert>
  );
}

function AssessmentSignalsCard({ signals }: { signals: AssessmentSignal[] }) {
  if (!signals?.length) return null;

  const high = signals.filter((signal) => signal.importance === "high");
  const medium = signals.filter((signal) => signal.importance === "medium");
  const low = signals.filter((signal) => signal.importance === "low");

  const renderGroup = (items: AssessmentSignal[], label: string) => {
    if (!items.length) return null;

    return (
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        {items.map((signal, index) => {
          const accentClass =
            signal.importance === "high"
              ? "border-l-red-400"
              : signal.importance === "medium"
                ? "border-l-amber-400"
                : "border-l-slate-300 dark:border-l-slate-700";

          return (
            <div key={`${signal.name}-${index}`} className={`rounded-r-xl border-l-2 bg-muted/20 px-3 py-3 ${accentClass}`}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{signal.name}</p>
                <Badge className={`text-[10px] ${priorityColor(signal.importance)}`}>
                  {signal.importance}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{signal.rationale}</p>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Key assessment signals</CardTitle>
        <CardDescription>What this employer is most likely evaluating</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderGroup(high, "Critical signals")}
        {renderGroup(medium, "Supporting signals")}
        {renderGroup(low, "Context signals")}
      </CardContent>
    </Card>
  );
}

function PrepPrioritiesCard({ priorities }: { priorities: PrepPriority[] }) {
  if (!priorities?.length) return null;
  const high = priorities.filter(p => p.priority === "high");
  const medium = priorities.filter(p => p.priority === "medium");
  const low = priorities.filter(p => p.priority === "low");

  const renderGroup = (items: PrepPriority[], label: string) => {
    if (!items.length) return null;
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        {items.map((p, i) => (
          <div key={i} className="rounded-xl border bg-muted/20 p-3">
            <div className="flex items-center gap-2">
              {priorityIcon(p.priority)}
              <p className="text-sm font-medium">{p.label}</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{p.whyItMatters}</p>
            {p.recommendedActions?.length > 0 && (
              <ul className="mt-2 space-y-1">
                {p.recommendedActions.map((action, j) => (
                  <li key={j} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                    {action}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Prep priorities</CardTitle>
        <CardDescription>What to prepare first, and what to deprioritize</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {renderGroup(high, "Prepare first")}
        {renderGroup(medium, "Important but secondary")}
        {renderGroup(low, "Deprioritize for now")}
      </CardContent>
    </Card>
  );
}

function CandidatePositioningCard({ positioning }: { positioning: CandidatePositioning | null }) {
  const [expanded, setExpanded] = useState(true);
  if (!positioning) return null;
  const hasContent = positioning.strengthsToLeanOn?.length > 0 ||
    positioning.weakSpotsToAddress?.length > 0 ||
    positioning.storyCoverageGaps?.length > 0 ||
    positioning.mismatchRisks?.length > 0;
  if (!hasContent) return null;

  const renderList = ({
    items,
    label,
    subtitle,
    icon: Icon,
    iconClassName,
    sectionClassName,
  }: {
    items: string[] | undefined;
    label: string;
    subtitle: string;
    icon: typeof CheckCircle2;
    iconClassName: string;
    sectionClassName: string;
  }) => {
    if (!items?.length) return null;
    return (
      <div className={`space-y-3 rounded-xl p-3 ${sectionClassName}`}>
        <div className="flex items-start gap-3">
          <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClassName}`} />
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="text-sm text-foreground/85">{item}</li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Your positioning</CardTitle>
            <CardDescription>How your background maps to the assessment</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-label={expanded ? "Collapse positioning details" : "Expand positioning details"}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4">
          {renderList({
            items: positioning.strengthsToLeanOn,
            label: "Lean on",
            subtitle: "Highlight these in your answers",
            icon: CheckCircle2,
            iconClassName: "text-green-600",
            sectionClassName: "bg-green-50 dark:bg-green-950/40",
          })}
          {renderList({
            items: positioning.weakSpotsToAddress,
            label: "Address",
            subtitle: "Prepare responses for these gaps",
            icon: AlertTriangle,
            iconClassName: "text-amber-600",
            sectionClassName: "bg-amber-50 dark:bg-amber-950/40",
          })}
          {renderList({
            items: positioning.storyCoverageGaps,
            label: "Story gaps",
            subtitle: "Find examples to cover these",
            icon: Search,
            iconClassName: "text-blue-600",
            sectionClassName: "bg-blue-50 dark:bg-blue-950/40",
          })}
          {renderList({
            items: positioning.mismatchRisks,
            label: "Mismatch risks",
            subtitle: "Be ready if these come up",
            icon: AlertCircle,
            iconClassName: "text-red-600",
            sectionClassName: "bg-red-50 dark:bg-red-950/40",
          })}
        </CardContent>
      )}
    </Card>
  );
}

function PrepSummaryHero({
  company,
  selectedStageCount,
  selectedQuestionCount,
  topFocus,
  estimatedMinutes,
  onStartPractice,
  isOffline,
  isMobile,
}: {
  company: string;
  selectedStageCount: number;
  selectedQuestionCount: number;
  topFocus: string | null;
  estimatedMinutes: number;
  onStartPractice: () => void;
  isOffline: boolean;
  isMobile: boolean;
}) {
  const headline = selectedQuestionCount > 0
    ? `You're set up with ${selectedQuestionCount} question${selectedQuestionCount === 1 ? "" : "s"} across ${selectedStageCount} stage${selectedStageCount === 1 ? "" : "s"}.`
    : "Select at least one stage to unlock practice.";
  const focusLine = topFocus
    ? `Top focus: ${topFocus}.`
    : selectedQuestionCount > 0
      ? "Mix it up however you like — start with the stage that feels hardest."
      : null;

  return (
    <Card className="motion-surface border-primary/20 bg-primary/5">
      <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between md:py-6">
        <div className="min-w-0 space-y-1.5 border-l-4 border-primary/70 pl-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
            {company ? `${company} · prep summary` : "Prep summary"}
          </p>
          <p className="text-base font-semibold leading-6 text-foreground md:text-lg">
            {headline}
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            {focusLine}
            {focusLine ? " " : ""}
            {selectedQuestionCount > 0 && `~${estimatedMinutes} min end-to-end.`}
          </p>
        </div>
        {!isMobile && (
          <Button
            onClick={onStartPractice}
            disabled={selectedQuestionCount === 0 || isOffline}
            size="lg"
            className="motion-cta shrink-0 md:min-w-[220px]"
          >
            <PlayCircle className="mr-2 h-5 w-5" />
            Start practice{selectedQuestionCount > 0 ? ` · ${selectedQuestionCount}` : ""}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function PrepPriorityStrip({ priorities }: { priorities: PrepPriority[] }) {
  const visible = priorities.slice(0, 3);
  if (!visible.length) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">Top prep priorities</h2>
        <p className="mt-1 text-sm text-muted-foreground">Start here before reviewing every question.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {visible.map((priority) => (
          <div key={priority.label} className="rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-2">
              {priorityIcon(priority.priority)}
              <Badge className={`text-[10px] ${priorityColor(priority.priority)}`}>
                {priority.priority}
              </Badge>
            </div>
            <p className="mt-3 text-sm font-semibold">{priority.label}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{priority.whyItMatters}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HighLeverageQuestionsCard({ stages }: { stages: InterviewStage[] }) {
  const questions = stages
    .flatMap((stage) => (stage.questions || []).slice(0, 2).map((question) => ({
      ...question,
      stageName: stage.name,
    })))
    .slice(0, 5);

  if (!questions.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Highest-leverage questions</CardTitle>
        <CardDescription>Practice these first if you only have one short session.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {questions.map((question) => (
          <div key={question.id} className="rounded-2xl border bg-muted/20 p-4">
            <Badge variant="secondary" className="text-[10px]">{question.stageName}</Badge>
            <p className="mt-2 text-sm font-medium leading-6">{question.question}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

type GuidanceKey = "practice-first" | "senior-level" | "positioning";

interface GuidanceContext {
  company?: string;
  role?: string | null;
  prepPriorities: PrepPriority[];
  assessmentSignals: AssessmentSignal[];
}

interface GuidancePreset {
  key: GuidanceKey;
  label: string;
  build: (ctx: GuidanceContext) => string;
}

// Preset, deterministic pointers derived from the research plan. Templated
// guidance — not an LLM chat — so we surface only the fixed prompts and keep
// the copy honest about that.
const DASHBOARD_GUIDANCE_PRESETS: GuidancePreset[] = [
  {
    key: "practice-first",
    label: "What to practice first",
    build: ({ prepPriorities, assessmentSignals }) =>
      `Practice ${
        prepPriorities[0]?.label || assessmentSignals[0]?.name || "the first selected stage"
      } first. It is the clearest path from this research plan into a useful practice session.`,
  },
  {
    key: "senior-level",
    label: "Most senior-level questions",
    build: ({ assessmentSignals, company }) =>
      `Lean into ${
        assessmentSignals[0]?.name || "decision quality"
      }. Senior answers should show tradeoffs, constraints, and measurable impact for ${
        company || "this company"
      }.`,
  },
  {
    key: "positioning",
    label: "How to position my background",
    build: ({ assessmentSignals, prepPriorities, role }) =>
      `Position your background around ${
        assessmentSignals[0]?.name ||
        prepPriorities[0]?.label ||
        "the highest-priority interview signal"
      }${
        role ? ` for the ${role} role` : ""
      }. Use one concrete story, then explain why your decision was right for the context.`,
  },
];

function PrepAskPanel(ctx: GuidanceContext) {
  const [activeKey, setActiveKey] = useState<GuidanceKey>(DASHBOARD_GUIDANCE_PRESETS[0].key);

  const response = useMemo(() => {
    const preset =
      DASHBOARD_GUIDANCE_PRESETS.find((item) => item.key === activeKey) ??
      DASHBOARD_GUIDANCE_PRESETS[0];
    return preset.build(ctx);
  }, [activeKey, ctx]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4 text-primary" />
          Quick guidance
        </CardTitle>
        <CardDescription>Preset pointers pulled from this research plan — pick one.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {DASHBOARD_GUIDANCE_PRESETS.map((item) => (
            <Button
              key={item.key}
              type="button"
              variant={item.key === activeKey ? "default" : "outline"}
              size="sm"
              aria-pressed={item.key === activeKey}
              onClick={() => setActiveKey(item.key)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div className="rounded-xl bg-muted/40 p-3 text-sm leading-6" aria-live="polite">
          {response}
        </div>
      </CardContent>
    </Card>
  );
}

function EvidenceSourcesCard({ evidence }: { evidence: EvidenceItem[] }) {
  if (!evidence?.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Sources</CardTitle>
        <CardDescription>The evidence this plan was built from</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {evidence.map((item, index) => {
          const meta = evidenceSourceMeta(item.sourceType);
          return (
            <div key={item.id || `${item.sourceLabel}-${index}`} className="rounded-xl border bg-muted/20 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={`text-[10px] ${meta.badgeClass}`}>{meta.label}</Badge>
                {meta.firstParty && (
                  <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    First-party
                  </span>
                )}
              </div>
              {item.sourceLabel && <p className="mt-2 text-sm font-medium">{item.sourceLabel}</p>}
              {item.excerpt && <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.excerpt}</p>}
              {isSafeHttpUrl(item.url) && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  View source
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function DeepDiveSection({
  assessmentSignals,
  prepPriorities,
  candidatePositioning,
  evidence,
  isMobile,
}: {
  assessmentSignals: AssessmentSignal[];
  prepPriorities: PrepPriority[];
  candidatePositioning: CandidatePositioning | null;
  evidence: EvidenceItem[];
  isMobile: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const hasPositioning = Boolean(
    candidatePositioning && (
      candidatePositioning.strengthsToLeanOn?.length ||
      candidatePositioning.weakSpotsToAddress?.length ||
      candidatePositioning.storyCoverageGaps?.length ||
      candidatePositioning.mismatchRisks?.length
    )
  );
  const hasEvidence = evidence.length > 0;
  const hasAnything = assessmentSignals.length > 0 || prepPriorities.length > 0 || hasPositioning || hasEvidence;
  if (!hasAnything) return null;

  const itemLabels = [
    assessmentSignals.length > 0 ? "Assessment signals" : null,
    prepPriorities.length > 0 ? "Prep priorities" : null,
    hasPositioning ? "Your positioning" : null,
    hasEvidence ? "Sources" : null,
  ].filter(Boolean).join(" · ");

  return (
    <section className="motion-fade-in space-y-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-4 text-left transition-colors hover:bg-muted/40"
      >
        <div>
          <p className="text-sm font-semibold">
            {expanded ? "Hide deep dive" : "Deep dive — why this plan"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{itemLabels}</p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {expanded && (
        <div className="space-y-4 motion-fade-in">
          {candidatePositioning && (
            <CandidatePositioningCard positioning={candidatePositioning} />
          )}
          {isMobile ? (
            <div className="space-y-4">
              <PrepPrioritiesCard priorities={prepPriorities} />
              <AssessmentSignalsCard signals={assessmentSignals} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6">
              <AssessmentSignalsCard signals={assessmentSignals} />
              <PrepPrioritiesCard priorities={prepPriorities} />
            </div>
          )}
          <EvidenceSourcesCard evidence={evidence} />
        </div>
      )}
    </section>
  );
}

function StageRoadmapCard({
  stages,
  onToggle,
  isMobile,
}: {
  stages: InterviewStage[];
  onToggle: (id: string) => void;
  isMobile: boolean;
}) {
  if (isMobile) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Stage roadmap</CardTitle>
          <CardDescription>Select stages to include in your practice session</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stages.map((stage, index) => (
              <MobileStageCard
                key={stage.id}
                stage={stage}
                index={index}
                questionCount={stage.questions?.length || 0}
                selected={stage.selected}
                onToggle={onToggle}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Stage roadmap</CardTitle>
        <CardDescription>Select stages to include in your practice session</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="space-y-4">
          {stages.map((stage, index) => (
            <AccordionItem
              key={stage.id}
              value={stage.id}
              className={`rounded-xl border px-4 transition-colors ${
                stage.selected ? "border-primary/30 bg-primary/5" : ""
              }`}
            >
              <div className="flex items-center gap-3 py-4">
                <div className="shrink-0">
                  <Checkbox
                    checked={stage.selected}
                    onCheckedChange={() => onToggle(stage.id)}
                    aria-label={`${stage.selected ? "Deselect" : "Select"} ${stage.name}`}
                  />
                </div>
                <AccordionTrigger className="py-0 hover:no-underline">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 pr-4">
                    <Badge variant="outline" className="text-[10px]">Stage {index + 1}</Badge>
                    <h3 className="min-w-0 text-sm font-semibold">{stage.name}</h3>
                    {stage.confidence && (
                      <Badge className={`text-[10px] ${confidenceColor(stage.confidence)}`}>
                        {stage.confidence} confidence
                      </Badge>
                    )}
                    {stage.prep_priority && (
                      <Badge className={`text-[10px] ${priorityColor(stage.prep_priority)}`}>
                        {stage.prep_priority} priority
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {stage.questions?.length || 0} question{(stage.questions?.length || 0) === 1 ? "" : "s"}
                    </span>
                  </div>
                </AccordionTrigger>
              </div>
              {stage.low_confidence_guidance && (
                <div className="-mt-1 mb-4 ml-9 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <p className="text-xs leading-5 text-amber-900 dark:text-amber-200">
                    <span className="font-medium">Low confidence:</span> {stage.low_confidence_guidance}
                  </p>
                </div>
              )}
              <AccordionContent className="pb-4 pt-1">
                <div className="space-y-4 rounded-xl bg-muted/20 p-4">
                  {stage.what_it_tests && stage.what_it_tests.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Tests
                      </p>
                      <p className="text-sm text-foreground/85">{stage.what_it_tests.join(", ")}</p>
                    </div>
                  )}

                  {stage.why_likely && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Why likely
                      </p>
                      <p className="text-sm text-foreground/85">{stage.why_likely}</p>
                    </div>
                  )}

                  {stage.question_themes && stage.question_themes.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Question themes
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {stage.question_themes.map((theme, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">{theme}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {stage.prep_actions && stage.prep_actions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Prep actions
                      </p>
                      <ul className="space-y-1">
                        {stage.prep_actions.map((action, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-sm text-foreground/85">
                            <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-primary" />
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

// ── Main component ───────────────────────────────────────────

const Dashboard = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { isOffline } = useNetworkStatus();
  const [searchParams] = useSearchParams();
  const { searchId: urlSearchId } = useParams();

  const searchId = urlSearchId || searchParams.get('searchId');

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stages, setStages] = useState<InterviewStage[]>([]);
  const [searchData, setSearchData] = useState<SearchData | null>(null);
  const [prepPlan, setPrepPlan] = useState<PrepPlanRow | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { height: mobileFooterHeight, setRef: setMobileFooterElement } =
    useMobileFooterHeight(isMobile);

  const loadSearchData = useCallback(async () => {
    if (!searchId) return;
    setIsLoading(true);
    try {
      const result = await searchService.getSearchResults(searchId);

      if (result.success && result.search && result.stages) {
        setSearchData(result.search);
        setPrepPlan(result.prepPlan ?? null);

        const transformedStages = (result.stages as InterviewStage[])
          .sort((a, b) => a.order_index - b.order_index)
          .map((stage) => ({ ...stage, selected: true }));
        setStages(transformedStages);

        if (result.search.status === 'completed') {
          setIsLoading(false);
          setProgress(100);
          if (!result.search.banner_dismissed) {
            setShowBanner(true);
          }
        } else if (result.search.status === 'failed') {
          setError("Search processing failed. Please try again.");
          setIsLoading(false);
        }
      } else {
        setError(result.error?.message || "Failed to load search data");
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Error loading search data:", err);
      setError("An unexpected error occurred while loading data");
      setIsLoading(false);
    }
  }, [searchId]);

  useEffect(() => {
    if (!searchId) {
      setIsLoading(false);
      return;
    }
    loadSearchData();
    const poll = setInterval(async () => {
      const result = await searchService.getSearchResults(searchId);
      if (result.success && result.search) {
        if (result.search.status === 'pending' || result.search.status === 'processing') {
          await loadSearchData();
          setProgress(prev => Math.min(prev + 5, 95));
        } else {
          clearInterval(poll);
          await loadSearchData();
        }
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [searchId, loadSearchData]);

  useEffect(() => {
    if (searchData?.status === 'pending' || searchData?.status === 'processing') {
      const timer = setInterval(() => {
        setProgress(prev => Math.min(prev + 1, 95));
      }, 500);
      return () => clearInterval(timer);
    }
  }, [searchData?.status]);

  const handleStageToggle = (stageId: string) => {
    setStages(prev => prev.map(s => s.id === stageId ? { ...s, selected: !s.selected } : s));
  };

  const handleDismissBanner = async () => {
    setShowBanner(false);
    if (searchId) await searchService.dismissBanner(searchId);
  };

  const selectedQuestionCount = stages
    .filter(s => s.selected)
    .reduce((acc, s) => acc + (s.questions?.length || 0), 0);
  const selectedStageCount = stages.filter(s => s.selected).length;
  const topFocus = prepPlan?.prep_priorities?.find((priority) => priority.priority === "high")?.label || null;

  const startPractice = () => {
    if (isOffline) return;
    const selectedStages = stages.filter(s => s.selected);
    if (selectedStages.length > 0 && searchId) {
      navigate(`/practice?searchId=${searchId}&stages=${selectedStages.map(s => s.id).join(',')}`);
    }
  };

  const searchSubtitle = [searchData?.role, searchData?.country].filter(Boolean).join(' · ') || 'Interview Preparation';
  const searchStatusLabel = formatSearchStatus(searchData?.status);

  // Extract PrepPlan data
  const summary = prepPlan?.summary;
  const assessmentSignals = (prepPlan?.assessment_signals || []) as AssessmentSignal[];
  const prepPriorities = (prepPlan?.prep_priorities || []) as PrepPriority[];
  const candidatePositioning = (prepPlan?.candidate_positioning || null) as CandidatePositioning | null;
  const evidenceLog = (prepPlan?.internal_evidence_log || []) as EvidenceItem[];
  const isWeakSignal = summary?.weakSignalCase === true;

  // ── Empty state ──
  if (!searchId) {
    return (
      <div id="main-content" className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto text-center">
            <Card className="p-8">
              <CardHeader>
                <div className="flex items-center justify-center mb-4">
                  <Brain className="h-12 w-12 text-primary" />
                </div>
                <CardTitle>No Active Search</CardTitle>
                <CardDescription>
                  Start a new search to get personalized interview insights for any company
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button onClick={() => navigate('/')} size="lg" className="w-full">
                    <Search className="h-4 w-4 mr-2" />
                    Start New Search
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Open the History menu in the top bar to jump back into an earlier research run.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading && !searchData && !error) {
    return <DashboardSkeleton isMobile={isMobile} />;
  }

  if (error) {
    return (
      <div id="main-content" className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <CardTitle>Error Loading Interview Research</CardTitle>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              {isOffline && (
                <p className="mb-4 text-sm text-amber-700">
                  You&apos;re offline. Reconnect before you try loading this research again.
                </p>
              )}
              <Button onClick={() => { setError(null); setIsLoading(true); loadSearchData(); }} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button variant="outline" onClick={() => navigate('/')} className="w-full mt-2">
                Start New Search
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    const statusMessages: Record<string, string> = {
      pending: "Initializing research...",
      processing: "Analyzing company data and building your prep plan...",
      completed: "Research complete!",
    };
    const currentStatus = searchData?.status || 'pending';
    return (
      <div id="main-content" className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center">
              <Brain className="h-12 w-12 text-primary mx-auto mb-4" />
              <CardTitle>Building Your Prep Plan</CardTitle>
              <CardDescription>
                {searchData?.company && `for ${searchData.company}`}
                {searchData?.role && ` — ${searchData.role}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={progress} className="mb-4" />
              <p className="text-sm text-muted-foreground text-center">
                {statusMessages[currentStatus] || statusMessages.pending}
              </p>
              <p className="text-xs text-muted-foreground text-center mt-2">{progress}% complete</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Rough estimate: ~3.5 min per question
  const estimatedMinutes = Math.max(5, Math.round(selectedQuestionCount * 3.5));

  // ── Main dashboard content ──
  const content = (
    <>
      {/* Header */}
      <header className="space-y-2">
        {!isMobile && (
          <nav className="mb-3 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <span className="mx-2">›</span>
            <span className="text-foreground">{searchData?.company || 'Company'} Prep Plan</span>
          </nav>
        )}
        <div className="space-y-1">
          {isMobile && (
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
              Prep plan
            </p>
          )}
          <h1 className="min-w-0 break-words text-3xl font-bold leading-tight">
            {searchData?.company || 'Company'}
          </h1>
          <p className="min-w-0 break-words text-sm leading-6 text-muted-foreground">
            {searchSubtitle}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {searchStatusLabel && <Badge variant="secondary">{searchStatusLabel}</Badge>}
            {summary?.overallConfidence && (
              <Badge className={confidenceColor(summary.overallConfidence)}>
                {summary.overallConfidence} confidence
              </Badge>
            )}
            {summary?.industryFocus && summary.industryFocus !== 'unknown' && (
              <Badge variant="outline">{summary.industryFocus}</Badge>
            )}
            {summary?.level && summary.level !== 'unknown' && (
              <Badge variant="outline">{summary.level.replace('_', ' ')}</Badge>
            )}
          </div>
        </div>
      </header>

      {/* Completion banner */}
      {showBanner && searchData?.company && (
        <CompletionBanner company={searchData.company} onDismiss={handleDismissBanner} />
      )}

      {/* Weak signal notice */}
      {isWeakSignal && <WeakSignalNotice />}

      {isOffline && (
        <p className="text-sm text-amber-700">
          Reconnect to launch practice or refresh this research.
        </p>
      )}

      {/* Primary action zone — prep summary + Start Practice */}
      <PrepSummaryHero
        company={searchData?.company || ""}
        selectedStageCount={selectedStageCount}
        selectedQuestionCount={selectedQuestionCount}
        topFocus={topFocus}
        estimatedMinutes={estimatedMinutes}
        onStartPractice={startPractice}
        isOffline={isOffline}
        isMobile={isMobile}
      />

      <PrepPriorityStrip priorities={prepPriorities} />

      <PrepAskPanel
        company={searchData?.company}
        role={searchData?.role}
        prepPriorities={prepPriorities}
        assessmentSignals={assessmentSignals}
      />

      {/* Stage roadmap — the practice plan */}
      <StageRoadmapCard stages={stages} onToggle={handleStageToggle} isMobile={isMobile} />

      <HighLeverageQuestionsCard stages={stages} />

      {/* Deep dive — secondary info collapsed by default */}
      <DeepDiveSection
        assessmentSignals={assessmentSignals}
        prepPriorities={prepPriorities}
        candidatePositioning={candidatePositioning}
        evidence={evidenceLog}
        isMobile={isMobile}
      />
    </>
  );

  if (isMobile) {
    return (
      <div id="main-content" className="min-h-screen bg-background">
        <Navigation />
        <div
          className="px-4 py-5"
          style={{
            paddingBottom:
              mobileFooterHeight > 0
                ? `${mobileFooterHeight + MOBILE_FOOTER_CLEARANCE_PX}px`
                : `${MOBILE_FOOTER_FALLBACK_PX}px`,
          }}
        >
          <div className="space-y-5">
            {content}
          </div>
        </div>

        {/* Mobile bottom bar — CTA only; summary lives in PrepSummaryHero above */}
        <div
          ref={setMobileFooterElement}
          className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/85"
          data-mobile-dashboard-footer
        >
          <div className="mx-auto max-w-md" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
            <Button
              onClick={startPractice}
              disabled={selectedQuestionCount === 0 || isOffline}
              className="h-12 w-full rounded-2xl text-base"
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              Start practice{selectedQuestionCount > 0 ? ` · ${selectedQuestionCount}` : ""}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="main-content" className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {content}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
