import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ClipboardList, Loader2 } from "lucide-react";
import Navigation from "@/components/Navigation";
import { OverviewStats } from "@/components/history/OverviewStats";
import {
  HISTORY_FILTER_ALL,
  SearchFilter,
} from "@/components/history/SearchFilter";
import { SessionList } from "@/components/history/SessionList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { searchService } from "@/services/searchService";
import type {
  PracticeHistoryOverviewStats,
  PracticeHistorySession,
  PracticeQuestionFlagMap,
} from "@/services/searchService";

const calculateOverviewStats = (
  sessions: PracticeHistorySession[],
  questionFlags: PracticeQuestionFlagMap
): PracticeHistoryOverviewStats => {
  const needsWorkQuestionIds = new Set<string>();

  const totalQuestionsAnswered = sessions.reduce(
    (total, session) => total + session.practice_answers.length,
    0
  );

  const totalTimeSeconds = sessions.reduce(
    (total, session) =>
      total +
      session.practice_answers.reduce(
        (sessionTotal, answer) => sessionTotal + (answer.answer_time_seconds ?? 0),
        0
      ),
    0
  );

  sessions.forEach((session) => {
    session.practice_answers.forEach((answer) => {
      if (questionFlags[answer.question_id]?.flag_type === "needs_work") {
        needsWorkQuestionIds.add(answer.question_id);
      }
    });
  });

  return {
    totalSessions: sessions.length,
    totalQuestionsAnswered,
    totalTimeSeconds,
    needsWorkCount: needsWorkQuestionIds.size,
  };
};

const History = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sessions, setSessions] = useState<PracticeHistorySession[]>([]);
  const [questionFlags, setQuestionFlags] = useState<PracticeQuestionFlagMap>({});
  const [stats, setStats] = useState<PracticeHistoryOverviewStats | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedSearchId = searchParams.get("searchId") ?? HISTORY_FILTER_ALL;

  useEffect(() => {
    let isActive = true;

    const loadSessions = async () => {
      setIsLoadingSessions(true);
      setError(null);

      const sessionsResult = await searchService.getPracticeSessions();

      if (!isActive) return;

      if (!sessionsResult.success || !sessionsResult.sessions) {
        setError("Failed to load practice history.");
        setIsLoadingSessions(false);
        return;
      }

      setSessions(sessionsResult.sessions);

      const questionIds = Array.from(
        new Set(
          sessionsResult.sessions.flatMap((session) =>
            session.practice_answers.map((answer) => answer.question_id)
          )
        )
      );

      if (questionIds.length > 0) {
        const flagsResult = await searchService.getQuestionFlags(questionIds);

        if (!isActive) return;

        if (flagsResult.success && flagsResult.flags) {
          setQuestionFlags(flagsResult.flags);
        }
      }

      setIsLoadingSessions(false);
    };

    loadSessions();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadStats = async () => {
      setIsLoadingStats(true);
      setStats(null);

      const statsResult = await searchService.getPracticeOverviewStats(
        selectedSearchId === HISTORY_FILTER_ALL ? undefined : selectedSearchId
      );

      if (!isActive) return;

      if (statsResult.success && statsResult.stats) {
        setStats(statsResult.stats);
      } else {
        setStats(null);
      }

      setIsLoadingStats(false);
    };

    loadStats();

    return () => {
      isActive = false;
    };
  }, [selectedSearchId]);

  const filteredSessions = useMemo(() => {
    if (selectedSearchId === HISTORY_FILTER_ALL) {
      return sessions;
    }

    return sessions.filter((session) => session.search_id === selectedSearchId);
  }, [selectedSearchId, sessions]);

  const fallbackStats = useMemo(
    () => calculateOverviewStats(filteredSessions, questionFlags),
    [filteredSessions, questionFlags]
  );

  const practiceEntryHref = selectedSearchId !== HISTORY_FILTER_ALL
    ? `/practice?searchId=${selectedSearchId}`
    : "/dashboard";
  const practiceEntryLabel = selectedSearchId !== HISTORY_FILTER_ALL
    ? "Start practicing"
    : "Go to Dashboard";
  const displayedStats = isLoadingStats ? fallbackStats : stats ?? fallbackStats;

  const handleFilterChange = (value: string) => {
    const nextSearchParams = new URLSearchParams(searchParams);

    if (value === HISTORY_FILTER_ALL) {
      nextSearchParams.delete("searchId");
    } else {
      nextSearchParams.set("searchId", value);
    }

    setSearchParams(nextSearchParams);
  };

  if (isLoadingSessions && sessions.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation showSearchSelector={false} />
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <Card className="mx-auto max-w-md text-center">
            <CardHeader>
              <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin" />
              <CardTitle>Loading practice history</CardTitle>
              <CardDescription>
                Pulling together your completed practice sessions.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation showSearchSelector={false} />
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <ClipboardList className="h-4 w-4" />
              Practice History
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Review how each round went</h1>
            <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
              See what you practiced, how long you spent, and which questions still need another pass.
            </p>
          </div>

          {sessions.length > 0 && (
            <SearchFilter
              sessions={sessions}
              value={selectedSearchId}
              onChange={handleFilterChange}
            />
          )}
        </div>

        {error ? (
          <Card className="mt-8 max-w-xl">
            <CardHeader>
              <CardTitle>Practice history unavailable</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to={practiceEntryHref}>{practiceEntryLabel}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : sessions.length === 0 ? (
          <Card className="mt-8 max-w-2xl rounded-3xl border-dashed text-center">
            <CardHeader>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <ClipboardList className="h-7 w-7 text-muted-foreground" />
              </div>
              <CardTitle>No practice sessions yet</CardTitle>
              <CardDescription>
                Complete a practice round and it will show up here with your answers, timing, and notes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to={practiceEntryHref}>{practiceEntryLabel}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-8 space-y-6">
            <OverviewStats stats={displayedStats} />
            {isLoadingStats && (
              <p className="text-sm text-muted-foreground">Refreshing overview totals...</p>
            )}

            {filteredSessions.length === 0 ? (
              <Card className="rounded-3xl border-dashed">
                <CardHeader>
                  <CardTitle>No sessions for this research yet</CardTitle>
                  <CardDescription>
                    Clear the filter or start another round to build practice history for this search.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 sm:flex-row">
                  <Button variant="outline" onClick={() => handleFilterChange(HISTORY_FILTER_ALL)}>
                    Show all sessions
                  </Button>
                  <Button asChild>
                    <Link to={practiceEntryHref}>{practiceEntryLabel}</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <SessionList sessions={filteredSessions} questionFlags={questionFlags} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
