import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Star, SkipForward, Loader2 } from "lucide-react";
import type { SavedPracticeAnswerRecord } from "@/hooks/usePracticeSession";

interface SessionSummaryProps {
  answeredCount: number;
  totalQuestions: number;
  skippedCount: number;
  favoritedCount: number;
  totalTime: number;
  avgTime: number;
  onSaveNotes: (notes: string) => Promise<void>;
  onStartNewSession: () => void;
  onBackToDashboard: () => void;
  isSaving?: boolean;
  savedAnswers?: SavedPracticeAnswerRecord[];
  onRateAnswer?: (answerId: string, rating: number) => Promise<void>;
  isSavingRating?: boolean;
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
  isSaving = false,
  savedAnswers = [],
  onRateAnswer,
  isSavingRating = false,
}: SessionSummaryProps) => {
  const [sessionNotes, setSessionNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSaveNotes = async () => {
    if (notesSaved) return;
    
    try {
      await onSaveNotes(sessionNotes);
      setNotesSaved(true);
    } catch (error) {
      console.error("Error saving notes:", error);
    }
  };

  return (
    <Card className="text-center">
      <CardHeader>
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-green-100 p-4">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
        </div>
        <CardTitle className="text-2xl">Practice Session Complete!</CardTitle>
        <CardDescription>
          Great job! You've completed your practice session.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Session Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-6">
          <div className="space-y-1">
            <div className="text-3xl font-bold text-primary">{answeredCount}</div>
            <div className="text-xs text-muted-foreground">Answered</div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-bold text-amber-600">{skippedCount}</div>
            <div className="text-xs text-muted-foreground">Skipped</div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-bold text-primary">{formatTime(totalTime)}</div>
            <div className="text-xs text-muted-foreground">Total Time</div>
          </div>
          <div className="space-y-1">
            <div className="text-3xl font-bold text-primary">{formatTime(avgTime)}</div>
            <div className="text-xs text-muted-foreground">Avg. Per Question</div>
          </div>
        </div>

        {/* Favorites Count */}
        {favoritedCount > 0 && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Star className="h-4 w-4 text-amber-500 fill-current" />
            <span>{favoritedCount} question{favoritedCount !== 1 ? 's' : ''} favorited</span>
          </div>
        )}

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Completion</span>
            <span className="font-medium">{answeredCount}/{totalQuestions}</span>
          </div>
          <Progress value={(answeredCount / totalQuestions) * 100} className="h-2" />
        </div>

        {/* Session Notes */}
        <div className="space-y-2 text-left">
          <label className="text-sm font-medium">Session Notes (Optional)</label>
          <Textarea
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            placeholder="Add any notes about this practice session..."
            className="min-h-[100px] resize-none"
            disabled={notesSaved}
          />
          {!notesSaved && (
            <Button
              onClick={handleSaveNotes}
              disabled={isSaving}
              variant="outline"
              size="sm"
              className="w-full"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Notes"
              )}
            </Button>
          )}
          {notesSaved && (
            <div className="flex items-center justify-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              Notes saved
            </div>
          )}
        </div>

        {savedAnswers.length > 0 && onRateAnswer && (
          <div className="space-y-3 text-left">
            <div>
              <label className="text-sm font-medium">Self-rate each answer</label>
              <p className="text-sm text-muted-foreground">
                Use 1 to 5 stars so your weaker answers are easier to revisit later.
              </p>
            </div>
            <div className="space-y-3">
              {savedAnswers.map((answer) => (
                <div key={answer.id} className="rounded-2xl border bg-background p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {answer.stageName}
                    </span>
                    {answer.audioUrl && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        Voice saved
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-medium">{answer.question}</p>
                  <div className="mt-3 flex gap-1">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={`${answer.id}-${rating}`}
                        type="button"
                        className="rounded-full border p-2 transition hover:border-primary disabled:opacity-60"
                        aria-label={`Rate ${answer.question} ${rating} stars`}
                        disabled={isSavingRating}
                        onClick={() => onRateAnswer(answer.id, rating)}
                      >
                        <Star
                          className={`h-4 w-4 ${
                            (answer.selfRating ?? 0) >= rating
                              ? "fill-current text-amber-500"
                              : "text-muted-foreground"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  {(answer.textAnswer || answer.transcriptText) && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {answer.textAnswer || answer.transcriptText}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-4">
          <Button
            onClick={onStartNewSession}
            size="lg"
            className="w-full"
          >
            <SkipForward className="h-4 w-4 mr-2" />
            Start New Practice Session
          </Button>
          <Button
            variant="outline"
            onClick={onBackToDashboard}
            className="w-full"
          >
            Back to Dashboard
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
