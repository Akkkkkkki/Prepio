import { ArrowLeft, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HintBannerProps {
  onDismiss: () => void;
}

export const HintBanner = ({ onDismiss }: HintBannerProps) => (
  <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 text-xs text-muted-foreground motion-slide-up sm:flex-row sm:items-center sm:justify-between">
    <div className="flex flex-col gap-1 text-foreground sm:flex-row sm:items-center sm:gap-4">
      <span className="flex items-center gap-2 text-sm font-medium">
        <ArrowLeft className="h-3.5 w-3.5" />
        Swipe left to skip
      </span>
      <span className="flex items-center gap-2 text-sm font-medium">
        <Star className="h-3.5 w-3.5" />
        Swipe right to favorite
      </span>
      <span className="text-xs text-muted-foreground">
        Gestures pause while you scroll vertically.
      </span>
    </div>
    <Button
      variant="link"
      size="sm"
      onClick={onDismiss}
      className="self-start px-0 text-primary"
    >
      Got it
    </Button>
  </div>
);
