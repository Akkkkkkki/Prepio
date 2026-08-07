import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, BriefcaseBusiness, Info, Plus } from "lucide-react";

import Navigation from "@/components/Navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { badgeToneClassName } from "@/lib/designTokens";
import {
  searchService,
  type InterviewSummary,
  type InterviewSummaryState,
} from "@/services/searchService";

const stateLabels: Record<InterviewSummaryState, string> = {
  plan_ready: "Plan ready",
  in_progress: "In progress",
  processing: "Research in progress",
  failed: "Research needs attention",
};

const InterviewsSkeleton = () => (
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    {Array.from({ length: 3 }).map((_, index) => (
      <Skeleton key={index} className="h-64 rounded-[20px]" />
    ))}
  </div>
);

const InterviewCard = ({ interview }: { interview: InterviewSummary }) => {
  const isReady = interview.state === "plan_ready" || interview.state === "in_progress";
  const primaryLabel =
    interview.state === "in_progress"
      ? "Continue practice"
      : interview.state === "plan_ready"
        ? "Start practice"
        : interview.state === "failed"
          ? "Review research"
          : "View progress";
  const primaryHref = isReady
    ? `/practice?searchId=${interview.id}`
    : `/dashboard?searchId=${interview.id}`;
  const identity = [interview.company, interview.role].filter(Boolean).join(" · ");

  return (
    <Card className="flex h-full flex-col rounded-[20px] border-border/70 shadow-sm">
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            <BriefcaseBusiness className="h-5 w-5" aria-hidden="true" />
          </div>
          <Badge className={badgeToneClassName.neutral}>{stateLabels[interview.state]}</Badge>
        </div>
        <CardTitle className="text-xl leading-7">{identity}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        {isReady ? (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-1.5">
                  {interview.practicedQuestions} of {interview.totalQuestions} answered · {interview.progressPercent}%
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-muted-foreground transition hover:text-foreground"
                        aria-label="What the answered count means"
                      >
                        <Info className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      Counts questions you&apos;ve answered so far. Completed practice sessions show up in History.
                    </TooltipContent>
                  </Tooltip>
                </span>
              </div>
              <Progress value={interview.progressPercent} />
            </div>
            {interview.needsWorkCount > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {interview.needsWorkCount}{" "}
                  {interview.needsWorkCount === 1 ? "question still needs" : "questions still need"} work
                </p>
                <Button
                  asChild
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
                >
                  <Link to={`/practice?searchId=${interview.id}&focus=needs_work`}>
                    Practice these
                    <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            {interview.state === "failed"
              ? "Open the research run to review the error and try again."
              : "Your tailored plan is still being prepared."}
          </p>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2 sm:flex-row">
        <Button asChild className="w-full sm:flex-1">
          <Link to={primaryHref}>
            {primaryLabel}
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        {isReady && (
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link to={`/dashboard?searchId=${interview.id}`}>Plan</Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

const Interviews = () => {
  const [interviews, setInterviews] = useState<InterviewSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadInterviews = async () => {
      setIsLoading(true);
      setError(false);
      const result = await searchService.getInterviewSummaries();

      if (!isActive) return;

      if (!result.success || !result.interviews) {
        setError(true);
        setIsLoading(false);
        return;
      }

      setInterviews(result.interviews);
      setIsLoading(false);
    };

    void loadInterviews();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div id="main-content" className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto max-w-6xl space-y-8 px-4 py-8 md:py-12">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Your interviews</h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              Pick up where you left off or prepare for a new role.
            </p>
          </div>
          {interviews.length > 0 && (
            <Button asChild size="lg">
              <Link to="/new-interview">
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Prep a new interview
              </Link>
            </Button>
          )}
        </header>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>We couldn&apos;t load your interviews.</AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <InterviewsSkeleton />
        ) : interviews.length === 0 && !error ? (
          <Card className="mx-auto max-w-xl rounded-[20px] border-border/70 text-center shadow-sm">
            <CardHeader className="space-y-4">
              <div className="mx-auto rounded-2xl bg-primary/10 p-4 text-primary">
                <BriefcaseBusiness className="h-7 w-7" aria-hidden="true" />
              </div>
              <CardTitle className="text-2xl">Prepare for your next interview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                Build a tailored plan from the company, role, and experience you bring.
              </p>
            </CardContent>
            <CardFooter>
              <Button asChild size="lg" className="w-full">
                <Link to="/new-interview">
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  Prep a new interview
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {interviews.map((interview) => (
              <InterviewCard key={interview.id} interview={interview} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Interviews;
