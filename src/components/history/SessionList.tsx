import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { AlertTriangle, Clock3, Loader2, MessageSquareText, Star } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { searchService } from "@/services/searchService";
import type {
  PracticeHistoryAnswerDetail,
  PracticeHistorySession,
  PracticeHistorySessionDetail,
  PracticeQuestionFlagMap,
} from "@/services/searchService";

interface SessionListProps {
  sessions: PracticeHistorySession[];
  questionFlags: PracticeQuestionFlagMap;
}

interface CachedSessionDetail {
  session: PracticeHistorySessionDetail;
  answers: PracticeHistoryAnswerDetail[];
  flags: PracticeQuestionFlagMap;
}

const formatDuration = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

const getSessionMetrics = (
  session: PracticeHistorySession,
  questionFlags: PracticeQuestionFlagMap
) => {
  const questionIds = new Set<string>();
  const favoriteIds = new Set<string>();
  const needsWorkIds = new Set<string>();

  const totalTimeSeconds = session.practice_answers.reduce((total, answer) => {
    questionIds.add(answer.question_id);

    const questionFlag = questionFlags[answer.question_id]?.flag_type;
    if (questionFlag === "favorite") {
      favoriteIds.add(answer.question_id);
    }
    if (questionFlag === "needs_work") {
      needsWorkIds.add(answer.question_id);
    }

    return total + (answer.answer_time_seconds ?? 0);
  }, 0);

  const answerCount = session.practice_answers.length;

  return {
    answerCount,
    avgTimeSeconds: answerCount > 0 ? Math.floor(totalTimeSeconds / answerCount) : 0,
    totalTimeSeconds,
    favoriteCount: favoriteIds.size,
    needsWorkCount: needsWorkIds.size,
  };
};

const renderQuestionFlag = (flagType?: string) => {
  if (flagType === "favorite") {
    return (
      <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700">
        <Star className="h-3 w-3 fill-current" />
        Favorite
      </Badge>
    );
  }

  if (flagType === "needs_work") {
    return (
      <Badge variant="secondary" className="gap-1 bg-rose-100 text-rose-700">
        <AlertTriangle className="h-3 w-3" />
        Needs work
      </Badge>
    );
  }

  if (flagType === "skipped") {
    return <Badge variant="outline">Skipped</Badge>;
  }

  return null;
};

export const SessionList = ({ sessions, questionFlags }: SessionListProps) => {
  const [openSessionId, setOpenSessionId] = useState("");
  const [detailBySessionId, setDetailBySessionId] = useState<Record<string, CachedSessionDetail>>({});
  const [detailLoadingState, setDetailLoadingState] = useState<Record<string, boolean>>({});
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});

  const handleOpenChange = async (value: string) => {
    setOpenSessionId(value);

    if (!value || detailBySessionId[value] || detailLoadingState[value]) {
      return;
    }

    setDetailLoadingState((current) => ({ ...current, [value]: true }));
    setDetailErrors((current) => {
      const next = { ...current };
      delete next[value];
      return next;
    });

    const result = await searchService.getSessionDetail(value);

    if (result.success && result.session && result.answers) {
      setDetailBySessionId((current) => ({
        ...current,
        [value]: {
          session: result.session,
          answers: result.answers,
          flags: result.flags ?? {},
        },
      }));
    } else {
      setDetailErrors((current) => ({
        ...current,
        [value]: "Failed to load session details.",
      }));
    }

    setDetailLoadingState((current) => ({ ...current, [value]: false }));
  };

  return (
    <Accordion
      type="single"
      collapsible
      value={openSessionId}
      onValueChange={handleOpenChange}
      className="space-y-4"
    >
      {sessions.map((session) => {
        const metrics = getSessionMetrics(session, questionFlags);
        const detail = detailBySessionId[session.id];
        const isDetailLoading = Boolean(detailLoadingState[session.id]);
        const detailError = detailErrors[session.id];
        const completedAt = session.completed_at ? new Date(session.completed_at) : null;

        return (
          <AccordionItem
            key={session.id}
            value={session.id}
            className="overflow-hidden rounded-3xl border border-border/70 bg-card px-5 shadow-sm"
          >
            <AccordionTrigger className="py-5 text-left hover:no-underline">
              <div className="flex flex-1 flex-col gap-4 pr-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                      {completedAt
                        ? `${format(completedAt, "MMM d")} • ${formatDistanceToNow(completedAt, { addSuffix: true })}`
                        : "Completed session"}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {session.searches?.company && (
                        <Badge variant="secondary">{session.searches.company}</Badge>
                      )}
                      {session.searches?.role && (
                        <Badge variant="outline">{session.searches.role}</Badge>
                      )}
                      {session.searches?.country && (
                        <Badge variant="outline">{session.searches.country}</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span>{metrics.answerCount} question{metrics.answerCount !== 1 ? "s" : ""}</span>
                    <span>{formatDuration(metrics.totalTimeSeconds)} total</span>
                    <span>{formatDuration(metrics.avgTimeSeconds)} avg</span>
                  </div>
                </div>

                {session.session_notes && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {session.session_notes}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Star className="h-4 w-4 text-amber-500" />
                    {metrics.favoriteCount} favorite{metrics.favoriteCount !== 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-rose-500" />
                    {metrics.needsWorkCount} needs work
                  </span>
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent className="pb-5">
              <div className="space-y-4 border-t pt-5">
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Session notes
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                    {detail?.session.session_notes || session.session_notes || "No reflection saved for this session."}
                  </p>
                </div>

                {isDetailLoading ? (
                  <div className="flex items-center gap-2 rounded-2xl border bg-background px-4 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading answers...
                  </div>
                ) : detailError ? (
                  <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {detailError}
                  </div>
                ) : detail ? (
                  <div className="space-y-3">
                    {detail.answers.length === 0 ? (
                      <div className="rounded-2xl border bg-background px-4 py-3 text-sm text-muted-foreground">
                        No saved answers were found for this session.
                      </div>
                    ) : (
                      detail.answers.map((answer, index) => {
                        const question = answer.interview_questions;
                        const flagType = detail.flags[answer.question_id]?.flag_type;

                        return (
                          <div key={answer.id} className="rounded-2xl border bg-background p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-2">
                                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                  Question {index + 1}
                                </p>
                                <h3 className="text-base font-medium leading-6">
                                  {question?.question || "Question unavailable"}
                                </h3>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="gap-1">
                                  <Clock3 className="h-3 w-3" />
                                  {formatDuration(answer.answer_time_seconds ?? 0)}
                                </Badge>
                                {renderQuestionFlag(flagType)}
                              </div>
                            </div>

                            <div className="mt-4 rounded-2xl bg-muted/40 p-4">
                              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                Your answer
                              </p>
                              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                                {answer.text_answer?.trim() || "No text answer saved."}
                              </p>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              {question?.category && (
                                <Badge variant="secondary">{question.category}</Badge>
                              )}
                              {question?.difficulty && (
                                <Badge variant="outline">{question.difficulty}</Badge>
                              )}
                              {question?.interview_stages?.name && (
                                <Badge variant="outline" className="gap-1">
                                  <MessageSquareText className="h-3 w-3" />
                                  {question.interview_stages.name}
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border bg-background px-4 py-3 text-sm text-muted-foreground">
                    Open a session to review every saved answer.
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
};
