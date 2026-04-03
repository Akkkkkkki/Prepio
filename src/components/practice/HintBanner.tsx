import { ArrowLeft, FileText, Mic, SkipForward, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HintBannerProps {
  onDismiss: () => void;
}

export const HintBanner = ({ onDismiss }: HintBannerProps) => (
  <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 text-xs text-muted-foreground motion-slide-up sm:flex-row sm:items-center sm:justify-between">
    <div className="flex flex-col gap-1 text-foreground sm:flex-row sm:items-center sm:gap-4">
      <span className="flex items-center gap-2 text-sm font-medium">
        <Mic className="h-3.5 w-3.5" />
        Record for a full answer
      </span>
      <span className="flex items-center gap-2 text-sm font-medium">
        <FileText className="h-3.5 w-3.5" />
        Notes for quick bullets
      </span>
      <span className="flex items-center gap-2 text-sm font-medium">
        <SkipForward className="h-3.5 w-3.5" />
        Skip if you want a fresh question
      </span>
      <span className="text-xs text-muted-foreground">
        <ArrowLeft className="mr-1 inline h-3.5 w-3.5" />
        Swipe left to skip, right to
        <Star className="mx-1 inline h-3.5 w-3.5" />
        favorite.
      </span>
    </div>
    <Button
      variant="link"
      size="sm"
      onClick={onDismiss}
      className="self-start px-0 text-primary"
    >
      Start answering
    </Button>
  </div>
);
