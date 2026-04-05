import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
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
  Search
} from "lucide-react";
import { searchService } from "@/services/searchService";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { MobileStageCard } from "@/components/dashboard/MobileStageCard";

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
}

const formatSearchStatus = (status?: string) => {
  switch (status) {
    case "completed":
      return "Ready";
    case "processing":
      return "Processing";
    case "pending":
      return "Queued";
    case "failed":
      return "Failed";
    default:
      return null;
  }
};

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

const Dashboard = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { isOffline } = useNetworkStatus();
  const [searchParams] = useSearchParams();
  const { searchId: urlSearchId } = useParams();
  
  // Support both URL params and search params for backward compatibility
  const searchId = urlSearchId || searchParams.get('searchId');
  
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stages, setStages] = useState<InterviewStage[]>([]);
  const [searchData, setSearchData] = useState<SearchData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load search data and poll for updates
  const loadSearchData = async () => {
    if (!searchId) return;

    setIsLoading(true);
    try {
      const result = await searchService.getSearchResults(searchId);
      
      if (result.success && result.search && result.stages) {
        setSearchData(result.search);
        
        // Transform stages data and add selection state
        const transformedStages = result.stages
          .sort((a, b) => a.order_index - b.order_index)
          .map(stage => ({
            ...stage,
            selected: true // Default to selected
          }));
        
        setStages(transformedStages);
        
        // If search is completed, stop loading
        if (result.search.status === 'completed') {
          setIsLoading(false);
          setProgress(100);
        } else if (result.search.status === 'failed') {
          setError("Search processing failed. Please try again.");
          setIsLoading(false);
        }
        // If still processing, continue polling
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
      // No search ID provided - show default dashboard state
      setIsLoading(false);
      return;
    }

    // Initial load
    loadSearchData();

    // Set up polling for pending/processing searches
    const poll = setInterval(async () => {
      // Re-fetch current search data to check status
      const result = await searchService.getSearchResults(searchId);
      if (result.success && result.search) {
        const currentStatus = result.search.status;
        if (currentStatus === 'pending' || currentStatus === 'processing') {
          await loadSearchData();
          setProgress(prev => Math.min(prev + 5, 95)); // Increment progress while polling
        } else {
          // Search is completed, stop polling
          clearInterval(poll);
        }
      }
    }, 3000); // Poll every 3 seconds

    return () => {
      clearInterval(poll);
    };
  }, [searchId]); // Only depend on searchId so polling resets cleanly when the active research changes.

  // Progress simulation for pending/processing states
  useEffect(() => {
    if (searchData?.status === 'pending' || searchData?.status === 'processing') {
      const timer = setInterval(() => {
        setProgress(prev => Math.min(prev + 1, 95));
      }, 500);

      return () => clearInterval(timer);
    }
  }, [searchData?.status]);

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
      .reduce((acc, stage) => acc + getStageQuestionCount(stage), 0);
  };

  const getStageQuestionCount = (stage: any) => {
    return stage.questions?.length || 0;
  };

  const startPractice = () => {
    if (isOffline) return;

    const selectedStages = stages.filter(stage => stage.selected);
    if (selectedStages.length > 0 && searchId) {
      // Pass selected stage IDs to practice page
      const selectedStageIds = selectedStages.map(stage => stage.id);
      navigate(`/practice?searchId=${searchId}&stages=${selectedStageIds.join(',')}`);
    }
  };

  const selectedQuestionCount = getSelectedQuestions();
  const selectedStageCount = stages.filter(stage => stage.selected).length;
  const searchSubtitle = [
    searchData?.role,
    searchData?.country,
  ].filter(Boolean).join(' • ') || 'Interview Preparation';
  const searchStatusLabel = formatSearchStatus(searchData?.status);
  const overviewMetrics = [
    searchStatusLabel
      ? {
          label: "Search status",
          value: searchStatusLabel,
          helper: searchData?.status === "completed" ? "Ready for practice" : "Research is still updating",
        }
      : null,
    {
      label: "Interview stages",
      value: `${stages.length}`,
      helper: stages.length === 1 ? "Stage mapped" : "Stages mapped",
    },
    {
      label: "Selected questions",
      value: `${selectedQuestionCount}`,
      helper: "Questions currently queued for practice",
    },
  ].filter(Boolean) as Array<{ label: string; value: string; helper: string }>;

  // Show default empty state when no search ID is provided
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
                  <Button 
                    onClick={() => navigate('/')}
                    size="lg"
                    className="w-full"
                  >
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

  if (isLoading) {
    const statusMessages = {
      pending: "Initializing research...",
      processing: "Analyzing company data and generating personalized guidance...",
      completed: "Research complete!"
    };
    
    const currentStatus = searchData?.status || 'pending';
    
    return (
      <div id="main-content" className="min-h-screen bg-background">
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
              <Progress value={progress} className="mb-4" />
              <p className="text-sm text-muted-foreground text-center">
                {statusMessages[currentStatus as keyof typeof statusMessages] || statusMessages.pending}
              </p>
              <p className="text-xs text-muted-foreground text-center mt-2">
                {progress}% complete
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div id="main-content" className="min-h-screen bg-background">
        <Navigation />
        <div className="px-4 py-5 pb-36">
          <div className="space-y-5">
            <header className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
                Interview research
              </p>
              <div className="space-y-1">
                <h1 className="min-w-0 break-words text-3xl font-bold leading-tight">
                  {searchData?.company || 'Company'} Interview Research
                </h1>
                <p className="min-w-0 break-words text-sm leading-6 text-muted-foreground">
                  {searchSubtitle}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {searchStatusLabel && <Badge variant="secondary">{searchStatusLabel}</Badge>}
                {searchData?.role && <Badge variant="outline">{searchData.role}</Badge>}
                {searchData?.country && <Badge variant="outline">{searchData.country}</Badge>}
              </div>
            </header>

            <section className="grid grid-cols-2 gap-3">
              <Card className="rounded-[24px] border bg-muted/30 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Selected
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{selectedQuestionCount}</p>
                  <p className="mt-1 text-sm text-muted-foreground">questions ready</p>
                </CardContent>
              </Card>
              <Card className="rounded-[24px] border bg-muted/30 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Stages
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{stages.length}</p>
                  <p className="mt-1 text-sm text-muted-foreground">rounds available</p>
                </CardContent>
              </Card>
            </section>

            <section className="space-y-3">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">Preparation roadmap</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Pick the stages you want to practice. Details stay tucked away until you ask for them.
                </p>
              </div>

              <div className="space-y-3">
                {stages.map((stage, index) => (
                  <MobileStageCard
                    key={stage.id}
                    stage={stage}
                    index={index}
                    questionCount={getStageQuestionCount(stage)}
                    selected={stage.selected}
                    onToggle={handleStageToggle}
                  />
                ))}
              </div>
            </section>
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/85">
          <div
            className="mx-auto max-w-md space-y-3"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            <div className="rounded-[24px] border bg-card/95 px-4 py-3 shadow-sm">
              <p className="text-sm font-medium">
                {selectedQuestionCount} question{selectedQuestionCount === 1 ? '' : 's'} across {selectedStageCount} selected stage{selectedStageCount === 1 ? '' : 's'}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {isOffline
                  ? "Reconnect to launch practice. Your research stays available to review."
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
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-3">
              <h1 className="text-3xl font-bold">
                {searchData?.company || 'Company'} Interview Research
              </h1>
              <p className="text-muted-foreground">{searchSubtitle}</p>
              <div className="flex flex-wrap gap-2">
                {searchStatusLabel && <Badge variant="secondary">{searchStatusLabel}</Badge>}
                {searchData?.role && <Badge variant="outline">{searchData.role}</Badge>}
                {searchData?.country && <Badge variant="outline">{searchData.country}</Badge>}
              </div>
            </div>
            <Button onClick={startPractice} disabled={selectedQuestionCount === 0 || isOffline}>
              <PlayCircle className="h-4 w-4 mr-2" />
              Start Practice ({selectedQuestionCount} questions)
            </Button>
          </div>
          {isOffline && (
            <p className="text-sm text-amber-700">
              Reconnect to launch practice or refresh this research.
            </p>
          )}
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Research overview</CardTitle>
            <CardDescription>
              Only showing metrics backed by the current research record.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {overviewMetrics.map((metric) => (
                <div key={metric.label} className="rounded-2xl border bg-muted/20 p-5">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {metric.label}
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight">{metric.value}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{metric.helper}</p>
                </div>
              ))}
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
                            Practice Questions ({getStageQuestionCount(stage)})
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
