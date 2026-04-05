import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import Navigation from "@/components/Navigation";
import { OverviewStats } from "@/components/history/OverviewStats";
import {
  HISTORY_FILTER_ALL,
  SearchFilter,
} from "@/components/history/SearchFilter";
import { SessionList } from "@/components/history/SessionList";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
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

const OverviewStatsSkeleton = () => (
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {Array.from({ length: 4 }).map((_, index) => (
      <Card key={index} className="rounded-2xl border-border/70 shadow-sm">
        <CardContent className="space-y-3 p-5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    ))}
  </div>
);

const SessionListSkeleton = () => (
  <div className="space-y-4">
    {Array.from({ length: 3 }).map((_, index) => (
      <Card key={index} className="rounded-3xl border-border/70 shadow-sm">
        <CardContent className="space-y-4 p-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-6 w-60" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-48" />
        </CardContent>
      </Card>
    ))}
  </div>
);

const History = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isOffline } = useNetworkStatus();
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
    ? "Start practice for this research"
    : "Go to Dashboard";
  const primaryEmptyHref = selectedSearchId !== HISTORY_FILTER_ALL
    ? `/dashboard?searchId=${selectedSearchId}`
    : "/dashboard";
  const primaryEmptyLabel = selectedSearchId !== HISTORY_FILTER_ALL
    ? "Open research dashboard"
    : "Go to Dashboard";
  const secondaryEmptyHref = selectedSearchId !== HISTORY_FILTER_ALL ? practiceEntryHref : "/";
  const secondaryEmptyLabel = selectedSearchId !== HISTORY_FILTER_ALL
    ? "Start practice"
    : "Start new research";
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
      <div id="main-content" className="min-h-screen bg-background">
        <Navigation showSearchSelector={false} />
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <div className="space-y-6">
            <div className="space-y-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-72 max-w-full" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            <OverviewStatsSkeleton />
            <SessionListSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="main-content" className="min-h-screen bg-background">
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

        {error && sessions.length === 0 ? (
          <Card className="mt-8 max-w-xl">
            <CardHeader>
              <CardTitle>Practice history unavailable</CardTitle>
              <CardDescription>
                {isOffline ? "Reconnect to load your practice history." : error}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link to={primaryEmptyHref}>{primaryEmptyLabel}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={secondaryEmptyHref}>{secondaryEmptyLabel}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : sessions.length === 0 ? (
          <Card className="mt-8 max-w-2xl rounded-3xl border-dashed text-center">
            <CardHeader>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <ClipboardList className="h-7 w-7 text-muted-foreground" />
              </div>
              <CardTitle>Ready to start practicing</CardTitle>
              <CardDescription>
                Your first practice session will appear here with answers, timing, and notes so you can track your preparation progress.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild>
                <Link to={secondaryEmptyHref}>{secondaryEmptyLabel}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={primaryEmptyHref}>{primaryEmptyLabel}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-8 space-y-6">
            {isLoadingStats && !stats ? (
              <OverviewStatsSkeleton />
            ) : (
              <OverviewStats stats={displayedStats} />
            )}
            {filteredSessions.length === 0 ? (
              <Card className="rounded-3xl border-dashed">
                <CardHeader>
                  <CardTitle>No sessions for this research yet</CardTitle>
                  <CardDescription>
                    You haven't practiced questions from this research run yet. Start a session to build your confidence and track progress here.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 sm:flex-row">
                  <Button asChild>
                    <Link to={practiceEntryHref}>{practiceEntryLabel}</Link>
                  </Button>
                  <Button variant="outline" onClick={() => handleFilterChange(HISTORY_FILTER_ALL)}>
                    Show all sessions
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
