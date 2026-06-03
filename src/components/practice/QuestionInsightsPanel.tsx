import { Lightbulb, AlertTriangle, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface QuestionInsightsData {
  summary?: string | null;
  goodSignals?: string[];
  weakSignals?: string[];
  answerApproach?: string | null;
  followUps?: string[];
  depthLabel?: string | null;
  seniorityExpectation?: string | null;
  sampleAnswerOutline?: string | null;
  meta?: {
    company?: string;
    role?: string;
    difficulty?: string | null;
  };
}

interface QuestionInsightsPanelProps {
  data: QuestionInsightsData | null;
  className?: string;
  /**
   * Hide the panel's own "Interviewer focus / What strong answers show" header.
   * Set when the panel is embedded in a surface that already provides a title
   * (e.g. MobileCoachModal's SheetHeader) to avoid a duplicated heading.
   */
  hideHeader?: boolean;
}

export const QuestionInsightsPanel = ({ data, className, hideHeader = false }: QuestionInsightsPanelProps) => {
  if (!data) return null;

  const hasSignals = (data.goodSignals?.length ?? 0) > 0 || (data.weakSignals?.length ?? 0) > 0;
  const hasFollowUps = (data.followUps?.length ?? 0) > 0;
  const hasOutline = Boolean(data.sampleAnswerOutline);
  const badgeLabel = data.depthLabel ?? data.meta?.difficulty ?? null;

  return (
    <div className={cn("rounded-2xl border bg-background p-4 shadow-sm space-y-3", className)}>
      {hideHeader ? (
        badgeLabel && (
          <div className="flex flex-wrap justify-end gap-2">
            <Badge variant="outline" className="text-xs">
              {badgeLabel}
            </Badge>
          </div>
        )
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Interviewer focus</p>
            <h3 className="text-base font-semibold">What strong answers show</h3>
          </div>
          {badgeLabel && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                {badgeLabel}
              </Badge>
            </div>
          )}
        </div>
      )}

      {(data.meta?.company || data.meta?.role || data.seniorityExpectation) && (
        <div className="space-y-1 text-xs text-muted-foreground">
          {(data.meta?.company || data.meta?.role) && (
            <p>
              {data.meta?.role && <span>{data.meta.role}</span>}
              {data.meta?.role && data.meta?.company && <span> • </span>}
              {data.meta?.company && <span>{data.meta.company}</span>}
            </p>
          )}
          {data.seniorityExpectation && <p>{data.seniorityExpectation}</p>}
        </div>
      )}

      {data.summary && (
        <div className="rounded-xl bg-muted/40 p-3 text-sm leading-relaxed">
          {data.summary}
        </div>
      )}

      {hasSignals && (
        <div className="space-y-3">
          {data.goodSignals && data.goodSignals.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Great answers include
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {data.goodSignals.map((signal) => (
                  <li key={signal} className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{signal}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.weakSignals && data.weakSignals.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Watch out for
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {data.weakSignals.map((signal) => (
                  <li key={signal} className="flex gap-2">
                    <span className="text-destructive">•</span>
                    <span>{signal}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {data.answerApproach && (
        <div className="rounded-xl border bg-muted/30 p-3 text-sm">
          <p className="text-xs uppercase text-muted-foreground mb-1">Answer angle</p>
          <p>{data.answerApproach}</p>
        </div>
      )}

      {hasOutline && (
        <div className="rounded-xl border bg-muted/30 p-3 text-sm">
          <div className="flex items-center gap-2 text-sm font-medium mb-1">
            <BookOpen className="h-4 w-4 text-primary" />
            Suggested outline
          </div>
          <p className="text-muted-foreground">{data.sampleAnswerOutline}</p>
        </div>
      )}

      {hasFollowUps && (
        <>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs uppercase text-muted-foreground">They may ask</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {data.followUps?.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

