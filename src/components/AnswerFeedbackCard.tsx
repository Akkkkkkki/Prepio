import { Brain, CheckCircle2, Loader2, RefreshCw, Target, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type AnswerFeedback,
  type AnswerFeedbackErrorCode,
  hasRenderableFeedback,
} from "@/shared/answer-feedback";

export type AnswerFeedbackAccess = "loading" | "free" | "paid";
export type AnswerFeedbackStatus = "idle" | "generating" | "error";

interface AnswerFeedbackCardProps {
  access: AnswerFeedbackAccess;
  feedback?: AnswerFeedback | null;
  status?: AnswerFeedbackStatus;
  errorCode?: AnswerFeedbackErrorCode | null;
  onGenerate?: () => void;
  onRegenerate?: () => void;
  /** Hide regenerate where it doesn't belong (e.g. read-only contexts). */
  allowRegenerate?: boolean;
  className?: string;
}

const ERROR_COPY: Record<string, string> = {
  answer_too_short: "Add a bit more to your answer (20+ characters) to get coaching.",
  paid_entitlement_required: "Your plan no longer includes coaching.",
  feedback_generation_failed: "Couldn't generate coaching just now. Try again.",
  practice_answer_not_found: "We couldn't find this saved answer.",
  practice_context_not_found: "The research behind this question is no longer available.",
};

function errorMessage(code?: AnswerFeedbackErrorCode | null): string {
  if (!code) return "Couldn't generate coaching just now. Try again.";
  return ERROR_COPY[code] ?? "Couldn't generate coaching just now. Try again.";
}

const STAR_LABELS: Array<{ key: keyof AnswerFeedback["starBreakdown"]; label: string }> = [
  { key: "situation", label: "S" },
  { key: "task", label: "T" },
  { key: "action", label: "A" },
  { key: "result", label: "R" },
];

const FeedbackBody = ({ feedback }: { feedback: AnswerFeedback }) => {
  const star = feedback.starBreakdown;
  const hasStar = Boolean(star.situation || star.task || star.action || star.result);

  return (
    <div className="mt-3 space-y-3">
      {feedback.strengths.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Strengths
          </div>
          <ul className="space-y-1">
            {feedback.strengths.map((item, index) => (
              <li key={`s-${index}`} className="flex gap-2 text-sm leading-5">
                <span className="text-success">•</span>
                <span>
                  <span className="font-medium">{item.text}</span>
                  {item.evidence && (
                    <span className="text-muted-foreground"> — {item.evidence}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {feedback.improvements.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <TriangleAlert className="h-3.5 w-3.5" />
            Improve
          </div>
          <ul className="space-y-1">
            {feedback.improvements.map((item, index) => (
              <li key={`i-${index}`} className="flex gap-2 text-sm leading-5">
                <span className="text-amber-500">•</span>
                <span>
                  <span className="font-medium">{item.text}</span>
                  {item.evidence && (
                    <span className="text-muted-foreground"> — {item.evidence}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasStar && (
        <div className="flex flex-wrap gap-1.5">
          {STAR_LABELS.map(({ key, label }) => {
            const value = star[key];
            if (!value) return null;
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px] leading-4"
                title={value}
              >
                <span className="font-semibold text-primary">{label}</span>
                <span className="max-w-[16rem] truncate text-muted-foreground">{value}</span>
              </span>
            );
          })}
        </div>
      )}

      {feedback.nextAction.text && (
        <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
          <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm leading-5">
            <span className="font-semibold">Next: </span>
            {feedback.nextAction.text}
          </p>
        </div>
      )}
    </div>
  );
};

export const AnswerFeedbackCard = ({
  access,
  feedback,
  status = "idle",
  errorCode,
  onGenerate,
  onRegenerate,
  allowRegenerate = true,
  className,
}: AnswerFeedbackCardProps) => {
  const isGenerating = status === "generating";
  const hasFeedback = Boolean(feedback && hasRenderableFeedback(feedback));

  return (
    <div className={cn("rounded-xl border bg-primary/5 p-3", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">
              {access === "paid"
                ? "Detailed coaching"
                : access === "loading"
                  ? "Checking coaching access"
                  : "Detailed coaching is paid"}
            </p>
            {access === "free" && (
              <Badge variant="secondary" className="text-[11px]">
                Paid
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {access === "paid"
              ? "AI reviews structure, missing proof, STAR quality, and one next action."
              : access === "loading"
                ? "We confirm access before showing any AI feedback action."
                : "Free answers stay saved and rateable without generating AI feedback."}
          </p>
        </div>

        {access === "loading" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking
          </div>
        )}

        {access === "paid" && !hasFeedback && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            disabled={isGenerating}
            onClick={onGenerate}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Brain className="mr-2 h-4 w-4" />
                Get detailed coaching
              </>
            )}
          </Button>
        )}

        {access === "paid" && hasFeedback && allowRegenerate && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="shrink-0 text-muted-foreground"
            disabled={isGenerating}
            onClick={onRegenerate}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {isGenerating ? "" : "Regenerate"}
          </Button>
        )}
      </div>

      {access === "paid" && status === "error" && !hasFeedback && (
        <p className="mt-3 flex items-center gap-1.5 text-xs leading-5 text-destructive">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
          {errorMessage(errorCode)}
        </p>
      )}

      {access === "paid" && hasFeedback && feedback && <FeedbackBody feedback={feedback} />}
    </div>
  );
};
