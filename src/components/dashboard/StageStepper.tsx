import { Fragment } from "react";
import { ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StageStepperItem {
  id: string;
  name: string;
  selected?: boolean;
}

/**
 * A compact, read-only overview of the interview journey — the sequence of
 * stages a candidate will face (e.g. Recruiter → Hiring manager → Onsite).
 * It sits above the selectable stage roadmap to answer "what's the arc?" at a
 * glance, without re-stating each stage's detail. Selected stages (the ones
 * included in practice) carry a check; the highest-leverage stage is accented.
 */
export function StageStepper({
  stages,
  topStageId,
  className,
}: {
  stages: StageStepperItem[];
  topStageId: string | null;
  className?: string;
}) {
  if (stages.length < 2) return null;

  return (
    <nav
      aria-label="Interview stages"
      className={cn("flex items-center gap-1 overflow-x-auto pb-1", className)}
    >
      {stages.map((stage, index) => {
        const isStart = stage.id === topStageId;
        return (
          <Fragment key={stage.id}>
            {index > 0 && (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
            )}
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                isStart
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : stage.selected
                    ? "border-border bg-muted text-foreground"
                    : "border-transparent bg-muted/50 text-muted-foreground",
              )}
            >
              {stage.selected && <Check className="h-3 w-3 shrink-0" aria-hidden />}
              <span className="whitespace-nowrap">{stage.name}</span>
            </span>
          </Fragment>
        );
      })}
    </nav>
  );
}
