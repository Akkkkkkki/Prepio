import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Mic, MicOff, Play, RotateCcw, Square } from "lucide-react";

interface VoiceRecorderProps {
  isRecording: boolean;
  hasRecording: boolean;
  recordingTimeLabel: string;
  statusLabel: string;
  statusVariant: "default" | "secondary" | "destructive" | "outline";
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPlayRecording: () => void;
  onClearRecording: () => void;
  helperText: string;
  error?: string | null;
}

export function VoiceRecorder({
  isRecording,
  hasRecording,
  recordingTimeLabel,
  statusLabel,
  statusVariant,
  onStartRecording,
  onStopRecording,
  onPlayRecording,
  onClearRecording,
  helperText,
  error,
}: VoiceRecorderProps) {
  return (
    <div className="space-y-3 rounded-2xl border bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          Voice answer
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground transition hover:text-foreground"
                aria-label="Voice answer info"
              >
                <Info className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{helperText}</TooltipContent>
          </Tooltip>
        </div>
        <Badge variant={statusVariant} className="text-xs">
          {statusLabel}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground">{recordingTimeLabel}</p>

      <div className="flex flex-wrap gap-2">
        {!isRecording && !hasRecording && (
          <Button onClick={onStartRecording} className="min-w-[140px] flex-1">
            <Mic className="mr-2 h-4 w-4" />
            Start recording
          </Button>
        )}

        {isRecording && (
          <Button onClick={onStopRecording} variant="destructive" className="min-w-[140px] flex-1">
            <Square className="mr-2 h-4 w-4" />
            Stop
          </Button>
        )}

        {hasRecording && !isRecording && (
          <>
            <Button onClick={onPlayRecording} variant="outline" className="min-w-[140px] flex-1">
              <Play className="mr-2 h-4 w-4" />
              Play
            </Button>
            <Button onClick={onStartRecording} variant="outline" className="min-w-[140px] flex-1">
              <MicOff className="mr-2 h-4 w-4" />
              Re-record
            </Button>
            <Button onClick={onClearRecording} variant="ghost" size="sm" className="h-10 px-3">
              <RotateCcw className="mr-1 h-4 w-4" />
              Reset
            </Button>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
