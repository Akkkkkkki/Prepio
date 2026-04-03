import { useEffect, useState } from "react";
import {
  AlertCircle,
  Brain,
  CheckCircle,
  Clock,
  FileText,
  Search,
  Sparkles,
} from "lucide-react";

import { useEstimatedCompletionTime, useSearchProgress, useSearchStallDetection, formatProgressStep } from "@/hooks/useSearchProgress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ProgressDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onViewResults: () => void;
  searchId: string | null;
  company: string;
  role?: string;
}

const PROGRESS_STAGES = [
  {
    label: "Collecting sources",
    description: "Pulling company, role, and interview signals from the web.",
    icon: Search,
  },
  {
    label: "Building interview stages",
    description: "Turning the research into likely rounds, expectations, and question buckets.",
    icon: FileText,
  },
  {
    label: "Preparing practice",
    description: "Generating tailored questions, guidance, and next-step practice material.",
    icon: Sparkles,
  },
] as const;

const getStageIndex = (
  status: "pending" | "processing" | "completed" | "failed",
  progressValue: number,
  currentStepText: string,
  fallbackIndex: number,
) => {
  if (status === "completed") return PROGRESS_STAGES.length - 1;

  const normalizedStep = currentStepText.toLowerCase();

  if (
    normalizedStep.includes("question") ||
    normalizedStep.includes("practice") ||
    normalizedStep.includes("final") ||
    progressValue >= 72
  ) {
    return 2;
  }

  if (
    normalizedStep.includes("stage") ||
    normalizedStep.includes("analysis") ||
    normalizedStep.includes("interview") ||
    normalizedStep.includes("resume") ||
    normalizedStep.includes("cv") ||
    progressValue >= 35
  ) {
    return 1;
  }

  if (status === "pending") {
    return Math.min(fallbackIndex, 0);
  }

  return 0;
};

const ProgressDialog = ({
  isOpen,
  onClose,
  onViewResults,
  searchId,
  company,
  role,
}: ProgressDialogProps) => {
  const { data: search, error } = useSearchProgress(searchId, { enabled: isOpen && !!searchId });
  const timeEstimate = useEstimatedCompletionTime(searchId);
  const { isStalled, stalledSeconds } = useSearchStallDetection(searchId);
  const [fallbackStage, setFallbackStage] = useState(0);

  const searchStatus = search?.status || "pending";
  const progressValue = search?.progress_pct || 0;
  const currentStepText = search?.progress_step || "Initializing research...";
  const errorMessage = search?.error_message;
  const activeStageIndex = getStageIndex(searchStatus, progressValue, currentStepText, fallbackStage);
  const CurrentIcon = searchStatus === "completed" ? CheckCircle : PROGRESS_STAGES[activeStageIndex].icon;

  useEffect(() => {
    if (!isOpen || search) return;

    const interval = setInterval(() => {
      setFallbackStage((prev) => (prev + 1) % PROGRESS_STAGES.length);
    }, 2200);

    return () => clearInterval(interval);
  }, [isOpen, search]);

  const getStatusMessage = () => {
    if (error) {
      return "Connection issue. Retrying in the background.";
    }

    switch (searchStatus) {
      case "pending":
        return "Queued and ready to start";
      case "processing":
        return formatProgressStep(currentStepText);
      case "completed":
        return "Research complete";
      case "failed":
        return errorMessage ? `Research failed: ${errorMessage}` : "Research failed";
      default:
        return "Initializing...";
    }
  };

  const getTimeEstimate = () => {
    if (searchStatus === "completed") return "Done";
    if (searchStatus === "failed") return "Needs attention";
    if (timeEstimate) {
      if (timeEstimate.remainingSeconds <= 5) return "Almost done";
      if (timeEstimate.remainingSeconds <= 60) return `~${timeEstimate.remainingSeconds}s remaining`;
      return `~${Math.ceil(timeEstimate.remainingSeconds / 60)} min remaining`;
    }
    if (searchStatus === "pending") return "Starting shortly";
    return "Usually under a minute";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md overflow-hidden p-0 sm:max-w-md">
        <div className="border-b px-6 py-5">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Research in progress
            </DialogTitle>
            <DialogDescription className="pt-1 text-sm leading-6">
              Building interview prep for <strong>{company}</strong>
              {role && <span> - {role}</span>}.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-full border-4",
                searchStatus === "completed"
                  ? "border-green-200 bg-green-50"
                  : searchStatus === "failed"
                    ? "border-red-200 bg-red-50"
                    : error
                      ? "border-yellow-200 bg-yellow-50"
                      : "border-primary/20 bg-primary/5",
              )}
            >
              {searchStatus === "failed" ? (
                <AlertCircle className="h-8 w-8 text-red-600" />
              ) : error ? (
                <Clock className="h-8 w-8 text-yellow-600" />
              ) : (
                <CurrentIcon
                  className={cn(
                    "h-8 w-8",
                    searchStatus === "completed" ? "text-green-600" : "text-primary",
                  )}
                />
              )}
            </div>

            <div className="space-y-1">
              <p className="font-medium">{getStatusMessage()}</p>
              <p className="text-xs text-muted-foreground">{getTimeEstimate()}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Progress value={progressValue} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Overall progress</span>
              <span>{Math.round(progressValue)}%</span>
            </div>
          </div>

          <div className="space-y-3">
            {PROGRESS_STAGES.map((stage, index) => {
              const StageIcon = stage.icon;
              const isComplete = searchStatus === "completed" || index < activeStageIndex;
              const isCurrent = searchStatus !== "completed" && index === activeStageIndex;

              return (
                <div
                  key={stage.label}
                  className={cn(
                    "rounded-2xl border p-4 transition-colors",
                    isCurrent
                      ? "border-primary/30 bg-primary/5"
                      : isComplete
                        ? "border-green-200 bg-green-50/70"
                        : "bg-muted/20",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "mt-0.5 flex h-9 w-9 items-center justify-center rounded-full border",
                        isCurrent
                          ? "border-primary/30 bg-background text-primary"
                          : isComplete
                            ? "border-green-200 bg-background text-green-600"
                            : "border-border bg-background text-muted-foreground",
                      )}
                    >
                      {isComplete ? <CheckCircle className="h-4 w-4" /> : <StageIcon className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{stage.label}</p>
                        {isCurrent && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-primary">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-xs leading-5 text-muted-foreground">{stage.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
            Safe to leave this screen. Research keeps running, and you can reopen the latest status from the dashboard whenever you want.
          </div>

          {isStalled && (
            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              This run is slower than usual. We have not lost it, but it has been quiet for about {stalledSeconds}s.
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              We hit a connection problem while checking progress. The job may still be running.
            </div>
          )}

          <div className="flex gap-3">
            {searchStatus === "completed" ? (
              <>
                <Button onClick={onClose} variant="outline" className="h-11 flex-1">
                  Close
                </Button>
                <Button onClick={onViewResults} className="h-11 flex-1">
                  View results
                </Button>
              </>
            ) : searchStatus === "failed" ? (
              <>
                <Button onClick={onClose} variant="outline" className="h-11 flex-1">
                  Close
                </Button>
                <Button onClick={onViewResults} className="h-11 flex-1">
                  View research progress
                </Button>
              </>
            ) : (
              <>
                <Button onClick={onClose} variant="outline" className="h-11 flex-1">
                  Close and keep running
                </Button>
                <Button onClick={onViewResults} className="h-11 flex-1">
                  View research progress
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProgressDialog;
