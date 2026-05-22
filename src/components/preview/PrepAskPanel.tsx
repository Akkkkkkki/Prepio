import { useState } from "react";
import { MessageSquareText, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ResearchPreview } from "@/types/researchPreview";

const PROMPTS = [
  "What should I practice first?",
  "Which questions are most senior-level?",
  "How should I position my background?",
] as const;

const buildGroundedResponse = (preview: ResearchPreview, prompt: string) => {
  const topSignal = preview.assessmentSignals[0];
  const topStage = preview.stages[0];
  const topQuestion = preview.questions[0];
  const normalized = prompt.toLowerCase();

  if (normalized.includes("senior")) {
    return `Start with ${topQuestion?.stage ?? topStage?.name ?? "the highest-confidence round"}. The strongest senior signal is ${topSignal?.name ?? "clear judgment under ambiguity"}, so practice answers that show tradeoffs, ownership, and measurable impact.`;
  }

  if (normalized.includes("position")) {
    return `Position your background around ${topSignal?.name ?? "the role's core assessment signal"}. Tie each story to ${preview.company}${preview.role ? ` ${preview.role}` : ""} context, then explain the decision quality behind the outcome.`;
  }

  return `Practice ${topQuestion?.question ? `"${topQuestion.question}"` : topStage?.name ?? "the first likely round"} first. It maps to ${topSignal?.name ?? "the top assessment signal"} and gives you the fastest read on whether your stories are specific enough.`;
};

export const PrepAskPanel = ({ preview }: { preview: ResearchPreview }) => {
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  const [response, setResponse] = useState(() => buildGroundedResponse(preview, PROMPTS[0]));

  const ask = (nextPrompt = prompt) => {
    setPrompt(nextPrompt);
    setResponse(buildGroundedResponse(preview, nextPrompt));
  };

  return (
    <div className="rounded-2xl border bg-background p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <MessageSquareText className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <h3 className="text-base font-semibold">Ask about this prep</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Answers stay grounded in this preview, not a blank generic chat.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {PROMPTS.map((item) => (
          <Button key={item} type="button" variant="outline" size="sm" onClick={() => ask(item)}>
            {item}
          </Button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={2}
          aria-label="Ask about this prep"
        />
        <Button type="button" size="sm" onClick={() => ask()} disabled={!prompt.trim()}>
          <Send className="mr-2 h-4 w-4" />
          Ask
        </Button>
      </div>

      <div className="mt-4 rounded-xl bg-muted/40 p-3 text-sm leading-6">{response}</div>
    </div>
  );
};

