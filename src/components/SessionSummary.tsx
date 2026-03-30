import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Star, SkipForward, Loader2 } from "lucide-react";

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
    <Card className="overflow-hidden text-center">
      <CardHeader>
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-green-100 p-4">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
        </div>
        <CardTitle className="text-2xl">Practice complete</CardTitle>
        <CardDescription>
          Review the round, jot a quick reflection, then decide what to do next.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-3 text-left sm:grid-cols-4">
          <div className="rounded-2xl bg-muted/40 p-4">
            <div className="text-3xl font-bold text-primary">{answeredCount}</div>
            <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">Answered</div>
          </div>
          <div className="rounded-2xl bg-muted/40 p-4">
            <div className="text-3xl font-bold text-amber-600">{skippedCount}</div>
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
              disabled={isSaving}
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
          {notesSaved && (
            <div className="flex items-center justify-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              Notes saved
            </div>
          )}
        </div>

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
        </div>
      </CardContent>
    </Card>
  );
};
