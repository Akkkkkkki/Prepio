import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Star, SkipForward, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SavedPracticeAnswerRecord } from "@/hooks/usePracticeSession";

interface SessionSummaryProps {
  answeredCount: number;
  totalQuestions: number;
  skippedCount: number;
  favoritedCount: number;
  totalTime: number;
  avgTime: number;
  onSaveNotes: (notes: string) => Promise<boolean>;
  onStartNewSession: () => void;
  onBackToDashboard: () => void;
  historyHref?: string;
  isSaving?: boolean;
  disableSaveNotes?: boolean;
  saveNotesHelper?: string;
  savedAnswers?: SavedPracticeAnswerRecord[];
  onRateAnswer?: (answerId: string, rating: number) => Promise<void>;
  isSavingRating?: boolean;
  needsWorkQuestionIds?: Set<string>;
  onToggleNeedsWork?: (questionId: string) => Promise<void> | void;
}

export const SessionSummary = ({
  answeredCount,
  totalQuestions,
  skippedCount,
  favoritedCount,
  totalTime,
  avgTime,
  onSaveNotes,
  onStartNewSession,
  onBackToDashboard,
  historyHref = "/history",
  isSaving = false,
  disableSaveNotes = false,
  saveNotesHelper,
  savedAnswers = [],
  onRateAnswer,
  isSavingRating = false,
  needsWorkQuestionIds,
  onToggleNeedsWork,
}: SessionSummaryProps) => {
  const [sessionNotes, setSessionNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSaveNotes = async () => {
    if (notesSaved || disableSaveNotes) return;

    try {
      const didSave = await onSaveNotes(sessionNotes);
      if (didSave) {
        setNotesSaved(true);
      }
    } catch (error) {
      console.error("Error saving notes:", error);
    }
  };

  const flaggedCount = needsWorkQuestionIds?.size ?? 0;
  const progressCopy = answeredCount >= totalQuestions
    ? `You built answers for all ${totalQuestions} questions. Practice makes these sticky — come back tomorrow for another round.`
    : answeredCount > 0
      ? `You built answers for ${answeredCount} of ${totalQuestions} questions. Repetition is where it clicks — pick up where you left off tomorrow.`
      : `You made it through the session. Next time, try writing even a short outline for each question — small reps beat perfect ones.`;

  return (
    <Card className="motion-surface overflow-hidden motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-300">
      <CardHeader className="text-center">
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-success/10 p-4 motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-500">
            <CheckCircle className="h-12 w-12 text-success" />
          </div>
        </div>
        <CardTitle className="text-2xl tracking-tight">Reflection checkpoint</CardTitle>
        <CardDescription className="mx-auto max-w-md text-base leading-6">
          {progressCopy}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Reflection first — this is the highest-value action */}
        <div className="space-y-2">
          <div>
            <label className="text-sm font-semibold">What's one thing to improve next round?</label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Anything that felt weak, unclear, or where you wanted a concrete example.
            </p>
          </div>
          <Textarea
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            placeholder="e.g. 'My scoping for the sys-design question was vague — I need a go-to framework.'"
            className="min-h-[100px] resize-none rounded-2xl"
            disabled={notesSaved}
          />
          {!notesSaved && (
            <Button
              onClick={handleSaveNotes}
              disabled={isSaving || disableSaveNotes}
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving reflection...
                </>
              ) : (
                "Save reflection"
              )}
            </Button>
          )}
          {!notesSaved && disableSaveNotes && saveNotesHelper && (
            <p className="text-sm text-amber-700">{saveNotesHelper}</p>
          )}
          {notesSaved && (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle className="h-4 w-4" />
              Reflection saved to your history.
            </div>
          )}
        </div>

        {/* Review your answers — rate + flag needs-work */}
        {savedAnswers.length > 0 && onRateAnswer && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-semibold">Review your answers</label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Rate how strong each answer felt. Flag the ones you want to return to — they&apos;ll
                be top of the next session.
              </p>
            </div>
            <div className="space-y-3">
              {savedAnswers.map((answer) => {
                const needsWork = needsWorkQuestionIds?.has(answer.questionId) ?? false;
                return (
                  <div
                    key={answer.id}
                    className={cn(
                      "rounded-2xl border bg-background p-4 transition-colors",
                      needsWork && "border-amber-300 bg-amber-50/60 dark:bg-amber-950/30",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {answer.stageName}
                      </Badge>
                      {answer.audioUrl && (
                        <Badge variant="secondary" className="text-[10px]">Voice saved</Badge>
                      )}
                      {needsWork && (
                        <Badge className="bg-amber-100 text-[10px] text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                          Needs work
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-medium leading-6">{answer.question}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={`${answer.id}-${rating}`}
                            type="button"
                            className="rounded-full border p-2 transition hover:border-primary disabled:opacity-60"
                            aria-label={`Rate ${rating} stars — how confident was this answer?`}
                            disabled={isSavingRating}
                            onClick={() => void onRateAnswer(answer.id, rating)}
                          >
                            <Star
                              className={cn(
                                "h-4 w-4",
                                (answer.selfRating ?? 0) >= rating
                                  ? "fill-current text-amber-500"
                                  : "text-muted-foreground",
                              )}
                            />
                          </button>
                        ))}
                      </div>
                      {onToggleNeedsWork && (
                        <button
                          type="button"
                          onClick={() => void onToggleNeedsWork(answer.questionId)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                            needsWork
                              ? "border-amber-400 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                              : "border-border bg-background text-muted-foreground hover:border-amber-400 hover:text-amber-700",
                          )}
                          aria-pressed={needsWork}
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {needsWork ? "Flagged for review" : "Mark as needs work"}
                        </button>
                      )}
                    </div>
                    {(answer.textAnswer || answer.transcriptText) && (
                      <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
                        {answer.textAnswer || answer.transcriptText}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Session stats — demoted to a muted row, not a hero */}
        <div className="rounded-2xl border bg-muted/30 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span><span className="font-medium text-foreground">{answeredCount}</span> answered</span>
            {skippedCount > 0 && (
              <span><span className="font-medium text-foreground">{skippedCount}</span> skipped</span>
            )}
            <span><span className="font-medium text-foreground">{formatTime(totalTime)}</span> total</span>
            <span><span className="font-medium text-foreground">{formatTime(avgTime)}</span> avg</span>
            {favoritedCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <Star className="h-3 w-3 fill-current text-amber-500" />
                {favoritedCount} favorited
              </span>
            )}
            {flaggedCount > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <AlertTriangle className="h-3 w-3" />
                {flaggedCount} flagged
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <Button
            onClick={onStartNewSession}
            size="lg"
            className="motion-cta w-full"
          >
            <SkipForward className="mr-2 h-4 w-4" />
            {flaggedCount > 0
              ? `Start another round — start with flagged (${flaggedCount})`
              : "Start another round"}
          </Button>
          <Button
            variant="outline"
            onClick={onBackToDashboard}
            className="w-full"
          >
            Back to Dashboard
          </Button>
          <Link
            to={historyHref}
            className="block text-center text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            View practice history →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
