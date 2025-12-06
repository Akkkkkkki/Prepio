import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildTransition } from "@/lib/motion";

interface BottomPracticeNavProps {
  currentIndex: number;
  answeredMap: Record<string, boolean>;
  questionOrder: { id: string; stage?: string }[];
  onJump: (index: number) => void;
  primaryLabel: string;
  primaryDisabled?: boolean;
  onPrimaryAction: () => void;
  isPrimaryLoading?: boolean;
}

export const BottomPracticeNav = ({
  currentIndex,
  answeredMap,
  questionOrder,
  onJump,
  primaryLabel,
  primaryDisabled,
  onPrimaryAction,
  isPrimaryLoading,
}: BottomPracticeNavProps) => (
  <div
    className="bottom-practice-nav sticky bottom-0 z-40 mt-6 flex w-full max-w-2xl items-center gap-3 rounded-3xl border bg-background/95 px-4 py-3 shadow-lg backdrop-blur motion-fade-in md:bottom-4 md:rounded-full"
    style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
  >
    <div className="flex flex-1 items-center justify-center overflow-x-auto px-2">
      <div className="flex items-center gap-2">
        {questionOrder.map((question, index) => {
          const answered = answeredMap[question.id];
          return (
            <button
              key={question.id}
              onClick={() => onJump(index)}
              type="button"
              aria-current={index === currentIndex ? "true" : undefined}
              aria-label={`Go to question ${index + 1}${answered ? " (answered)" : ""}`}
              title={`${question.stage || "Question"} ${index + 1}`}
              className={cn(
                "h-[12px] w-[12px] rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                index === currentIndex
                  ? "bg-primary shadow-inner shadow-primary/40 scale-125"
                  : answered
                  ? "bg-green-500/90 hover:scale-110"
                  : "bg-muted hover:bg-muted-foreground/60 hover:scale-110"
              )}
              style={{
                transition: buildTransition(
                  ["transform", "background-color", "box-shadow"],
                  "fast",
                  "easeInOut"
                ),
              }}
            />
          );
        })}
      </div>
    </div>

    <Button
      onClick={onPrimaryAction}
      disabled={primaryDisabled || isPrimaryLoading}
      className="flex-shrink-0 text-sm"
      aria-label={primaryLabel}
    >
      {isPrimaryLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {primaryLabel}
    </Button>
  </div>
);
