import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ResearchPreview } from "@/types/researchPreview";

const confidenceClass = (confidence: string) => {
  if (confidence === "high") return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  if (confidence === "medium") return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
};

const importanceClass = (importance: string) => {
  if (importance === "high") return "border-l-red-400";
  if (importance === "medium") return "border-l-amber-400";
  return "border-l-slate-300 dark:border-l-slate-700";
};

export const InterviewBriefPreview = ({ preview }: { preview: ResearchPreview }) => (
  <Card className="border shadow-sm" aria-live="polite">
    <CardHeader className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="bg-background text-[10px] font-medium">
          Interview brief preview
        </Badge>
        <Badge className={cn("text-[10px] font-medium", confidenceClass(preview.confidence))}>
          {preview.confidence} confidence
        </Badge>
        {preview.status === "cached" && (
          <Badge variant="secondary" className="text-[10px] font-medium">
            Cached
          </Badge>
        )}
      </div>
      <div>
        <CardTitle className="text-2xl tracking-tight">
          {preview.company}
          {preview.role ? ` · ${preview.role}` : ""}
        </CardTitle>
        <CardDescription className="mt-2 text-sm leading-6">
          {preview.sourceSummary}
        </CardDescription>
      </div>
    </CardHeader>
    <CardContent className="space-y-5">
      <div className="rounded-2xl border bg-muted/20 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-semibold">What generic AI would miss</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              This preview is organized around interview-stage likelihood, public hiring signals,
              and role-specific assessment criteria instead of a generic list of questions.
            </p>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="text-base font-semibold">Likely rounds</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {preview.stages.map((stage) => (
            <div key={stage.name} className="rounded-2xl border bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{stage.name}</p>
                <Badge className={cn("text-[10px]", confidenceClass(stage.confidence))}>
                  {stage.confidence}
                </Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{stage.whyLikely}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold">Top assessment signals</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {preview.assessmentSignals.map((signal) => (
            <div
              key={signal.name}
              className={cn("rounded-r-2xl border-l-2 bg-muted/20 px-4 py-3", importanceClass(signal.importance))}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{signal.name}</p>
                <Badge variant="outline" className="text-[10px]">
                  {signal.importance}
                </Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{signal.rationale}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold">Highest-leverage questions</h3>
        <div className="space-y-3">
          {preview.questions.slice(0, 5).map((question) => (
            <div key={question.question} className="rounded-2xl border bg-background p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">
                  {question.stage}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {question.difficulty}
                </Badge>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6">{question.question}</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                <span className="font-medium text-foreground/70">Why likely: </span>
                {question.rationale}
              </p>
            </div>
          ))}
        </div>
      </section>

      {preview.confidence === "low" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Public signal is limited. Use this as a starting map, then add the job description after signup for sharper tailoring.</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        Preview expires {new Date(preview.expiresAt).toLocaleDateString()}.
      </div>
    </CardContent>
  </Card>
);

