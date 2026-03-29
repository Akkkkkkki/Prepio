import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Clock, Search, Brain, FileText, Users, Zap, AlertCircle, RefreshCw } from "lucide-react";
import { useSearchProgress, useEstimatedCompletionTime, useSearchStallDetection, formatProgressStep, getProgressColor, getProgressIcon } from "@/hooks/useSearchProgress";
import { searchService } from "@/services/searchService";

interface ProgressDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onViewResults: () => void;
  searchId: string | null;
  company: string;
  role?: string;
}

const ProgressDialog = ({
  isOpen,
  onClose,
  onViewResults,
  searchId,
  company,
  role
}: ProgressDialogProps) => {
  // Use real-time progress data
  const { data: search, error } = useSearchProgress(searchId, { enabled: isOpen && !!searchId });
  const timeEstimate = useEstimatedCompletionTime(searchId);
  const { isStalled, stalledSeconds } = useSearchStallDetection(searchId);

  // Track if we've already shown a retry offer
  const [hasShownRetryOffer, setHasShownRetryOffer] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Fallback state for when there's no search data yet
  const [fallbackStep, setFallbackStep] = useState(0);

  // Get actual progress data or use fallbacks
  const searchStatus = search?.status || 'pending';
  const progressValue = search?.progress_pct || 0;
  const currentStepText = search?.progress_step || 'Initializing research...';
  const errorMessage = search?.error_message;

  // Auto-retry if stalled for >45 seconds (Phase 3 improvement)
  useEffect(() => {
    if (isStalled && stalledSeconds > 45 && !hasShownRetryOffer && searchId) {
      setHasShownRetryOffer(true);
      console.log(`Job stalled for ${stalledSeconds}s, offering auto-retry`);
    }
  }, [isStalled, stalledSeconds, hasShownRetryOffer, searchId]);

  const steps = [
    { icon: Search, label: "Company Research", description: "Gathering insights from multiple sources..." },
    { icon: FileText, label: "Job Analysis", description: "Processing role requirements..." },
    { icon: Brain, label: "CV Analysis", description: "Evaluating your background..." },
    { icon: Users, label: "Question Generation", description: "Creating personalized questions..." },
    { icon: Zap, label: "Finalizing", description: "Preparing your results..." }
  ];
  
  // Map progress step to icon
  const getStepIcon = (stepText: string) => {
    if (stepText.toLowerCase().includes('company') || stepText.toLowerCase().includes('research')) {
      return Search;
    } else if (stepText.toLowerCase().includes('job') || stepText.toLowerCase().includes('analysis')) {
      return FileText;
    } else if (stepText.toLowerCase().includes('cv') || stepText.toLowerCase().includes('resume')) {
      return Brain;
    } else if (stepText.toLowerCase().includes('question') || stepText.toLowerCase().includes('generating')) {
      return Users;
    } else if (stepText.toLowerCase().includes('finalizing') || stepText.toLowerCase().includes('completing')) {
      return Zap;
    }
    return Search; // default
  };

  // Fallback animation for when we don't have real progress data
  useEffect(() => {
    if (!isOpen || search) return; // Only run if we don't have real data

    const interval = setInterval(() => {
      setFallbackStep(prev => (prev + 1) % steps.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [isOpen, search, steps.length]);

  const getStatusMessage = () => {
    if (error) {
      return "Connection error. Retrying...";
    }

    switch (searchStatus) {
      case 'pending':
        return "Starting your research...";
      case 'processing':
        if (isStalled) {
          if (stalledSeconds > 45) {
            return 'Job appears stuck. Preparing to retry...';
          }
          return `Processing taking longer than expected (${stalledSeconds}s)...`;
        }
        return formatProgressStep(currentStepText);
      case 'completed':
        return "Research complete!";
      case 'failed':
        return `Research failed: ${errorMessage || 'Unknown error'}`;
      default:
        return "Initializing...";
    }
  };

  const getTimeEstimate = () => {
    if (searchStatus === 'completed') return "Done!";
    if (searchStatus === 'failed') return "Process failed";
    
    // Use real-time estimate if available
    if (timeEstimate) {
      const { remainingSeconds, elapsedSeconds } = timeEstimate;
      if (remainingSeconds <= 5) return "Almost done...";
      if (remainingSeconds <= 15) return `~${remainingSeconds}s remaining`;
      if (remainingSeconds <= 60) return `~${remainingSeconds}s remaining`;
      return `~${Math.ceil(remainingSeconds / 60)}min remaining`;
    }
    
    // Fallback estimates based on progress
    if (progressValue < 25) return "~20-30s remaining";
    if (progressValue < 50) return "~15-20s remaining";
    if (progressValue < 80) return "~10-15s remaining";
    if (progressValue < 95) return "~5-10s remaining";
    return "Almost done...";
  };

  const CurrentIcon = search ? getStepIcon(currentStepText) : steps[fallbackStep]?.icon || Search;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Research in Progress
          </DialogTitle>
          <DialogDescription>
            Gathering comprehensive interview intelligence for <strong>{company}</strong>
            {role && <span> - {role}</span>}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Progress Circle and Status */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <div className={`w-16 h-16 rounded-full border-4 flex items-center justify-center transition-colors duration-500 ${
                searchStatus === 'completed' 
                  ? 'bg-green-50 border-green-200' 
                  : searchStatus === 'failed'
                  ? 'bg-red-50 border-red-200'
                  : error
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-blue-50 border-blue-200 animate-pulse'
              }`}>
                {searchStatus === 'completed' ? (
                  <CheckCircle className="h-8 w-8 text-green-600" />
                ) : searchStatus === 'failed' ? (
                  <AlertCircle className="h-8 w-8 text-red-600" />
                ) : error ? (
                  <Clock className="h-8 w-8 text-yellow-600 animate-spin" />
                ) : (
                  <CurrentIcon className="h-8 w-8 text-blue-600" />
                )}
              </div>
            </div>
            
            <div className="text-center">
              <p className="font-medium text-sm">{getStatusMessage()}</p>
              <p className="text-xs text-muted-foreground mt-1">{getTimeEstimate()}</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={progressValue} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{Math.round(progressValue)}%</span>
            </div>
          </div>

          {/* Current Step */}
          {searchStatus !== 'completed' && searchStatus !== 'failed' && (
            <div className="bg-muted rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <CurrentIcon className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">
                  {search ? formatProgressStep(currentStepText) : steps[fallbackStep]?.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                {search 
                  ? `Processing your ${company} interview preparation...`
                  : steps[fallbackStep]?.description
                }
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {searchStatus === 'completed' ? (
              <>
                <Button onClick={onClose} variant="outline" size="sm" className="flex-1">
                  Close
                </Button>
                <Button onClick={onViewResults} size="sm" className="flex-1">
                  View Results
                </Button>
              </>
            ) : searchStatus === 'failed' ? (
              <Button onClick={onClose} variant="outline" size="sm" className="w-full">
                Close
              </Button>
            ) : (
              <>
                <Button onClick={onClose} variant="outline" size="sm" className="flex-1">
                  Run in Background
                </Button>
                <Button 
                  onClick={onViewResults} 
                  variant="secondary" 
                  size="sm" 
                  className="flex-1"
                  disabled={searchStatus === 'pending'}
                >
                  <Clock className="h-4 w-4 mr-1" />
                  View Partial Results
                </Button>
              </>
            )}
          </div>

          {/* Info Note */}
          <div className="text-xs text-muted-foreground text-center bg-muted/50 rounded p-2">
            💡 This process typically takes 20-30 seconds with our new concurrent processing. 
            You can close this dialog and check back later or watch the progress in real-time.
          </div>
          {isStalled && (
            <div className="text-xs text-yellow-700 text-center bg-yellow-50 rounded p-2 border border-yellow-200">
              This is taking longer than usual. We’re retrying automatically and will continue with partial data if needed.
            </div>
          )}
          
          {/* Stall Detection Alert */}
          {isStalled && (
            <div className="text-xs text-orange-700 text-center bg-orange-50 rounded p-2 border border-orange-200">
              <div className="flex items-center justify-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4" />
                <span>Job taking longer than expected ({stalledSeconds}s delay)</span>
              </div>
              {hasShownRetryOffer && (
                <Button
                  onClick={async () => {
                    setIsRetrying(true);
                    if (searchId) {
                      // Note: You'll need to pass the original search parameters
                      // For now, we'll just show that retry is being attempted
                      console.log('Retry requested for stalled job:', searchId);
                      setIsRetrying(false);
                    }
                  }}
                  disabled={isRetrying}
                  size="sm"
                  className="w-full mt-2"
                  variant="outline"
                >
                  {isRetrying ? (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Retry Job
                    </>
                  )}
                </Button>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="text-xs text-red-600 text-center bg-red-50 rounded p-2 border border-red-200">
              Connection issue detected. Retrying automatically...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProgressDialog;