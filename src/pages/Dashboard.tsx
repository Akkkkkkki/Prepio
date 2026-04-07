import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useParams, Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import { searchService } from "@/services/searchService";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import type {
  PrepPlanRow,
  StagePlan,
  AssessmentSignal,
  PrepPriority,
  CandidatePositioning,
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
        <strong>Best-guess process.</strong> Limited public data was available for this employer.
        The stage order may not be exact — focus on cross-stage practice first.
      </AlertDescription>
    </Alert>
  );
}

function AssessmentSignalsCard({ signals }: { signals: AssessmentSignal[] }) {
  if (!signals?.length) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Key assessment signals</CardTitle>
        <CardDescription>What this employer is most likely evaluating</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {signals.map((signal, i) => (
            <div key={i} className="flex items-start gap-3">
              <Badge className={`shrink-0 text-[10px] ${priorityColor(signal.importance)}`}>
                {signal.importance}
              </Badge>
              <div className="min-w-0">
                <p className="text-sm font-medium">{signal.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{signal.rationale}</p>
              </div>
            </div>
          ))}
        </div>
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
  if (!positioning) return null;
  const [expanded, setExpanded] = useState(false);
  const hasContent = positioning.strengthsToLeanOn?.length > 0 ||
    positioning.weakSpotsToAddress?.length > 0 ||
    positioning.storyCoverageGaps?.length > 0;
  if (!hasContent) return null;

  const renderList = (items: string[] | undefined, label: string) => {
    if (!items?.length) return null;
    return (
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
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
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-4">
          {renderList(positioning.strengthsToLeanOn, "Lean on")}
          {renderList(positioning.weakSpotsToAddress, "Address")}
          {renderList(positioning.storyCoverageGaps, "Story gaps")}
          {renderList(positioning.mismatchRisks, "Mismatch risks")}
        </CardContent>
      )}
    </Card>
  );
}

function StageRoadmapCard({
  stages,
  onToggle,
}: {
  stages: InterviewStage[];
  onToggle: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Stage roadmap</CardTitle>
        <CardDescription>Select stages to include in your practice session</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stages.map((stage, index) => (
            <div
              key={stage.id}
              className={`rounded-xl border p-4 transition-colors ${
                stage.selected ? "border-primary/30 bg-primary/5" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={stage.selected}
                  onCheckedChange={() => onToggle(stage.id)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-[10px]">Stage {index + 1}</Badge>
                    <h3 className="text-sm font-semibold">{stage.name}</h3>
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
                  </div>

                  {stage.what_it_tests && stage.what_it_tests.length > 0 && (
                    <p className="text-xs text-muted-foreground mb-2">
                      <span className="font-medium">Tests:</span> {stage.what_it_tests.join(", ")}
                    </p>
                  )}

                  {stage.why_likely && (
                    <p className="text-xs text-muted-foreground mb-2">{stage.why_likely}</p>
                  )}

                  {stage.question_themes && stage.question_themes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {stage.question_themes.map((theme, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">{theme}</Badge>
                      ))}
                    </div>
                  )}

                  {stage.prep_actions && stage.prep_actions.length > 0 && (
                    <ul className="space-y-1 mt-2">
                      {stage.prep_actions.map((action, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                          {action}
                        </li>
                      ))}
                    </ul>
                  )}

                  {stage.low_confidence_guidance && (
                    <p className="mt-2 text-xs italic text-amber-600 dark:text-amber-400">
                      {stage.low_confidence_guidance}
                    </p>
                  )}

                  <p className="mt-2 text-xs text-muted-foreground">
                    {stage.questions?.length || 0} question{(stage.questions?.length || 0) === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
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

  const loadSearchData = async () => {
    if (!searchId) return;
    setIsLoading(true);
    try {
      const result = await searchService.getSearchResults(searchId);

      if (result.success && result.search && result.stages) {
        setSearchData(result.search);

        const transformedStages = result.stages
          .sort((a: any, b: any) => a.order_index - b.order_index)
          .map((stage: any) => ({ ...stage, selected: true }));
        setStages(transformedStages);

        // Load prep plan
        const planResult = await searchService.getPrepPlan(searchId);
        if (planResult.success && planResult.prepPlan) {
          setPrepPlan(planResult.prepPlan);
        }

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
  };

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
        }
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [searchId]);

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
        <div className={isMobile ? "" : "flex items-center justify-between"}>
          <div className="space-y-1">
            {isMobile && (
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
                Prep plan
              </p>
            )}
            <h1 className={`min-w-0 break-words font-bold leading-tight ${isMobile ? "text-3xl" : "text-3xl"}`}>
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
          {!isMobile && (
            <Button onClick={startPractice} disabled={selectedQuestionCount === 0 || isOffline}>
              <PlayCircle className="h-4 w-4 mr-2" />
              Start Practice ({selectedQuestionCount})
            </Button>
          )}
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

      {/* Assessment signals + Prep priorities */}
      <div className={isMobile ? "space-y-4" : "grid grid-cols-2 gap-6"}>
        <AssessmentSignalsCard signals={assessmentSignals} />
        <PrepPrioritiesCard priorities={prepPriorities} />
      </div>

      {/* Candidate positioning */}
      <CandidatePositioningCard positioning={candidatePositioning} />

      {/* Stage roadmap */}
      <StageRoadmapCard stages={stages} onToggle={handleStageToggle} />
    </>
  );

  if (isMobile) {
    return (
      <div id="main-content" className="min-h-screen bg-background">
        <Navigation />
        <div className="px-4 py-5 pb-36">
          <div className="space-y-5">
            {content}
          </div>
        </div>

        {/* Mobile bottom bar */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <div className="mx-auto max-w-md space-y-3" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
            <div className="rounded-[24px] border bg-card/95 px-4 py-3 shadow-sm">
              <p className="text-sm font-medium">
                {selectedQuestionCount} question{selectedQuestionCount === 1 ? '' : 's'} across {selectedStageCount} stage{selectedStageCount === 1 ? '' : 's'}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {isOffline
                  ? "Reconnect to launch practice."
                  : selectedQuestionCount > 0
                  ? "Start practice when the mix looks right."
                  : "Select at least one stage to unlock practice."}
              </p>
            </div>
            <Button
              onClick={startPractice}
              disabled={selectedQuestionCount === 0 || isOffline}
              className="h-12 w-full rounded-2xl text-base"
            >
              <PlayCircle className="mr-2 h-4 w-4" />
              Start practice
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
