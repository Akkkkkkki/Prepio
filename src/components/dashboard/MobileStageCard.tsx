import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MobileStageCardProps {
  stage: {
    id: string;
    name: string;
    duration: string | null;
    interviewer: string | null;
    content: string | null;
    guidance: string | null;
    questions?: { question: string }[];
  };
  index: number;
  questionCount: number;
  selected: boolean;
  onToggle: (stageId: string) => void;
}

export const MobileStageCard = ({
  stage,
  index,
  questionCount,
  selected,
  onToggle,
}: MobileStageCardProps) => {
  const previewQuestions = stage.questions?.slice(0, 2) ?? [];
  const hasExtraQuestions = (stage.questions?.length ?? 0) > previewQuestions.length;

  return (
    <div
      className={cn(
        "rounded-[28px] border bg-card p-4 shadow-sm transition-colors",
        selected ? "border-primary/30 bg-primary/5" : "border-border"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="outline" className="shrink-0 text-[11px] uppercase tracking-[0.14em]">
            Stage {index + 1}
          </Badge>
          <span className="min-w-0 break-words text-xs text-muted-foreground">
            {questionCount} question{questionCount === 1 ? "" : "s"}
          </span>
        </div>
        <label
          className={cn(
            "flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium",
            selected
              ? "border-primary/20 bg-primary/10 text-primary"
              : "border-border bg-background text-foreground"
          )}
          aria-label={`${selected ? "Remove" : "Include"} ${stage.name}`}
        >
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggle(stage.id)}
            aria-label={`${selected ? "Remove" : "Include"} ${stage.name}`}
          />
          {selected ? "Included" : "Include"}
        </label>
      </div>

      <Accordion type="single" collapsible className="mt-3">
        <AccordionItem value="details" className="border-none">
          <AccordionTrigger className="py-0 text-left hover:no-underline">
            <div className="min-w-0 space-y-3 pr-4">
              <div className="space-y-1">
                <h3 className="min-w-0 break-words text-lg font-semibold leading-tight text-foreground">
                  {stage.name}
                </h3>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p className="break-words">
                    {stage.duration || "Duration TBD"}
                  </p>
                  <p className="break-words">
                    {stage.interviewer || "Interviewer TBD"}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {selected
                  ? "Ready to include in your next practice run."
                  : "Tap include if you want questions from this stage."}
              </p>
            </div>
          </AccordionTrigger>

          <AccordionContent className="pt-4">
            <div className="space-y-4 rounded-[22px] bg-muted/30 p-4">
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Content
                </p>
                <p className="break-words text-sm leading-6 text-foreground/85">
                  {stage.content || "Interview content details will appear here when available."}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Guidance
                </p>
                <p className="break-words text-sm leading-6 text-foreground/85">
                  {stage.guidance || "Preparation guidance will appear here when available."}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Question preview
                </p>
                {previewQuestions.length > 0 ? (
                  <ul className="space-y-2">
                    {previewQuestions.map((questionObj) => (
                      <li key={questionObj.question} className="flex items-start gap-2 text-sm leading-6 text-foreground/85">
                        <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="break-words">{questionObj.question}</span>
                      </li>
                    ))}
                    {hasExtraQuestions && (
                      <li className="text-xs text-muted-foreground">
                        +{(stage.questions?.length ?? 0) - previewQuestions.length} more questions
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Questions will appear here once research completes.
                  </p>
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};
