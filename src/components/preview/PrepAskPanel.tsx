import { useState } from "react";
import { MessageSquareText } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ResearchPreview } from "@/types/researchPreview";

const PROMPTS = [
  "What should I practice first?",
  "Which questions are most senior-level?",
  "How should I position my background?",
] as const;

const buildPreviewGuidance = (preview: ResearchPreview, prompt: (typeof PROMPTS)[number]) => {
  const topSignal = preview.assessmentSignals[0];
  const topStage = preview.stages[0];
  const topQuestion = preview.questions[0];

  if (prompt === "Which questions are most senior-level?") {
    return `Start with ${topQuestion?.stage ?? topStage?.name ?? "the highest-confidence round"}. The strongest senior signal is ${topSignal?.name ?? "clear judgment under ambiguity"}, so practice answers that show tradeoffs, ownership, and measurable impact.`;
  }

  if (prompt === "How should I position my background?") {
    return `Position your background around ${topSignal?.name ?? "the role's core assessment signal"}. Tie each story to ${preview.company}${preview.role ? ` ${preview.role}` : ""} context, then explain the decision quality behind the outcome.`;
  }

  return `Practice ${topQuestion?.question ? `"${topQuestion.question}"` : topStage?.name ?? "the first likely round"} first. It maps to ${topSignal?.name ?? "the top assessment signal"} and gives you the fastest read on whether your stories are specific enough.`;
};

export const PrepAskPanel = ({ preview }: { preview: ResearchPreview }) => {
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  const response = buildPreviewGuidance(preview, prompt);

  const showGuidance = (nextPrompt: (typeof PROMPTS)[number]) => {
    setPrompt(nextPrompt);
  };

  return (
    <section className="rounded-2xl border bg-background p-4 shadow-sm" aria-labelledby="preview-quick-guidance-title">
      <div className="flex items-start gap-3">
        <MessageSquareText className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <h3 id="preview-quick-guidance-title" className="text-base font-semibold">Quick guidance</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Choose a preset prompt built from this preview&apos;s stages, signals, and questions.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {PROMPTS.map((item) => (
          <Button
            key={item}
            type="button"
            variant={prompt === item ? "default" : "outline"}
            size="sm"
            onClick={() => showGuidance(item)}
          >
            {item}
          </Button>
        ))}
      </div>

      <div className="mt-4 rounded-xl bg-muted/40 p-3 text-sm leading-6">{response}</div>
    </section>
  );
};
