import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import Navigation from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Building2, 
  Clock, 
  Users, 
  Target, 
  PlayCircle, 
  CheckCircle2,
  ArrowRight,
  Brain,
  AlertCircle,
  RefreshCw,
  Search,
  Target as TargetIcon,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { searchService } from "@/services/searchService";
import { useSearchProgress } from "@/hooks/useSearchProgress";
import type { PrepPlanRow, PrepPriority, QuestionPlan, AssessmentSignal } from "@/types/prepPlan";

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
  banner_dismissed?: boolean | null;
}

const priorityTone = (priority: PrepPriority["priority"]) => {
  if (priority === "high") return "bg-rose-100 text-rose-700";
  if (priority === "medium") return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
};

function DashboardEmptyState({ onStartSearch }: { onStartSearch: () => void }) {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <Card className="overflow-hidden border-dashed">
            <div className="grid gap-8 p-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  <Sparkles className="h-4 w-4" />
                  Interview prep starts here
                </div>
                <div className="space-y-3">
                  <h1 className="text-3xl font-semibold tracking-tight">
                    Start your first search and we&apos;ll turn it into a practice agenda.
                  </h1>
                  <p className="text-base text-muted-foreground">
                    Research a company, get stage-by-stage signals, and jump straight into the questions that matter most.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button size="lg" onClick={onStartSearch}>
                    <Search className="mr-2 h-4 w-4" />
                    Start your first search
                  </Button>
                  <div className="rounded-2xl border px-4 py-3 text-sm text-muted-foreground">
                    Tip: once research finishes, this dashboard becomes your prep plan and launch point for practice.
                  </div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-1">
                <div className="rounded-3xl border bg-muted/30 p-5">
                  <p className="text-sm font-medium">1. Research</p>
                  <p className="mt-2 text-sm text-muted-foreground">Company, role, and interview patterns.</p>
                </div>
                <div className="rounded-3xl border bg-muted/30 p-5">
                  <p className="text-sm font-medium">2. Plan</p>
                  <p className="mt-2 text-sm text-muted-foreground">Must-practice questions and prep priorities.</p>
                </div>
                <div className="rounded-3xl border bg-muted/30 p-5">
                  <p className="text-sm font-medium">3. Practice</p>
                  <p className="mt-2 text-sm text-muted-foreground">Focused sessions on the stages you pick.</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function QuestionPlanCard({ questionPlan }: { questionPlan: QuestionPlan | null | undefined }) {
  if (!questionPlan) return null;

  const sections = [
    { key: "core", label: "Must practice", items: questionPlan.coreMustPractice ?? [] },
    { key: "followUps", label: "Likely follow-ups", items: questionPlan.likelyFollowUps ?? [] },
    { key: "extraDepth", label: "Extra depth", items: questionPlan.extraDepth ?? [] },
  ].filter((section) => section.items.length > 0);

  if (sections.length === 0) return null;

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Practice agenda
        </CardTitle>
        <CardDescription>The AI already picked the question sequence. Start with the core set, then move deeper.</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" defaultValue={sections.map((section) => section.key)} className="space-y-3">
          {sections.map((section) => (
            <AccordionItem key={section.key} value={section.key} className="rounded-2xl border px-4">
              <AccordionTrigger className="py-4 text-left text-sm font-medium hover:no-underline">
                {section.label}
              </AccordionTrigger>
              <AccordionContent className="space-y-3 pb-4">
                {section.items.map((item, index) => (
                  <div key={`${section.key}-${index}`} className="rounded-2xl bg-muted/30 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.stageName && <Badge variant="outline">{item.stageName}</Badge>}
                      {item.linkedPriority && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          {item.linkedPriority}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-3 text-sm font-medium">{item.question}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{item.reason}</p>
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

function PrepPrioritiesCard({ priorities, signals }: { priorities: PrepPriority[]; signals: AssessmentSignal[] }) {
  if (priorities.length === 0 && signals.length === 0) return null;

  return (
    <div className="mb-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TargetIcon className="h-5 w-5 text-primary" />
            Prep priorities
          </CardTitle>
          <CardDescription>What to attack first before you spend time on everything else.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {priorities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No explicit prep priorities were generated for this run.</p>
          ) : (
            priorities.map((priority, index) => (
              <div key={`${priority.label}-${index}`} className="rounded-2xl border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={priorityTone(priority.priority)}>{priority.priority}</Badge>
                  <p className="font-medium">{priority.label}</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{priority.whyItMatters}</p>
                {priority.recommendedActions?.length > 0 && (
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {priority.recommendedActions.map((action, actionIndex) => (
                      <li key={`${priority.label}-action-${actionIndex}`} className="flex items-start gap-2">
                        <ChevronRight className="mt-0.5 h-4 w-4 text-primary" />
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Assessment signals</CardTitle>
          <CardDescription>What this interview loop is likely testing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {signals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Signals were not available for this run yet.</p>
          ) : (
            signals.map((signal, index) => (
              <div key={`${signal.name}-${index}`} className="rounded-2xl border bg-muted/20 p-4">
                <div className="flex items-center gap-2">
                  <Badge className={priorityTone(signal.importance as PrepPriority["priority"])}>
                    {signal.importance}
                  </Badge>
                  <p className="font-medium">{signal.name}</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{signal.rationale}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { searchId: urlSearchId } = useParams();
  
  // Support both URL params and search params for backward compatibility
  const searchId = urlSearchId || searchParams.get('searchId');
  
  const [isLoading, setIsLoading] = useState(false);
  const [stages, setStages] = useState<InterviewStage[]>([]);
  const [searchData, setSearchData] = useState<SearchData | null>(null);
  const [prepPlan, setPrepPlan] = useState<PrepPlanRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const { data: progressState } = useSearchProgress(searchId, { enabled: Boolean(searchId) });

  const currentStatus = progressState?.status ?? searchData?.status ?? "pending";
  const currentProgress = progressState?.progress_pct ?? (currentStatus === "completed" ? 100 : 0);
  const progressLabel = progressState?.progress_step || "Preparing your interview research...";

  const loadSearchData = async () => {
    if (!searchId) return;

    setIsLoading(true);
    try {
      const result = await searchService.getSearchResults(searchId);
      
      if (result.success && result.search && result.stages) {
        setSearchData(result.search);
        setPrepPlan((result.prepPlan as PrepPlanRow | null) ?? null);
        
        const transformedStages = result.stages
          .sort((a, b) => a.order_index - b.order_index)
          .map(stage => ({
            ...stage,
            selected: true
          }));
        
        setStages(transformedStages);

        if (result.search.status === 'failed') {
          setError("Search processing failed. Please try again.");
        }
      } else {
        setError(result.error?.message || "Failed to load search data");
      }
    } catch (err) {
      console.error("Error loading search data:", err);
      setError("An unexpected error occurred while loading data");
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  };

  useEffect(() => {
    if (!searchId) {
      setIsLoading(false);
      return;
    }

    loadSearchData();
  }, [searchId]);

  useEffect(() => {
    if (!searchId) return;
    if (currentStatus === "completed" || currentStatus === "failed") {
      loadSearchData();
    }
  }, [currentStatus, searchId]);

  const handleStageToggle = (stageId: string) => {
    setStages(prev => 
      prev.map(stage => 
        stage.id === stageId 
          ? { ...stage, selected: !stage.selected }
          : stage
      )
    );
  };

  const getSelectedQuestions = () => {
    return stages
      .filter(stage => stage.selected)
      .reduce((acc, stage) => acc + (stage.questions?.length || 0), 0);
  };

  const startPractice = () => {
    const selectedStages = stages.filter(stage => stage.selected);
    if (selectedStages.length > 0 && searchId) {
      // Pass selected stage IDs to practice page
      const selectedStageIds = selectedStages.map(stage => stage.id);
      navigate(`/practice?searchId=${searchId}&stages=${selectedStageIds.join(',')}`);
    }
  };

  // Show default empty state when no search ID is provided
  const prepPriorities = useMemo(
    () => (prepPlan?.prep_priorities ?? []) as PrepPriority[],
    [prepPlan],
  );
  const assessmentSignals = useMemo(
    () => (prepPlan?.assessment_signals ?? []) as AssessmentSignal[],
    [prepPlan],
  );
  const questionPlan = useMemo(
    () => (prepPlan?.question_plan ?? null) as QuestionPlan | null,
    [prepPlan],
  );

  if (!searchId) {
    return <DashboardEmptyState onStartSearch={() => navigate("/")} />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
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
              <Button 
                onClick={() => {
                  setError(null);
                  setIsLoading(true);
                  loadSearchData();
                }}
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/')}
                className="w-full mt-2"
              >
                Start New Search
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading && !hasLoadedOnce) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center">
              <Brain className="h-12 w-12 text-primary mx-auto mb-4" />
              <CardTitle>Researching Interview Insights</CardTitle>
              <CardDescription>
                {searchData?.company && `for ${searchData.company}`}
                {searchData?.role && ` - ${searchData.role}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={currentProgress} className="mb-4" />
              <p className="text-sm text-muted-foreground text-center">
                {progressLabel}
              </p>
              <p className="text-xs text-muted-foreground text-center mt-2">
                {Math.round(currentProgress)}% complete
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        {(currentStatus === "pending" || currentStatus === "processing") && (
          <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Brain className="h-5 w-5 text-primary" />
                Research in progress
              </CardTitle>
              <CardDescription>{progressLabel}</CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={currentProgress} className="mb-2" />
              <p className="text-sm text-muted-foreground">
                Safe to leave this page. We&apos;ll keep updating the dashboard as the run finishes.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold">
                {searchData?.company || 'Company'} Interview Research
              </h1>
              <p className="text-muted-foreground">
                {searchData?.role && `${searchData.role}`}
                {searchData?.role && searchData?.country && ' • '}
                {searchData?.country}
                {!searchData?.role && !searchData?.country && 'Interview Preparation'}
              </p>
            </div>
            <Button onClick={startPractice} disabled={getSelectedQuestions() === 0 || currentStatus !== "completed"}>
              <PlayCircle className="h-4 w-4 mr-2" />
              Start Practice ({getSelectedQuestions()} questions)
            </Button>
          </div>
        </div>

        <PrepPrioritiesCard priorities={prepPriorities} signals={assessmentSignals} />
        <QuestionPlanCard questionPlan={questionPlan} />

        {/* Interview Process Overview */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Interview Process Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Total Duration</p>
                  <p className="text-sm text-muted-foreground">3-4 weeks</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Interview Stages</p>
                  <p className="text-sm text-muted-foreground">{stages.length} rounds</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Focus Areas</p>
                  <p className="text-sm text-muted-foreground">Technical + Behavioral</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preparation Table */}
        <Card>
          <CardHeader>
            <CardTitle>Preparation Roadmap</CardTitle>
            <CardDescription>
              Select the stages you want to practice. Questions are personalized based on your CV.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {stages.map((stage, index) => (
                <div key={stage.id} className="border rounded-lg p-6">
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={stage.selected}
                      onCheckedChange={() => handleStageToggle(stage.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <Badge variant="outline" className="text-xs">
                          Stage {index + 1}
                        </Badge>
                        <h3 className="font-semibold">{stage.name}</h3>
                        <span className="text-sm text-muted-foreground">
                          {stage.duration || "Duration TBD"} • {stage.interviewer || "Interviewer TBD"}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                        <div>
                          <h4 className="text-sm font-medium mb-2">Content</h4>
                          <p className="text-sm text-muted-foreground">
                            {stage.content || "Interview content details"}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium mb-2">Targeted Guidance</h4>
                          <p className="text-sm text-muted-foreground">
                            {stage.guidance || "Preparation guidance will be provided"}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium mb-2">
                            Practice Questions ({stage.questions?.length || 0})
                          </h4>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {stage.questions?.slice(0, 2).map((questionObj, qIndex) => (
                              <li key={qIndex} className="flex items-start gap-2">
                                <ArrowRight className="h-3 w-3 mt-1 text-primary flex-shrink-0" />
                                {questionObj.question}
                              </li>
                            ))}
                            {(stage.questions?.length || 0) > 2 && (
                              <li className="text-xs text-muted-foreground">
                                +{(stage.questions?.length || 0) - 2} more basic questions
                              </li>
                            )}
                            {(!stage.questions || stage.questions.length === 0) && (
                              <li className="text-xs text-muted-foreground italic">
                                Questions will be generated during research
                              </li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
