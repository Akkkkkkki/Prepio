import { useMemo, useState } from "react";
import { Lightbulb } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ResearchPreview } from "@/types/researchPreview";

type GuidanceKey = "practice-first" | "senior-level" | "positioning";

interface GuidancePreset {
  key: GuidanceKey;
  label: string;
  build: (preview: ResearchPreview) => string;
}

// Preset, deterministic pointers derived from the preview JSON. These are
// templated guidance — not an LLM chat — so the copy says exactly that and we
// expose only the fixed prompts instead of a misleading free-text box.
const PRESETS: GuidancePreset[] = [
  {
    key: "practice-first",
    label: "What to practice first",
    build: (preview) => {
      const topQuestion = preview.questions[0];
      const topStage = preview.stages[0];
      const topSignal = preview.assessmentSignals[0];
      return `Practice ${
        topQuestion?.question ? `"${topQuestion.question}"` : topStage?.name ?? "the first likely round"
      } first. It maps to ${
        topSignal?.name ?? "the top assessment signal"
      } and gives you the fastest read on whether your stories are specific enough.`;
    },
  },
  {
    key: "senior-level",
    label: "Most senior-level questions",
    build: (preview) => {
      const topStage = preview.stages[0];
      const topQuestion = preview.questions[0];
      const topSignal = preview.assessmentSignals[0];
      return `Start with ${
        topQuestion?.stage ?? topStage?.name ?? "the highest-confidence round"
      }. The strongest senior signal is ${
        topSignal?.name ?? "clear judgment under ambiguity"
      }, so practice answers that show tradeoffs, ownership, and measurable impact.`;
    },
  },
  {
    key: "positioning",
    label: "How to position my background",
    build: (preview) => {
      const topSignal = preview.assessmentSignals[0];
      return `Position your background around ${
        topSignal?.name ?? "the role's core assessment signal"
      }. Tie each story to ${preview.company}${
        preview.role ? ` ${preview.role}` : ""
      } context, then explain the decision quality behind the outcome.`;
    },
  },
];

export const PrepAskPanel = ({ preview }: { preview: ResearchPreview }) => {
  const [activeKey, setActiveKey] = useState<GuidanceKey>(PRESETS[0].key);

  const response = useMemo(() => {
    const preset = PRESETS.find((item) => item.key === activeKey) ?? PRESETS[0];
    return preset.build(preview);
  }, [activeKey, preview]);

  return (
    <div className="rounded-2xl border bg-background p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Lightbulb className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <h3 className="text-base font-semibold">Quick guidance</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Preset pointers pulled from this prep — pick one.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {PRESETS.map((item) => (
          <Button
            key={item.key}
            type="button"
            variant={item.key === activeKey ? "default" : "outline"}
            size="sm"
            aria-pressed={item.key === activeKey}
            onClick={() => setActiveKey(item.key)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="mt-4 rounded-xl bg-muted/40 p-3 text-sm leading-6" aria-live="polite">
        {response}
      </div>
    </div>
  );
};
