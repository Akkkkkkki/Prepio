import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Star, SkipForward, Loader2 } from "lucide-react";
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

  const completionHeadline = answeredCount >= totalQuestions
    ? `Great depth — you worked through all ${totalQuestions} questions`
    : answeredCount > totalQuestions * 0.5
      ? `Solid session — you covered ${answeredCount} of ${totalQuestions} questions`
      : `Good start — ${answeredCount} question${answeredCount !== 1 ? 's' : ''} down, ${totalQuestions - answeredCount} to go`;

  return (
    <Card className="overflow-hidden text-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-300">
      <CardHeader>
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-success/10 p-4 motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-500">
            <CheckCircle className="h-12 w-12 text-success" />
          </div>
        </div>
        <CardTitle className="text-2xl">Practice complete</CardTitle>
        <CardDescription className="text-base">
          {completionHeadline}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-3 text-left sm:grid-cols-4">
          <div className="rounded-2xl bg-muted/40 p-4">
            <div className="text-3xl font-bold text-primary">{answeredCount}</div>
            <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">Answered</div>
          </div>
          <div className="rounded-2xl bg-muted/40 p-4">
            <div className="text-3xl font-bold text-muted-foreground">{skippedCount}</div>
            <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">Skipped</div>
          </div>
          <div className="rounded-2xl bg-muted/40 p-4">
            <div className="text-3xl font-bold text-primary">{formatTime(totalTime)}</div>
            <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">Total time</div>
          </div>
          <div className="rounded-2xl bg-muted/40 p-4">
            <div className="text-3xl font-bold text-primary">{favoritedCount}</div>
            <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">Favorited</div>
          </div>
        </div>

        <div className="rounded-2xl border bg-background p-4 text-left">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Average per answer</span>
            <span className="font-medium">{formatTime(avgTime)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Completion</span>
            <span className="font-medium">{answeredCount}/{totalQuestions}</span>
          </div>
          {favoritedCount > 0 && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Star className="h-4 w-4 text-amber-500 fill-current" />
              <span>{favoritedCount} question{favoritedCount !== 1 ? 's' : ''} worth revisiting</span>
            </div>
          )}
        </div>

        <div className="space-y-2 text-left">
          <label className="text-sm font-medium">What felt weak today?</label>
          <Textarea
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            placeholder="Add a short reflection for your next round..."
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
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
            <div className="flex items-center justify-center gap-2 text-sm text-success">
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
                Use 1 to 5 stars so the answers that need another pass stand out in history.
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
                        onClick={() => void onRateAnswer(answer.id, rating)}
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

        <div className="space-y-3 pt-2">
          <Button
            onClick={onStartNewSession}
            size="lg"
            className="w-full"
          >
            <SkipForward className="h-4 w-4 mr-2" />
            Start another round
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
            className="block text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            View practice history -&gt;
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
